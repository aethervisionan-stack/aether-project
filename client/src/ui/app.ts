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
import { HeadsetCapture, listAudioInputs } from "../audio/capture";
import { playResponseAudio } from "../audio/playback";
import { renderMetricsPanel } from "./components/MetricsPanel";
import { renderSessionHistory } from "./components/SessionHistory";
import { escapeHtml, formatMs, formatPercent } from "./html";
import { renderMarkdown } from "./markdown";

/** Portuguese flow states for the Bluetooth headset control UI. */
type UiPhase = "idle" | "listening" | "validating" | "responding";
type AuditTab = "history" | "metrics";

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "Pronto",
  listening: "A escutar...",
  validating: "Validando no Consenso Alfa...",
  responding: "A responder...",
};

const HUD_CLIENT_ID = "default";

export class ControlApp {
  private readonly root: HTMLElement;
  private readonly capture = new HeadsetCapture();
  private phase: UiPhase = "idle";
  private health: HealthResponse | null = null;
  private lastResult: ProcessAudioResponse | null = null;
  private errorMessage: string | null = null;
  private devices: MediaDeviceInfo[] = [];
  private activeMicLabel: string | null = null;
  private healthTimer: number | null = null;
  private readonly healthPollMs = 4_000;

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
    await this.refreshAudit({ quiet: true });
    this.startHealthPolling();
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
    this.render();
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
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      this.devices = await listAudioInputs();
      this.errorMessage = null;
    } catch {
      this.errorMessage =
        "Permissão de microfone negada. Autorize o mic do headset Bluetooth no navegador.";
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
    this.errorMessage = null;
    try {
      // Uses the OS default input (Bluetooth headset when set as system default).
      await this.capture.start();
      this.activeMicLabel = this.capture.getActiveLabel();
      this.setPhase("listening");
    } catch {
      this.errorMessage =
        "Não foi possível abrir o microfone. Confirme o pareamento Bluetooth e a permissão do browser.";
      this.setPhase("idle");
    }
  }

  private async finishRecord(): Promise<void> {
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
      // Autoplay on OS default output / Bluetooth headset
      await playResponseAudio({
        audioUrl: result.audio_url ?? null,
        audioBase64: result.audio_base64,
        mimeType: result.audio_mime_type,
      });
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
          ${openaiKeyBadge(health)}
          ${geminiKeyBadge(health)}
          <span>áudio ${health?.use_mock_audio === false ? "real" : "mock"}</span>
          <span>STT ${health?.stt_provider ?? "—"}</span>
          <span>TTS ${health?.tts_provider ?? "—"}</span>
          <span>Consenso ${health?.consenso_enabled ? "ativo" : "off"}</span>
          <span>v${health?.version ?? "—"}</span>
        </div>

        ${connectionBanner(health)}
        ${openaiKeyWarning(health)}

        <div
          class="flow-status flow-status--${this.phase}"
          role="status"
          aria-live="assertive"
          data-phase="${this.phase}"
        >
          <span class="flow-status__pulse" aria-hidden="true"></span>
          <strong>${escapeHtml(phaseLabel)}</strong>
          ${
            this.activeMicLabel
              ? `<span class="flow-status__mic">mic: ${escapeHtml(this.activeMicLabel)}</span>`
              : `<span class="flow-status__mic">mic: entrada padrão do sistema</span>`
          }
          ${toolHudBanner(result, this.phase)}
        </div>

        <section class="panel" aria-labelledby="capture-title">
          <h2 id="capture-title">Headset Bluetooth</h2>
          <p class="hint">
            Pareie o fone no sistema operacional, selecione-o como entrada/saída padrão,
            depois grave um comando curto. O áudio sobe como
            <code>multipart/form-data</code> em <code>POST /process-audio</code>.
          </p>
          <div class="controls">
            <button
              type="button"
              class="btn-primary ${listening ? "is-recording" : ""}"
              data-action="record"
              ${busy ? "disabled" : ""}
            >
              ${
                listening
                  ? "Parar e enviar"
                  : this.phase === "validating"
                    ? "Validando no Consenso Alfa..."
                    : this.phase === "responding"
                      ? "A responder..."
                      : "Gravar com o headset"
              }
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
                        (result.meta.cognitive_provider ?? "openai") === "gemini"
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
      · cognitive <strong>${escapeHtml(health.cognitive_provider ?? "—")}</strong>
      · Gemini key ${health.has_valid_gemini_key ? "ok" : "em falta"}
      · OpenAI key ${health.has_valid_openai_key ? "ok" : "em falta"}
    </p>`;
  }
  return `<p class="conn-banner conn-banner--err" role="status">
      Sem ligação ao FastAPI. Arranque o backend em <code>127.0.0.1:8001</code>
      (ex.: <code>backend\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload</code>).
    </p>`;
}

function cognitiveBadge(health: HealthResponse | null): string {
  const engine = health?.cognitive_provider ?? "—";
  const cls =
    engine === "gemini" ? "conn-badge--online" : engine === "openai" ? "conn-badge--online" : "conn-badge--offline";
  return `<span class="conn-badge ${cls}" title="Motor cognitivo efetivo">
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

function openaiKeyBadge(health: HealthResponse | null): string {
  if (!health) {
    return `<span class="conn-badge conn-badge--offline">OPENAI_API_KEY: —</span>`;
  }
  if (health.has_valid_openai_key) {
    return `<span class="conn-badge conn-badge--online" title="Chave sk-… carregada de backend/.env">
      <i class="dot dot--ok"></i>
      OPENAI_API_KEY: ok
    </span>`;
  }
  return `<span class="conn-badge conn-badge--offline" title="Cole sk-… em backend/.env e reinicie o Uvicorn">
    <i class="dot dot--err"></i>
    OPENAI_API_KEY: em falta
  </span>`;
}

function openaiKeyWarning(health: HealthResponse | null): string {
  if (!health) {
    return `<p class="warn-banner" role="status">
      Backend desconectado. Execute <code>start_app.bat</code> ou
      <code>start_app.ps1</code> na raiz do repositório.
    </p>`;
  }
  const keyOk = health.has_valid_openai_key === true;
  if (keyOk) {
    return "";
  }
  const envPath = health.env_file?.trim() || "backend/.env";
  return `<p class="warn-banner warn-banner--key" role="status">
      <strong>OPENAI_API_KEY não carregada / inválida.</strong>
      Cole a chave (deve começar com <code>sk-</code>) neste ficheiro e reinicie o Uvicorn:<br/>
      <code>${escapeHtml(envPath)}</code><br/>
      Exemplo de linha: <code>OPENAI_API_KEY=sk-proj-…</code> (sem aspas).<br/>
      Confirme com <code>GET /health</code> → <code>has_valid_openai_key: true</code>.
      Enquanto estiver em falta, o pipeline usa fallback seguro (sem Whisper falso).
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
