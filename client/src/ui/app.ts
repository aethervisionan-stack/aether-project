import { voiceApi } from "../api/client";
import type { HealthResponse, ProcessAudioResponse } from "../api/types";
import { VoiceApiError } from "../api/types";
import { HeadsetCapture, listAudioInputs } from "../audio/capture";
import { playBase64Audio } from "../audio/playback";

/** Portuguese flow states for the Bluetooth headset control UI. */
type UiPhase = "idle" | "listening" | "validating" | "responding";

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "Pronto",
  listening: "A escutar...",
  validating: "Validando no Consenso Alfa...",
  responding: "A responder...",
};

export class ControlApp {
  private readonly root: HTMLElement;
  private readonly capture = new HeadsetCapture();
  private phase: UiPhase = "idle";
  private health: HealthResponse | null = null;
  private lastResult: ProcessAudioResponse | null = null;
  private errorMessage: string | null = null;
  private devices: MediaDeviceInfo[] = [];
  private activeMicLabel: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async mount(): Promise<void> {
    this.render();
    await this.refreshHealth();
  }

  private setPhase(phase: UiPhase): void {
    this.phase = phase;
    this.render();
  }

  private async refreshHealth(): Promise<void> {
    try {
      this.health = await voiceApi.health();
      this.errorMessage = null;
    } catch (err) {
      this.health = null;
      this.errorMessage =
        err instanceof VoiceApiError
          ? `${err.message} — ${err.detail}`
          : "Backend indisponível. Inicie o FastAPI em :8000.";
    }
    this.render();
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
      });
      this.lastResult = result;
      this.setPhase("responding");
      await playBase64Audio(result.audio_base64, result.audio_mime_type);
      this.setPhase("idle");
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

  private render(): void {
    const health = this.health;
    const result = this.lastResult;
    const listening = this.phase === "listening";
    const busy = this.phase === "validating" || this.phase === "responding";
    const phaseLabel = PHASE_LABEL[this.phase];

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
          <span>
            <i class="dot ${health ? "dot--ok" : "dot--err"}"></i>
            API ${health ? `ok · v${health.version}` : "offline"}
          </span>
          <span>áudio ${health?.use_mock_audio === false ? "real" : "mock"}</span>
          <span>STT ${health?.stt_provider ?? "—"}</span>
          <span>TTS ${health?.tts_provider ?? "—"}</span>
          <span>Consenso ${health?.consenso_enabled ? "ativo" : "off"}</span>
        </div>

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
                    <div class="block__label">Transcrição</div>
                    <p class="block__body">${escapeHtml(result.transcript)}</p>
                    <div class="block__label" style="margin-top:1rem">Resposta validada</div>
                    <p class="block__body">${escapeHtml(result.response_text)}</p>
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
                  </div>
                  <div class="block">
                    <div class="block__label">Consenso Alfa</div>
                    <p class="block__body">
                      ${result.consenso.approved ? "aprovado" : "rejeitado"} ·
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
                  </div>
                </div>`
              : `<p class="hint">Nenhuma captura ainda. Grave um teste com o headset.</p>`
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
  }
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
