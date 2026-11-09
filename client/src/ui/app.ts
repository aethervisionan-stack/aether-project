import { GeminiLiveService } from "../services/GeminiLiveService";
import type { LiveServerJsonEvent, TelemetrySnapshot, WsReadyStateLabel } from "../types/live";

/** Generation-1 connection labels — no PCM/path/telemetry prose. */
function connectionLabel(state: WsReadyStateLabel): string {
  switch (state) {
    case "OPEN":
      return "OPEN";
    case "RECONNECTING":
    case "CONNECTING":
      return "RECONNECTING";
    case "CLOSING":
    case "CLOSED":
      return "CLOSED";
    default:
      return "CLOSED";
  }
}

export class ControlApp {
  private service: GeminiLiveService | null = null;
  private connected = false;
  private statusEl!: HTMLElement;
  private warnEl!: HTMLElement;
  private logEl!: HTMLElement;
  private connectBtn!: HTMLButtonElement;
  private disconnectBtn!: HTMLButtonElement;
  private textInput!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `
      <h1 class="brand">Aether <span>Vision</span></h1>
      <div class="controls">
        <button type="button" data-action="connect">Connect Live</button>
        <button type="button" class="secondary" data-action="disconnect" disabled>Disconnect</button>
      </div>
      <p class="connection" data-role="status" data-state="CLOSED">CLOSED</p>
      <div class="warn" data-role="warn" hidden></div>
      <div class="text-row">
        <input type="text" placeholder="Type a message to Aether…" data-role="text" />
        <button type="button" class="secondary" data-action="send-text" disabled>Send</button>
      </div>
      <ul class="log" data-role="log"></ul>
    `;

    this.statusEl = this.root.querySelector("[data-role=status]")!;
    this.warnEl = this.root.querySelector("[data-role=warn]")!;
    this.logEl = this.root.querySelector("[data-role=log]")!;
    this.connectBtn = this.root.querySelector("[data-action=connect]")!;
    this.disconnectBtn = this.root.querySelector("[data-action=disconnect]")!;
    this.textInput = this.root.querySelector("[data-role=text]")!;
    this.sendBtn = this.root.querySelector("[data-action=send-text]")!;

    this.connectBtn.addEventListener("click", () => void this.connect());
    this.disconnectBtn.addEventListener("click", () => void this.disconnect());
    this.sendBtn.addEventListener("click", () => this.sendText());
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
    this.setConnection("CONNECTING");
    this.clearWarn();
    this.connectBtn.disabled = true;

    this.service = new GeminiLiveService({
      onEvent: (event) => this.handleEvent(event),
    });
    this.service.telemetry.subscribe((snap) => this.renderConnection(snap));

    try {
      const result = await this.service.connect();
      this.connected = true;
      this.disconnectBtn.disabled = false;
      this.sendBtn.disabled = false;
      this.setConnection("OPEN");

      if (result.micEnabled) {
        this.textInput.placeholder = "Type a message to Aether…";
        this.clearWarn();
      } else {
        const detail = result.micWarning ?? "Microphone unavailable.";
        this.textInput.placeholder = "Type to chat with Aether…";
        this.showWarn(`${detail} You can still chat by text.`);
        this.textInput.focus();
      }
    } catch (err) {
      this.connectBtn.disabled = false;
      const message = err instanceof Error ? err.message : String(err);
      this.setConnection("CLOSED");
      this.showWarn(message);
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
    this.sendBtn.disabled = true;
    this.textInput.placeholder = "Type a message to Aether…";
    this.clearWarn();
    this.setConnection("CLOSED");
  }

  private sendText(): void {
    const text = this.textInput.value.trim();
    if (!text || !this.service || !this.connected) {
      return;
    }
    this.service.sendText(text);
    this.pushLog(`you: ${text}`, "user");
    this.textInput.value = "";
  }

  private handleEvent(event: LiveServerJsonEvent): void {
    switch (event.type) {
      case "user_transcript":
        this.pushLog(`you: ${(event as { text: string }).text}`, "user");
        break;
      case "aether_transcript":
        this.pushLog(`aether: ${(event as { text: string }).text}`, "aether");
        break;
      case "error": {
        const code = (event as { code?: string }).code;
        const message = (event as { message: string }).message;
        if (code !== "session_retry") {
          this.showWarn(message);
        }
        break;
      }
      default:
        // Skip ready / turn_complete / interrupted / info noise in Gen-1 HUD.
        break;
    }
  }

  private renderConnection(snap: TelemetrySnapshot): void {
    if (!this.connected) {
      return;
    }
    this.setConnection(snap.wsState);
  }

  private setConnection(state: WsReadyStateLabel): void {
    const label = connectionLabel(state);
    this.statusEl.textContent = label;
    this.statusEl.dataset.state = label;
  }

  private showWarn(text: string): void {
    this.warnEl.hidden = false;
    this.warnEl.textContent = text;
  }

  private clearWarn(): void {
    this.warnEl.hidden = true;
    this.warnEl.textContent = "";
  }

  private pushLog(text: string, kind: string): void {
    const li = document.createElement("li");
    li.dataset.kind = kind;
    li.textContent = text;
    this.logEl.prepend(li);
  }
}
