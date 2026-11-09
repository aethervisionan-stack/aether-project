import {
  clearCheckoutQuery,
  devUnlock,
  fetchBillingConfig,
  fetchEntitlement,
  formatPrice,
  loadSubscriberId,
  readCheckoutReturn,
  saveSubscriberId,
  startCheckout,
  type BillingConfig,
} from "../services/BillingService";
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
  private entitled = false;
  private billingConfig: BillingConfig | null = null;
  private statusEl!: HTMLElement;
  private accessEl!: HTMLElement;
  private warnEl!: HTMLElement;
  private logEl!: HTMLElement;
  private livePanel!: HTMLElement;
  private connectBtn!: HTMLButtonElement;
  private disconnectBtn!: HTMLButtonElement;
  private subscribeBtn!: HTMLButtonElement;
  private textInput!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `
      <h1 class="brand">Aether <span>Vision</span></h1>

      <section class="subscribe" data-role="subscribe">
        <p class="subscribe-lede">Monthly access — card checkout, no wallet required.</p>
        <p class="access" data-role="access">Checking access…</p>
        <div class="controls">
          <button type="button" data-action="subscribe">Subscribe</button>
          <button type="button" class="secondary" data-action="dev-unlock" hidden>Simulate unlock</button>
        </div>
        <p class="tokenomics" data-role="tokenomics"></p>
      </section>

      <section class="live-panel" data-role="live-panel" hidden>
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
      </section>
    `;

    this.statusEl = this.root.querySelector("[data-role=status]")!;
    this.accessEl = this.root.querySelector("[data-role=access]")!;
    this.warnEl = this.root.querySelector("[data-role=warn]")!;
    this.logEl = this.root.querySelector("[data-role=log]")!;
    this.livePanel = this.root.querySelector("[data-role=live-panel]")!;
    this.connectBtn = this.root.querySelector("[data-action=connect]")!;
    this.disconnectBtn = this.root.querySelector("[data-action=disconnect]")!;
    this.subscribeBtn = this.root.querySelector("[data-action=subscribe]")!;
    this.textInput = this.root.querySelector("[data-role=text]")!;
    this.sendBtn = this.root.querySelector("[data-action=send-text]")!;
    const devBtn = this.root.querySelector<HTMLButtonElement>("[data-action=dev-unlock]")!;
    const tokenomicsEl = this.root.querySelector<HTMLElement>("[data-role=tokenomics]")!;

    this.connectBtn.addEventListener("click", () => void this.connect());
    this.disconnectBtn.addEventListener("click", () => void this.disconnect());
    this.subscribeBtn.addEventListener("click", () => void this.subscribe());
    devBtn.addEventListener("click", () => void this.simulateUnlock());
    this.sendBtn.addEventListener("click", () => this.sendText());
    this.textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.sendText();
      }
    });

    void this.bootstrapBilling(devBtn, tokenomicsEl);
  }

  private async bootstrapBilling(
    devBtn: HTMLButtonElement,
    tokenomicsEl: HTMLElement,
  ): Promise<void> {
    try {
      this.billingConfig = await fetchBillingConfig();
      const price = formatPrice(
        this.billingConfig.unit_amount_cents,
        this.billingConfig.currency,
      );
      this.subscribeBtn.textContent = `Subscribe — ${price}/mo`;
      tokenomicsEl.textContent =
        `Card payments auto-split on Solana: ${Math.round(this.billingConfig.treasury_share * 100)}% treasury / ` +
        `${Math.round(this.billingConfig.burn_share * 100)}% burn` +
        (this.billingConfig.solana_mode === "stub" ? " (stub mode locally)." : ".");
      devBtn.hidden = !this.billingConfig.dev_unlock_enabled;
      if (!this.billingConfig.stripe_configured && !this.billingConfig.dev_unlock_enabled) {
        this.subscribeBtn.disabled = true;
        this.accessEl.textContent = "Billing is not configured.";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.accessEl.textContent = `Billing unavailable: ${message}`;
    }

    const ret = readCheckoutReturn();
    if (ret.success && ret.sessionId) {
      saveSubscriberId(ret.sessionId);
      clearCheckoutQuery();
      this.accessEl.textContent = "Payment received — unlocking…";
    } else if (ret.success) {
      clearCheckoutQuery();
    } else if (new URLSearchParams(window.location.search).get("checkout") === "cancel") {
      clearCheckoutQuery();
      this.accessEl.textContent = "Checkout canceled.";
    }

    await this.refreshEntitlement();
  }

  private async refreshEntitlement(): Promise<void> {
    const id = loadSubscriberId();
    if (!id) {
      this.setEntitled(false);
      if (!this.accessEl.textContent?.startsWith("Billing") &&
          !this.accessEl.textContent?.startsWith("Checkout")) {
        this.accessEl.textContent = "Subscribe to unlock Live HUD + chat.";
      }
      return;
    }

    try {
      const status = await fetchEntitlement(id);
      if (status.active) {
        saveSubscriberId(status.subscriber_id || id);
        this.setEntitled(true);
        this.accessEl.textContent = "Access active";
      } else {
        this.setEntitled(false);
        this.accessEl.textContent = "Subscribe to unlock Live HUD + chat.";
      }
    } catch {
      this.setEntitled(false);
      this.accessEl.textContent = "Could not verify access.";
    }
  }

  private setEntitled(active: boolean): void {
    this.entitled = active;
    this.livePanel.hidden = !active;
    this.subscribeBtn.disabled = active
      ? true
      : !(this.billingConfig?.stripe_configured || this.billingConfig?.dev_unlock_enabled);
    if (active) {
      this.subscribeBtn.textContent = "Subscribed";
    } else if (this.billingConfig) {
      this.subscribeBtn.textContent = `Subscribe — ${formatPrice(
        this.billingConfig.unit_amount_cents,
        this.billingConfig.currency,
      )}/mo`;
    }
  }

  private async subscribe(): Promise<void> {
    this.subscribeBtn.disabled = true;
    try {
      if (!this.billingConfig?.stripe_configured) {
        throw new Error("Stripe is not configured on the server.");
      }
      const session = await startCheckout();
      window.location.href = session.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.accessEl.textContent = message;
      this.subscribeBtn.disabled = false;
    }
  }

  private async simulateUnlock(): Promise<void> {
    try {
      const status = await devUnlock();
      this.setEntitled(Boolean(status.active));
      this.accessEl.textContent = "Access active (local simulate)";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.accessEl.textContent = message;
    }
  }

  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (!this.entitled) {
      this.showWarn("Subscribe to unlock Live.");
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
