import { voiceApi } from "../api/client";
import type {
  ChatHistoryItem,
  CognitiveChatResponse,
  GeminiMode,
  HealthResponse,
  MetricsResponse,
  ProcessAudioResponse,
  SessionHistoryItem,
} from "../api/types";
import { VoiceApiError } from "../api/types";
import type { ConsensoResult } from "../api/types";
import {
  CaptureError,
  HeadsetCapture,
  isMediaRecorderCaptureAvailable,
  listAudioInputs,
  probeCaptureCapabilities,
  probeMicrophoneAccess,
} from "../audio/capture";
import { playResponseAudio } from "../audio/playback";
import {
  SpeechCaptureError,
  WebSpeechCapture,
  isSpeechRecognitionAvailable,
  speakLocally,
} from "../audio/speech";
import { renderMetricsPanel } from "./components/MetricsPanel";
import { renderSessionHistory } from "./components/SessionHistory";
import { escapeHtml, formatMs, formatPercent } from "./html";
import { renderMarkdown } from "./markdown";

/** Portuguese flow states for the Bluetooth headset control UI. */
type UiPhase = "idle" | "listening" | "validating" | "responding";
type AuditTab = "history" | "metrics";
/** Mic HUD: MediaRecorder ok · permission denied · Web Speech fallback. */
type MicStatus = "active" | "blocked" | "safe";
type CaptureMode = "mediarecorder" | "webspeech";

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "Pronto",
  listening: "A escutar...",
  validating: "Validando no Consenso Alfa...",
  responding: "A responder...",
};

const MIC_STATUS_LABEL: Record<MicStatus, string> = {
  active: "Active",
  blocked: "Blocked",
  safe: "Safe Mode",
};

const HUD_CLIENT_ID = "default";

export class ControlApp {
  private readonly root: HTMLElement;
  private readonly capture = new HeadsetCapture();
  private readonly speech = new WebSpeechCapture();
  private phase: UiPhase = "idle";
  private health: HealthResponse | null = null;
  private lastResult: ProcessAudioResponse | null = null;
  private errorMessage: string | null = null;
  private devices: MediaDeviceInfo[] = [];
  private activeMicLabel: string | null = null;
  private healthTimer: number | null = null;
  private readonly healthPollMs = 4_000;
  private micStatus: MicStatus = "safe";
  private captureMode: CaptureMode = "mediarecorder";
  private reconnectBusy = false;
  private speechInterim = "";
  private speechPollTimer: number | null = null;

  /** Collapsible audit panel (history + metrics). */
  private auditOpen = true;
  private auditTab: AuditTab = "history";
  private historyItems: SessionHistoryItem[] = [];
  private metrics: MetricsResponse | null = null;
  private auditLoading = false;
  private auditError: string | null = null;

  /** Gemini cognitive chat (flash | pro) + structured history. */
  private geminiMode: GeminiMode = "flash";
  private chatHistory: ChatHistoryItem[] = [];
  private lastChat: CognitiveChatResponse | null = null;
  private chatBusy = false;
  private chatDraft = "";

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async mount(): Promise<void> {
    this.render();
    await this.refreshHealth();
    await this.probeMicStatus({ quiet: true });
    await this.refreshAudit({ quiet: true });
    this.startHealthPolling();
  }

  /** Soft mic probe — no full page reload. Updates Active / Blocked / Safe Mode. */
  private async probeMicStatus(options: { quiet?: boolean } = {}): Promise<void> {
    const caps = probeCaptureCapabilities();
    if (!isMediaRecorderCaptureAvailable()) {
      this.micStatus = caps.speechRecognition ? "safe" : "blocked";
      this.captureMode = caps.speechRecognition ? "webspeech" : "mediarecorder";
      if (!options.quiet && this.micStatus === "safe") {
        this.errorMessage =
          "MediaRecorder indisponível — Safe Mode (Web Speech) ativo.";
      }
      this.render();
      return;
    }

    const probe = await probeMicrophoneAccess();
    if (probe.ok) {
      this.micStatus = "active";
      this.captureMode = "mediarecorder";
      this.activeMicLabel = probe.label;
      if (!options.quiet) {
        this.errorMessage = null;
      }
    } else if (probe.error?.kind === "permission_denied") {
      this.micStatus = "blocked";
      this.activeMicLabel = null;
      if (!options.quiet) {
        this.errorMessage = probe.error.message;
      }
    } else if (isSpeechRecognitionAvailable()) {
      this.micStatus = "safe";
      this.captureMode = "webspeech";
      if (!options.quiet) {
        this.errorMessage =
          probe.error?.message ??
          "Captura de áudio falhou — Safe Mode (Web Speech) ativo.";
      }
    } else {
      this.micStatus = "blocked";
      if (!options.quiet) {
        this.errorMessage =
          probe.error?.message ?? "Microfone indisponível neste browser.";
      }
    }
    this.render();
  }

  private async reconnectMic(): Promise<void> {
    if (this.reconnectBusy || this.phase !== "idle") return;
    this.reconnectBusy = true;
    this.errorMessage = null;
    this.capture.cancel();
    this.speech.cancel();
    this.speechInterim = "";
    this.render();
    try {
      await this.probeMicStatus({ quiet: false });
      if (this.micStatus === "active") {
        this.errorMessage = null;
        this.activeMicLabel = this.activeMicLabel ?? "entrada padrão do sistema";
      }
    } finally {
      this.reconnectBusy = false;
      this.render();
    }
  }

  private startHealthPolling(): void {
    if (this.healthTimer !== null) {
      window.clearInterval(this.healthTimer);
    }
    this.healthTimer = window.setInterval(() => {
      void this.refreshHealth({ quiet: true });
    }, this.healthPollMs);
  }

  private setPhase(phase: UiPhase): void {
    this.phase = phase;
    if (phase === "listening" && this.captureMode === "webspeech") {
      this.startSpeechInterimPoll();
    } else {
      this.stopSpeechInterimPoll();
    }
    this.render();
  }

  private startSpeechInterimPoll(): void {
    this.stopSpeechInterimPoll();
    this.speechPollTimer = window.setInterval(() => {
      if (!this.speech.isListening()) return;
      const next = this.speech.getInterim();
      if (next !== this.speechInterim) {
        this.speechInterim = next;
        this.render();
      }
    }, 400);
  }

  private stopSpeechInterimPoll(): void {
    if (this.speechPollTimer !== null) {
      window.clearInterval(this.speechPollTimer);
      this.speechPollTimer = null;
    }
  }

  private async refreshHealth(options: { quiet?: boolean } = {}): Promise<void> {
    try {
      this.health = await voiceApi.health();
      if (!options.quiet) {
        this.errorMessage = null;
      }
    } catch (err) {
      this.health = null;
      if (!options.quiet) {
        this.errorMessage =
          err instanceof VoiceApiError
            ? `${err.message} — ${err.detail}`
            : "Backend indisponível. Inicie o FastAPI em :8001 (use start_app.bat).";
      }
    }
    this.render();
  }

  /** Pull SessionLogs + consolidated metrics for the HUD panels. */
  private async refreshAudit(options: { quiet?: boolean } = {}): Promise<void> {
    this.auditLoading = true;
    if (!options.quiet) {
      this.auditError = null;
    }
    this.render();
    try {
      const [history, metrics] = await Promise.all([
        voiceApi.history({ limit: 40, clientId: HUD_CLIENT_ID }),
        voiceApi.metrics(),
      ]);
      this.historyItems = history.items;
      this.metrics = metrics;
      this.auditError = null;
    } catch (err) {
      if (!options.quiet) {
        this.auditError =
          err instanceof VoiceApiError
            ? `${err.message}${err.detail ? ` — ${err.detail}` : ""}`
            : "Falha ao carregar histórico / métricas.";
      }
    } finally {
      this.auditLoading = false;
      this.render();
    }
  }

  private async refreshDevices(): Promise<void> {
    try {
      const probe = await probeMicrophoneAccess();
      if (!probe.ok) {
        throw probe.error ?? new CaptureError("unknown", "Falha ao listar microfones.");
      }
      this.devices = await listAudioInputs();
      this.micStatus = "active";
      this.captureMode = "mediarecorder";
      this.activeMicLabel = probe.label;
      this.errorMessage = null;
    } catch (err) {
      const classified = err instanceof CaptureError ? err : classifySoft(err);
      if (classified.kind === "permission_denied") {
        this.micStatus = "blocked";
        this.errorMessage = classified.message;
      } else if (isSpeechRecognitionAvailable()) {
        this.micStatus = "safe";
        this.captureMode = "webspeech";
        this.errorMessage = `${classified.message} — Safe Mode disponível.`;
      } else {
        this.micStatus = "blocked";
        this.errorMessage = classified.message;
      }
    }
    this.render();
  }

  private async toggleRecord(): Promise<void> {
    if (this.phase === "listening") {
      await this.finishRecord();
      return;
    }
    if (this.phase !== "idle") {
      return;
    }
    if (this.micStatus === "blocked") {
      this.errorMessage =
        "Microfone bloqueado. Autorize a permissão e clique em Reconectar.";
      this.render();
      return;
    }
    this.errorMessage = null;
    this.speechInterim = "";

    // Prefer MediaRecorder; fall back to Web Speech Safe Mode without reload.
    if (this.captureMode === "mediarecorder" && isMediaRecorderCaptureAvailable()) {
      try {
        await this.capture.start();
        this.activeMicLabel = this.capture.getActiveLabel();
        this.micStatus = "active";
        this.setPhase("listening");
        return;
      } catch (err) {
        const classified = err instanceof CaptureError ? err : classifySoft(err);
        this.capture.cancel();
        if (classified.kind === "permission_denied") {
          this.micStatus = "blocked";
          this.errorMessage = classified.message;
          this.setPhase("idle");
          return;
        }
        if (!isSpeechRecognitionAvailable()) {
          this.micStatus = "blocked";
          this.errorMessage = classified.message;
          this.setPhase("idle");
          return;
        }
        this.micStatus = "safe";
        this.captureMode = "webspeech";
        this.errorMessage =
          "MediaRecorder falhou — a usar Safe Mode (Web Speech).";
      }
    }

    try {
      await this.speech.start({ lang: "pt-BR" });
      this.micStatus = "safe";
      this.captureMode = "webspeech";
      this.activeMicLabel = "Web Speech · Safe Mode";
      this.setPhase("listening");
    } catch (err) {
      this.speech.cancel();
      if (err instanceof SpeechCaptureError && err.kind === "blocked") {
        this.micStatus = "blocked";
      }
      this.errorMessage =
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a captura de voz.";
      this.setPhase("idle");
    }
  }

  private async finishRecord(): Promise<void> {
    if (this.captureMode === "webspeech" || this.speech.isListening()) {
      await this.finishSpeechSafeMode();
      return;
    }
    this.setPhase("validating");
    try {
      const captured = await this.capture.stop();
      // Multipart/form-data via FormData (browser sets boundary) → POST /process-audio
      const result = await voiceApi.processAudio(captured.blob, {
        filename: `headset-${Date.now()}.${extensionForMime(captured.mimeType)}`,
        locale: "pt-BR",
        clientId: HUD_CLIENT_ID,
      });
      this.lastResult = result;
      this.pushChatTurn(
        result.transcription ?? result.transcript,
        result.gemini_response ?? result.response_text,
      );
      this.setPhase("responding");
      // Prefer server TTS; fall back to browser speechSynthesis (Gemini-only stack).
      try {
        if (result.audio_url || result.audio_base64) {
          await playResponseAudio({
            audioUrl: result.audio_url ?? null,
            audioBase64: result.audio_base64,
            mimeType: result.audio_mime_type,
          });
        } else {
          await speakLocally(
            result.gemini_response ?? result.response_text,
            "pt-BR",
          );
        }
      } catch {
        await speakLocally(
          result.gemini_response ?? result.response_text,
          "pt-BR",
        );
      }
      this.setPhase("idle");
      // Refresh Session History + Metrics after each successful M100 / headset turn.
      void this.refreshAudit({ quiet: true });
    } catch (err) {
      this.capture.cancel();
      if (err instanceof VoiceApiError) {
        this.errorMessage = `${err.message}${err.detail ? ` — ${err.detail}` : ""}${
          err.retryable ? " (pode tentar de novo)" : ""
        }`;
      } else {
        this.errorMessage = "Falha ao processar o áudio.";
      }
      this.setPhase("idle");
    }
  }

  /** Safe Mode: Web Speech transcript → cognitive chat → local TTS. */
  private async finishSpeechSafeMode(): Promise<void> {
    this.setPhase("validating");
    try {
      const heard = await this.speech.stop();
      this.speechInterim = "";
      const historyForApi = this.chatHistory.slice();
      const res = await voiceApi.cognitiveChat({
        query: heard.transcript,
        history: historyForApi,
        mode: this.geminiMode,
        locale: "pt-BR",
        client_id: HUD_CLIENT_ID,
      });
      this.lastChat = res;
      this.lastResult = processAudioFromCognitive(res, heard.transcript);
      this.pushChatTurn(heard.transcript, res.gemini_response);
      this.setPhase("responding");
      await speakLocally(res.gemini_response || res.response_text, "pt-BR");
      this.setPhase("idle");
      void this.refreshAudit({ quiet: true });
    } catch (err) {
      this.speech.cancel();
      if (err instanceof SpeechCaptureError) {
        this.errorMessage = err.message;
        if (err.kind === "blocked") this.micStatus = "blocked";
      } else if (err instanceof VoiceApiError) {
        this.errorMessage = `${err.message}${err.detail ? ` — ${err.detail}` : ""}`;
      } else {
        this.errorMessage = "Falha no Safe Mode (Web Speech).";
      }
      this.setPhase("idle");
    }
  }

  private pushChatTurn(userText: string, modelText: string): void {
    const u = userText.trim();
    const m = modelText.trim();
    if (u) this.chatHistory.push({ role: "user", content: u });
    if (m) this.chatHistory.push({ role: "model", content: m });
    // Keep client history lean for the API
    if (this.chatHistory.length > 24) {
      this.chatHistory = this.chatHistory.slice(-24);
    }
  }

  private async sendCognitiveChat(): Promise<void> {
    const query = this.chatDraft.trim();
    if (!query || this.chatBusy) return;
    this.chatBusy = true;
    this.errorMessage = null;
    this.render();
    try {
      const historyForApi = this.chatHistory.slice();
      const res = await voiceApi.cognitiveChat({
        query,
        history: historyForApi,
        mode: this.geminiMode,
        locale: "pt-BR",
        client_id: HUD_CLIENT_ID,
      });
      this.lastChat = res;
      this.pushChatTurn(query, res.gemini_response);
      this.chatDraft = "";
      void this.refreshAudit({ quiet: true });
    } catch (err) {
      if (err instanceof VoiceApiError) {
        this.errorMessage = `${err.message}${err.detail ? ` — ${err.detail}` : ""}`;
      } else {
        this.errorMessage = "Falha no chat cognitivo Gemini.";
      }
    } finally {
      this.chatBusy = false;
      this.render();
    }
  }

  private bindAuditControls(): void {
    this.root.querySelector<HTMLButtonElement>('[data-action="audit-toggle"]')?.addEventListener(
      "click",
      () => {
        this.auditOpen = !this.auditOpen;
        this.render();
      },
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-audit-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.auditTab;
        if (tab === "history" || tab === "metrics") {
          this.auditTab = tab;
          this.render();
        }
      });
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="audit-refresh"]')?.addEventListener(
      "click",
      () => {
        void this.refreshAudit();
      },
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-gemini-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.geminiMode;
        if (mode === "flash" || mode === "pro") {
          this.geminiMode = mode;
          this.render();
        }
      });
    });
    this.root.querySelector<HTMLTextAreaElement>('[data-field="chat-draft"]')?.addEventListener(
      "input",
      (ev) => {
        this.chatDraft = (ev.target as HTMLTextAreaElement).value;
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="chat-send"]')?.addEventListener(
      "click",
      () => {
        void this.sendCognitiveChat();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="chat-clear"]')?.addEventListener(
      "click",
      () => {
        this.chatHistory = [];
        this.lastChat = null;
        this.chatDraft = "";
        this.render();
      },
    );
  }

  private render(): void {
    const health = this.health;
    const result = this.lastResult;
    const listening = this.phase === "listening";
    const busy = this.phase === "validating" || this.phase === "responding";
    const phaseLabel = PHASE_LABEL[this.phase];

    const historyHtml = renderSessionHistory({
      items: this.historyItems,
      loading: this.auditLoading,
      error: this.auditTab === "history" ? this.auditError : null,
    });
    const metricsHtml = renderMetricsPanel({
      metrics: this.metrics,
      loading: this.auditLoading,
      error: this.auditTab === "metrics" ? this.auditError : null,
    });

    this.root.innerHTML = `
      <main class="shell">
        <header class="brand">
          <h1 class="brand__mark">Aether <span>Vision</span></h1>
          <p class="brand__lede">
            Controle do assistente de voz para headsets Bluetooth genéricos —
            captura, Consenso Alfa e resposta em alta fidelidade.
          </p>
        </header>

        <div class="status-row" aria-live="polite">
          ${apiConnectionBadge(health)}
          ${cognitiveBadge(health)}
          ${geminiKeyBadge(health)}
          <span>áudio ${health?.use_mock_audio === false ? "real" : "mock"}</span>
          <span>STT ${health?.stt_provider ?? "—"}</span>
          <span>TTS ${health?.tts_provider ?? "—"}</span>
          <span>Consenso ${health?.consenso_enabled ? "ativo" : "off"}</span>
          <span>v${health?.version ?? "—"}</span>
        </div>

        ${connectionBanner(health)}
        ${geminiKeyWarning(health)}

        <div
          class="flow-status flow-status--${this.phase}"
          role="status"
          aria-live="assertive"
          data-phase="${this.phase}"
        >
          <span class="flow-status__pulse" aria-hidden="true"></span>
          <strong>${escapeHtml(phaseLabel)}</strong>
          ${micStatusBadge(this.micStatus)}
          ${
            this.activeMicLabel
              ? `<span class="flow-status__mic">mic: ${escapeHtml(this.activeMicLabel)}</span>`
              : `<span class="flow-status__mic">mic: entrada padrão do sistema</span>`
          }
          ${
            this.captureMode === "webspeech"
              ? `<span class="flow-status__mic">via Web Speech</span>`
              : ""
          }
          ${
            listening && this.speechInterim
              ? `<span class="flow-status__mic">“…${escapeHtml(this.speechInterim)}”</span>`
              : ""
          }
          ${toolHudBanner(result, this.phase)}
        </div>

        <section class="panel" aria-labelledby="capture-title">
          <h2 id="capture-title">Headset Bluetooth</h2>
          <p class="hint">
            Pareie o fone no sistema operacional, selecione-o como entrada/saída padrão,
            depois grave um comando curto. Preferência:
            <code>MediaRecorder</code> → <code>POST /process-audio</code>.
            Se falhar, Safe Mode usa Web Speech → <code>/api/cognitive/chat</code>
            sem recarregar a página.
          </p>
          <div class="controls">
            <button
              type="button"
              class="btn-primary ${listening ? "is-recording" : ""}"
              data-action="record"
              ${busy || this.micStatus === "blocked" ? "disabled" : ""}
            >
              ${
                listening
                  ? this.captureMode === "webspeech"
                    ? "Parar Safe Mode"
                    : "Parar e enviar"
                  : this.phase === "validating"
                    ? "Validando no Consenso Alfa..."
                    : this.phase === "responding"
                      ? "A responder..."
                      : this.micStatus === "safe"
                        ? "Falar (Safe Mode)"
                        : "Gravar com o headset"
              }
            </button>
            <button
              type="button"
              class="btn-ghost"
              data-action="reconnect"
              ${busy || this.reconnectBusy ? "disabled" : ""}
            >
              ${this.reconnectBusy ? "A reconectar..." : "Reconectar / Retry"}
            </button>
            <button type="button" class="btn-ghost" data-action="devices" ${busy ? "disabled" : ""}>
              Listar microfones
            </button>
            <button type="button" class="btn-ghost" data-action="health" ${busy ? "disabled" : ""}>
              Checar API
            </button>
          </div>
          ${
            this.devices.length
              ? `<ul class="device-list">${this.devices
                  .map((d) => `<li>${escapeHtml(d.label || d.deviceId)}</li>`)
                  .join("")}</ul>`
              : ""
          }
          ${this.errorMessage ? `<p class="error">${escapeHtml(this.errorMessage)}</p>` : ""}
        </section>

        <section class="panel" aria-labelledby="result-title">
          <h2 id="result-title">Última resposta</h2>
          ${
            result
              ? `<div class="result-grid">
                  <div class="block">
                    <div class="block__label">Transcrição (STT)</div>
                    <p class="block__body">${escapeHtml(
                      result.transcription ?? result.transcript,
                    )}</p>
                    <div class="block__label" style="margin-top:1rem">
                      Resposta ${
                        (result.meta.cognitive_provider ?? "gemini") === "gemini"
                          ? "Gemini"
                          : "agente"
                      }
                      ${
                        result.status
                          ? ` · <span class="status-pill status-pill--${escapeHtml(result.status)}">${escapeHtml(result.status)}</span>`
                          : ""
                      }
                    </div>
                    <div class="gemini-reply md-frame">
                      ${renderMarkdown(result.gemini_response ?? result.response_text)}
                    </div>
                    ${
                      result.meta.used_safe_fallback || !result.consenso.approved
                        ? `<p class="hint" style="margin-top:0.75rem">
                            Fallback seguro ativo${
                              result.meta.fallback_reason
                                ? ` (${escapeHtml(result.meta.fallback_reason)})`
                                : ""
                            }.
                          </p>`
                        : ""
                    }
                    ${
                      result.audio_response_url || result.audio_url
                        ? `<p class="hint" style="margin-top:0.5rem">
                            Áudio:
                            <a class="audio-link" href="${escapeHtml(
                              result.audio_response_url ?? result.audio_url ?? "",
                            )}" target="_blank" rel="noreferrer">audio_response_url</a>
                          </p>`
                        : ""
                    }
                  </div>
                  <div class="block">
                    <div class="block__label">Consenso Alfa</div>
                    <div class="confidence">
                      <div class="confidence__head">
                        <span>${result.consenso.approved ? "aprovado" : "rejeitado"}</span>
                        <strong>${formatPercent(
                          result.consensus_confidence ?? result.consenso.agreement_ratio,
                        )}</strong>
                      </div>
                      <div class="confidence__track" aria-hidden="true">
                        <span
                          class="confidence__fill"
                          style="width:${Math.max(
                            0,
                            Math.min(
                              100,
                              Math.round(
                                (result.consensus_confidence ??
                                  result.consenso.agreement_ratio) * 100,
                              ),
                            ),
                          )}%"
                        ></span>
                      </div>
                      <small class="hint">${result.consenso.duration_ms} ms · motor ${escapeHtml(
                        result.meta.cognitive_provider ?? "—",
                      )}</small>
                    </div>
                    <p class="block__body" style="margin-top:0.75rem">
                      acordo ${(result.consenso.agreement_ratio * 100).toFixed(0)}% ·
                      ${result.consenso.duration_ms} ms
                    </p>
                    <div class="votes">
                      ${(result.consenso.agent_latencies?.length
                        ? result.consenso.agent_latencies
                        : result.consenso.votes.map((v) => ({
                            agent_id: v.agent_id,
                            agent_role: v.agent_role,
                            duration_ms: v.duration_ms,
                            label: v.agent_role,
                          }))
                      )
                        .map((a) => {
                          const vote = result.consenso.votes.find(
                            (v) => v.agent_id === a.agent_id,
                          );
                          return `<div class="vote">
                            <span><strong>${escapeHtml(a.label || a.agent_role)}</strong><br/>
                            <small>${escapeHtml(vote?.rationale ?? "")}</small></span>
                            <span>${vote?.approved ? "ok" : "no"} · ${a.duration_ms} ms</span>
                          </div>`;
                        })
                        .join("")}
                    </div>
                    <div class="latency" style="margin-top:1rem">
                      <div class="block__label">Latência total ${result.latency.total_ms} ms</div>
                      <div class="latency__bar"><span></span></div>
                      <small style="color:var(--muted)">
                        STT ${result.latency.stt_ms} · agente ${result.latency.agent_ms} ·
                        consenso ${result.latency.consenso_ms} · TTS ${result.latency.tts_ms}
                      </small>
                      <small style="color:var(--muted); display:block; margin-top:0.35rem">
                        Grounding ${result.latency.consenso_grounding_ms ?? 0} ms ·
                        Safety/Tone ${result.latency.consenso_safety_tone_ms ?? 0} ms ·
                        Consistency ${result.latency.consenso_consistency_ms ?? 0} ms
                      </small>
                    </div>
                    ${toolsPanelHtml(result)}
                  </div>
                </div>`
              : `<p class="hint">Nenhuma captura ainda. Grave um teste com o headset.</p>`
          }
        </section>

        <section class="panel cognitive-panel" aria-labelledby="cognitive-title">
          <h2 id="cognitive-title">Chat cognitivo Gemini</h2>
          <p class="hint">
            <code>POST /api/cognitive/chat</code> com
            <code>mode</code> + histórico estruturado → Consenso Alfa → payload unificado.
          </p>
          <div class="mode-selector" role="group" aria-label="Modelo Gemini">
            <button
              type="button"
              class="mode-chip ${this.geminiMode === "flash" ? "is-active" : ""}"
              data-gemini-mode="flash"
              ${this.chatBusy ? "disabled" : ""}
            >
              Flash · gemini-2.5-flash
            </button>
            <button
              type="button"
              class="mode-chip ${this.geminiMode === "pro" ? "is-active" : ""}"
              data-gemini-mode="pro"
              ${this.chatBusy ? "disabled" : ""}
            >
              Pro · gemini-2.5-pro
            </button>
          </div>
          <label class="chat-label" for="chat-draft">Pergunta</label>
          <textarea
            id="chat-draft"
            class="chat-draft"
            data-field="chat-draft"
            rows="3"
            placeholder="Ex.: resume a arquitetura STT → Gemini → Consenso → TTS"
            ${this.chatBusy ? "disabled" : ""}
          >${escapeHtml(this.chatDraft)}</textarea>
          <div class="controls">
            <button
              type="button"
              class="btn-primary"
              data-action="chat-send"
              ${this.chatBusy ? "disabled" : ""}
            >
              ${this.chatBusy ? "A pensar..." : "Enviar chat"}
            </button>
            <button
              type="button"
              class="btn-ghost"
              data-action="chat-clear"
              ${this.chatBusy ? "disabled" : ""}
            >
              Limpar histórico
            </button>
          </div>
          ${renderCognitiveChatResult(this.lastChat, this.chatHistory)}
        </section>

        <section class="panel audit-panel" aria-labelledby="audit-title">
          <div class="audit-panel__head">
            <h2 id="audit-title">Sessão &amp; métricas</h2>
            <div class="controls">
              <button
                type="button"
                class="btn-ghost"
                data-action="audit-toggle"
                aria-expanded="${this.auditOpen ? "true" : "false"}"
              >
                ${this.auditOpen ? "Recolher" : "Expandir"}
              </button>
              <button
                type="button"
                class="btn-ghost"
                data-action="audit-refresh"
                ${busy || this.auditLoading ? "disabled" : ""}
              >
                Atualizar
              </button>
            </div>
          </div>
          <p class="hint">
            Histórico SQLite (<code>GET /api/history</code>) e médias
            (<code>GET /api/metrics</code>. Atualiza automaticamente após cada
            <code>/process-audio</code> bem-sucedido.
          </p>
          ${
            this.auditOpen
              ? `<div class="audit-tabs" role="tablist" aria-label="Painéis de auditoria">
                  <button
                    type="button"
                    role="tab"
                    class="audit-tab ${this.auditTab === "history" ? "is-active" : ""}"
                    data-audit-tab="history"
                    aria-selected="${this.auditTab === "history"}"
                  >Histórico</button>
                  <button
                    type="button"
                    role="tab"
                    class="audit-tab ${this.auditTab === "metrics" ? "is-active" : ""}"
                    data-audit-tab="metrics"
                    aria-selected="${this.auditTab === "metrics"}"
                  >Métricas</button>
                </div>
                <div class="audit-panel__body" role="tabpanel">
                  ${this.auditTab === "history" ? historyHtml : metricsHtml}
                </div>`
              : `<p class="hint">Painel recolhido — clique em Expandir para ver histórico e métricas.</p>`
          }
        </section>
      </main>
    `;

    this.root.querySelector<HTMLButtonElement>('[data-action="record"]')?.addEventListener(
      "click",
      () => {
        void this.toggleRecord();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="reconnect"]')?.addEventListener(
      "click",
      () => {
        void this.reconnectMic();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="devices"]')?.addEventListener(
      "click",
      () => {
        void this.refreshDevices();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="health"]')?.addEventListener(
      "click",
      () => {
        void this.refreshHealth();
      },
    );
    this.bindAuditControls();
  }
}

function classifySoft(err: unknown): CaptureError {
  if (err instanceof CaptureError) return err;
  return new CaptureError(
    "unknown",
    err instanceof Error ? err.message : "Falha de microfone.",
    true,
  );
}

function processAudioFromCognitive(
  res: CognitiveChatResponse,
  transcript: string,
): ProcessAudioResponse {
  const raw = res.consenso as Partial<ConsensoResult> | undefined;
  const consenso: ConsensoResult = {
    approved: raw?.approved ?? true,
    agreement_ratio: raw?.agreement_ratio ?? res.consensus_confidence ?? 0,
    final_text: raw?.final_text ?? res.gemini_response,
    votes: raw?.votes ?? [],
    hallucination_flags: raw?.hallucination_flags ?? [],
    duration_ms: raw?.duration_ms ?? 0,
    skipped: raw?.skipped ?? false,
    agent_latencies: raw?.agent_latencies ?? [],
  };
  return {
    transcript,
    transcription: transcript,
    response_text: res.response_text,
    gemini_response: res.gemini_response,
    consenso,
    consensus_confidence: res.consensus_confidence,
    audio_base64: "",
    audio_mime_type: "audio/mpeg",
    audio_url: res.audio_response_url,
    audio_response_url: res.audio_response_url,
    status: res.status,
    latency: {
      stt_ms: 0,
      agent_ms: res.duration_ms,
      consenso_ms: consenso.duration_ms,
      tts_ms: 0,
      total_ms: res.duration_ms,
      consenso_grounding_ms: 0,
      consenso_safety_tone_ms: 0,
      consenso_consistency_ms: 0,
      consenso_agents_ms: {},
    },
    meta: {
      request_id: res.request_id,
      pipeline_mode: "safe-mode-webspeech",
      use_mock_audio: false,
      stt_provider: "web-speech",
      tts_provider: "speechSynthesis",
      consenso_enabled: true,
      used_safe_fallback: res.used_safe_fallback,
      fallback_reason: res.fallback_reason ?? "client_safe_mode_webspeech",
      created_at: new Date().toISOString(),
      depin_attestation: null,
      cognitive_provider: res.cognitive_provider,
    },
  };
}

function micStatusBadge(status: MicStatus): string {
  return `<span class="mic-badge mic-badge--${status}" title="Estado do microfone">
    <i class="dot dot--${status === "active" ? "ok" : status === "blocked" ? "err" : "warn"}"></i>
    Mic ${escapeHtml(MIC_STATUS_LABEL[status])}
  </span>`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function apiConnectionBadge(health: HealthResponse | null): string {
  if (health) {
    const port = health.api_port ?? 8001;
    return `<span class="conn-badge conn-badge--online" title="GET /health ok → 127.0.0.1:${port}">
      <i class="dot dot--ok"></i>
      Backend ligado · :${port}
    </span>`;
  }
  return `<span class="conn-badge conn-badge--offline" title="Backend não responde em 127.0.0.1:8001">
    <i class="dot dot--err"></i>
    Backend desligado
  </span>`;
}

function connectionBanner(health: HealthResponse | null): string {
  if (health) {
    return `<p class="conn-banner conn-banner--ok" role="status">
      Ligado a <code>127.0.0.1:${health.api_port ?? 8001}</code>
      · cognitive <strong>${escapeHtml(health.cognitive_provider ?? "gemini")}</strong>
      · Gemini key ${health.has_valid_gemini_key ? "ok" : "em falta"}
    </p>`;
  }
  return `<p class="conn-banner conn-banner--err" role="status">
      Sem ligação ao FastAPI. Arranque o backend em <code>127.0.0.1:8001</code>
      (ex.: <code>backend\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload</code>).
    </p>`;
}

function cognitiveBadge(health: HealthResponse | null): string {
  const engine = health?.cognitive_provider ?? "gemini";
  const cls = engine === "gemini" ? "conn-badge--online" : "conn-badge--offline";
  return `<span class="conn-badge ${cls}" title="Motor cognitivo efetivo (Gemini-only)">
    cognitive: ${escapeHtml(engine)}
  </span>`;
}

function geminiKeyBadge(health: HealthResponse | null): string {
  if (!health) {
    return `<span class="conn-badge conn-badge--offline">GEMINI: —</span>`;
  }
  if (health.has_valid_gemini_key) {
    return `<span class="conn-badge conn-badge--online" title="GEMINI_API_KEY válida">
      <i class="dot dot--ok"></i>
      GEMINI: ok
    </span>`;
  }
  return `<span class="conn-badge conn-badge--offline" title="Defina GEMINI_API_KEY em backend/.env">
    <i class="dot dot--err"></i>
    GEMINI: em falta
  </span>`;
}

function geminiKeyWarning(health: HealthResponse | null): string {
  if (!health) {
    return `<p class="warn-banner" role="status">
      Backend desconectado. Execute <code>start_app.bat</code> ou
      <code>start_app.ps1</code> na raiz do repositório.
    </p>`;
  }
  if (health.has_valid_gemini_key === true || health.use_mock_audio === true) {
    return "";
  }
  const envPath = health.env_file?.trim() || "backend/.env";
  return `<p class="warn-banner warn-banner--key" role="status">
      <strong>GEMINI_API_KEY não carregada / inválida.</strong>
      Cole a chave neste ficheiro e reinicie o Uvicorn:<br/>
      <code>${escapeHtml(envPath)}</code><br/>
      Exemplo: <code>GEMINI_API_KEY=…</code> (sem aspas).<br/>
      Confirme com <code>GET /health</code> → <code>has_valid_gemini_key: true</code>.
      Sem chave em modo real, o pipeline usa fallback seguro.
    </p>`;
}

function toolHudBanner(result: ProcessAudioResponse | null, phase: UiPhase): string {
  const tools = result?.tools ?? [];
  if (!tools.length) {
    return "";
  }
  const executed = tools.filter((t) => t.executed).length;
  const blocked = tools.filter((t) => !t.approved).length;
  const names = tools.map((t) => t.name).join(", ");
  const live =
    phase === "validating" || phase === "responding"
      ? `<span class="flow-status__tool">Tool: ${escapeHtml(names)}</span>`
      : `<span class="flow-status__tool">Tools ${executed} ok${
          blocked ? ` · ${blocked} bloqueada(s)` : ""
        }</span>`;
  return live;
}

function toolsPanelHtml(result: ProcessAudioResponse): string {
  const tools = result.tools ?? [];
  if (!tools.length && !result.meta.tools_invoked) {
    return "";
  }
  if (!tools.length) {
    return `<div class="block" style="margin-top:1rem">
      <div class="block__label">Ferramentas</div>
      <p class="hint">Nenhuma tool nesta volta.</p>
    </div>`;
  }
  const rows = tools
    .map((t) => {
      const state = !t.approved
        ? `bloqueada${t.blocked_reason ? ` (${escapeHtml(t.blocked_reason)})` : ""}`
        : t.executed
          ? "executada"
          : "aprovada";
      return `<div class="vote">
        <span><strong>${escapeHtml(t.name)}</strong><br/>
        <small>${escapeHtml(t.result_preview ?? t.blocked_reason ?? "")}</small></span>
        <span>${state} · ${t.duration_ms} ms</span>
      </div>`;
    })
    .join("");
  return `<div class="block" style="margin-top:1rem">
    <div class="block__label">Ferramentas (Consenso-gated)</div>
    <p class="block__body">
      ${result.meta.tools_executed_count ?? tools.filter((t) => t.executed).length}
      executada(s) · ${tools.length} invocação(ões)
    </p>
    <div class="votes">${rows}</div>
  </div>`;
}

function renderCognitiveChatResult(
  last: CognitiveChatResponse | null,
  history: ChatHistoryItem[],
): string {
  const historyBlock =
    history.length === 0
      ? `<p class="hint">Histórico vazio — as voltas de chat e voz entram aqui.</p>`
      : `<div class="chat-history" aria-label="Histórico da conversa">
          ${history
            .map((m) => {
              const who = m.role === "user" ? "Você" : "Aether";
              const body =
                m.role === "user"
                  ? `<p class="block__body">${escapeHtml(m.content)}</p>`
                  : `<div class="gemini-reply md-frame">${renderMarkdown(m.content)}</div>`;
              return `<article class="chat-turn chat-turn--${escapeHtml(m.role)}">
                <div class="block__label">${who}</div>
                ${body}
              </article>`;
            })
            .join("")}
        </div>`;

  if (!last) {
    return `<div class="cognitive-result">${historyBlock}</div>`;
  }

  const ratio = last.consensus_confidence ?? last.consenso?.agreement_ratio ?? 0;
  const approved = last.consenso?.approved ?? false;
  const duration = last.duration_ms ?? last.consenso?.duration_ms ?? 0;

  return `<div class="cognitive-result">
    ${historyBlock}
    <div class="result-grid" style="margin-top:1rem">
      <div class="block">
        <div class="block__label">
          Última resposta Gemini
          <span class="status-pill status-pill--${escapeHtml(last.status)}">${escapeHtml(last.status)}</span>
          · ${escapeHtml(String(last.mode))} · ${escapeHtml(last.model)}
        </div>
        <div class="gemini-reply md-frame">
          ${renderMarkdown(last.gemini_response || last.response_text)}
        </div>
        ${
          last.used_safe_fallback
            ? `<p class="hint" style="margin-top:0.75rem">
                Fallback seguro${
                  last.fallback_reason
                    ? ` (${escapeHtml(last.fallback_reason)})`
                    : ""
                }.
              </p>`
            : ""
        }
      </div>
      <div class="block">
        <div class="block__label">Consenso Alfa · telemetria</div>
        <div class="confidence">
          <div class="confidence__head">
            <span>${approved ? "aprovado" : "rejeitado"}</span>
            <strong>${formatPercent(ratio)}</strong>
          </div>
          <div class="confidence__track" aria-hidden="true">
            <span
              class="confidence__fill"
              style="width:${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%"
            ></span>
          </div>
          <small class="hint">${formatMs(duration)} · motor ${escapeHtml(
            last.cognitive_provider,
          )}</small>
        </div>
        <p class="block__body" style="margin-top:0.75rem">
          acordo ${(ratio * 100).toFixed(0)}% ·
          ${last.consenso?.duration_ms ?? 0} ms consenso ·
          request ${escapeHtml(last.request_id.slice(0, 8))}…
        </p>
      </div>
    </div>
  </div>`;
}
