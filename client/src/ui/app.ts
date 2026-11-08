import { GeminiLiveService } from "../services/GeminiLiveService";
import type { LiveServerJsonEvent, TelemetrySnapshot } from "../types/live";

export class ControlApp {
  private service: GeminiLiveService | null = null;
  private connected = false;
  private hudEl!: HTMLElement;
  private logEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private connectBtn!: HTMLButtonElement;
  private disconnectBtn!: HTMLButtonElement;
  private textInput!: HTMLInputElement;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `
      <h1 class="brand">Aether <span>Vision</span></h1>
      <p class="lede">Live HUD audio bridge — mic PCM @ 16 kHz in, Gemini PCM @ 24 kHz out, FIFO capped at 1.5 s.</p>
      <div class="controls">
        <button type="button" data-action="connect">Connect Live</button>
        <button type="button" class="secondary" data-action="disconnect" disabled>Disconnect</button>
      </div>
      <div class="text-row">
        <input type="text" placeholder="Optional text turn…" data-role="text" />
        <button type="button" class="secondary" data-action="send-text" disabled>Send</button>
      </div>
      <div class="hud" data-role="hud">ws=NONE · rtt=— · fifo=0ms · discards=0 · playQ=0</div>
      <p class="status" data-role="status">Idle</p>
      <ul class="log" data-role="log"></ul>
      <p class="path-note">WebSocket path: <code>/api/ws/live</code> → Vite proxy → FastAPI <code>/ws/live</code></p>
    `;

    this.hudEl = this.root.querySelector("[data-role=hud]")!;
    this.logEl = this.root.querySelector("[data-role=log]")!;
    this.statusEl = this.root.querySelector("[data-role=status]")!;
    this.connectBtn = this.root.querySelector("[data-action=connect]")!;
    this.disconnectBtn = this.root.querySelector("[data-action=disconnect]")!;
    this.textInput = this.root.querySelector("[data-role=text]")!;
    const sendBtn = this.root.querySelector<HTMLButtonElement>("[data-action=send-text]")!;

    this.connectBtn.addEventListener("click", () => void this.connect());
    this.disconnectBtn.addEventListener("click", () => void this.disconnect());
    sendBtn.addEventListener("click", () => this.sendText());
    this.textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.sendText();
      }
    });
  }

  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    this.setStatus("Connecting…");
    this.connectBtn.disabled = true;

    this.service = new GeminiLiveService({
      onEvent: (event) => this.handleEvent(event),
    });
    this.service.telemetry.subscribe((snap) => this.renderHud(snap));

    try {
      await this.service.connect();
      this.connected = true;
      this.disconnectBtn.disabled = false;
      this.root.querySelector<HTMLButtonElement>("[data-action=send-text]")!.disabled = false;
      const mic = this.service.getMicLabel() ?? "default input";
      this.setStatus(`Live · mic: ${mic}`);
      this.pushLog(`connected ${this.service.getWsUrl()}`, "info");
    } catch (err) {
      this.connectBtn.disabled = false;
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(`Failed: ${message}`);
      this.pushLog(message, "error");
      await this.service.disconnect();
      this.service = null;
    }
  }

  private async disconnect(): Promise<void> {
    await this.service?.disconnect();
    this.service = null;
    this.connected = false;
    this.connectBtn.disabled = false;
    this.disconnectBtn.disabled = true;
    this.root.querySelector<HTMLButtonElement>("[data-action=send-text]")!.disabled = true;
    this.setStatus("Disconnected");
    this.pushLog("disconnected", "info");
  }

  private sendText(): void {
    const text = this.textInput.value.trim();
    if (!text || !this.service) {
      return;
    }
    this.service.sendText(text);
    this.pushLog(`you: ${text}`, "user");
    this.textInput.value = "";
  }

  private handleEvent(event: LiveServerJsonEvent): void {
    switch (event.type) {
      case "ready":
        this.pushLog(`ready model=${(event as { model?: string }).model ?? "?"}`, "info");
        break;
      case "user_transcript":
        this.pushLog(`user: ${(event as { text: string }).text}`, "user");
        break;
      case "aether_transcript":
        this.pushLog(`aether: ${(event as { text: string }).text}`, "aether");
        break;
      case "turn_complete":
        this.pushLog("turn_complete", "info");
        break;
      case "interrupted":
        this.pushLog("interrupted", "info");
        break;
      case "error":
        this.pushLog((event as { message: string }).message, "error");
        this.setStatus(`Error: ${(event as { message: string }).message}`);
        break;
      default:
        break;
    }
  }

  private renderHud(snap: TelemetrySnapshot): void {
    const rtt = snap.rttMs == null ? "—" : `${snap.rttMs.toFixed(0)}ms`;
    this.hudEl.textContent =
      `ws=${snap.wsState} · rtt=${rtt} · ` +
      `fifo=${snap.fifoDepthMs.toFixed(0)}ms · discards=${snap.fifoDiscardCount} · ` +
      `playQ=${snap.playbackQueueDepth}`;
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  private pushLog(text: string, kind: string): void {
    const li = document.createElement("li");
    li.dataset.kind = kind;
    li.textContent = text;
    this.logEl.prepend(li);
  }
}
