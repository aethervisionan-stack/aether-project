import { voiceApi } from "../api/client";
import type { HealthResponse, ProcessAudioResponse } from "../api/types";
import { VoiceApiError } from "../api/types";
import { HeadsetCapture, listAudioInputs } from "../audio/capture";
import { playBase64Audio } from "../audio/playback";

type UiPhase = "idle" | "recording" | "processing" | "playing";

export class ControlApp {
  private readonly root: HTMLElement;
  private readonly capture = new HeadsetCapture();
  private phase: UiPhase = "idle";
  private health: HealthResponse | null = null;
  private lastResult: ProcessAudioResponse | null = null;
  private errorMessage: string | null = null;
  private devices: MediaDeviceInfo[] = [];

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
      // Permission prompt also unlocks device labels.
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
    if (this.phase === "recording") {
      await this.finishRecord();
      return;
    }
    if (this.phase !== "idle") {
      return;
    }
    this.errorMessage = null;
    try {
      await this.capture.start();
      this.setPhase("recording");
    } catch {
      this.errorMessage =
        "Não foi possível abrir o microfone. Confirme o pareamento Bluetooth e a permissão do browser.";
      this.setPhase("idle");
    }
  }

  private async finishRecord(): Promise<void> {
    this.setPhase("processing");
    try {
      const captured = await this.capture.stop();
      const result = await voiceApi.processAudio(captured.blob, {
        filename: `headset-${Date.now()}.webm`,
        locale: "pt-BR",
      });
      this.lastResult = result;
      this.setPhase("playing");
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
    const recording = this.phase === "recording";
    const busy = this.phase === "processing" || this.phase === "playing";

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
          <span>modo ${health?.pipeline_mode ?? "—"}</span>
          <span>STT ${health?.stt_provider ?? "—"}</span>
          <span>TTS ${health?.tts_provider ?? "—"}</span>
          <span>Consenso ${health?.consenso_enabled ? "ativo" : "off"}</span>
        </div>

        <section class="panel" aria-labelledby="capture-title">
          <h2 id="capture-title">Headset Bluetooth</h2>
          <p class="hint">
            Pareie o fone no sistema operacional, selecione-o como entrada/saída padrão,
            depois grave um comando curto. O áudio sobe para
            <code>POST /process-audio</code>.
          </p>
          <div class="controls">
            <button
              type="button"
              class="btn-primary ${recording ? "is-recording" : ""}"
              data-action="record"
              ${busy ? "disabled" : ""}
            >
              ${recording ? "Parar e enviar" : busy ? "Processando…" : "Gravar com o headset"}
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
                  </div>
                  <div class="block">
                    <div class="block__label">Consenso Alfa</div>
                    <p class="block__body">
                      ${result.consenso.approved ? "aprovado" : "rejeitado"} ·
                      acordo ${(result.consenso.agreement_ratio * 100).toFixed(0)}% ·
                      ${result.consenso.duration_ms} ms
                    </p>
                    <div class="votes">
                      ${result.consenso.votes
                        .map(
                          (v) => `<div class="vote">
                            <span><strong>${escapeHtml(v.agent_role)}</strong><br/><small>${escapeHtml(v.rationale)}</small></span>
                            <span>${v.approved ? "ok" : "no"} · ${v.score.toFixed(2)}</span>
                          </div>`,
                        )
                        .join("")}
                    </div>
                    <div class="latency" style="margin-top:1rem">
                      <div class="block__label">Latência total ${result.latency.total_ms} ms</div>
                      <div class="latency__bar"><span></span></div>
                      <small style="color:var(--muted)">
                        STT ${result.latency.stt_ms} · agente ${result.latency.agent_ms} ·
                        consenso ${result.latency.consenso_ms} · TTS ${result.latency.tts_ms}
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
