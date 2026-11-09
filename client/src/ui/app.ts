import {
  clearCheckoutQuery,
  clearSubscriberId,
  devUnlock,
  fetchBillingConfig,
  fetchEntitlement,
  formatEpochLocal,
  formatPrice,
  loadSubscriberId,
  readCheckoutReturn,
  resetSubscription,
  saveSubscriberId,
  shortenSubscriberId,
  startCheckout,
  type BillingConfig,
  type EntitlementStatus,
} from "../services/BillingService";
import { AudioVisualizer } from "../audio/AudioVisualizer";
import { LatencyMonitor } from "../audio/LatencyMonitor";
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

function canCheckout(cfg: BillingConfig | null): boolean {
  if (!cfg) {
    // Optimistic local-dev default so the CTA never vanishes if /billing/config flakes.
    return true;
  }
  return Boolean(cfg.stripe_configured || cfg.mock_checkout || cfg.dev_unlock_enabled);
}

export class ControlApp {
  private service: GeminiLiveService | null = null;
  private connected = false;
  private entitled = false;
  private billingConfig: BillingConfig | null = null;
  private statusEl!: HTMLElement;
  private accessEl!: HTMLElement;
  private accessMetaEl!: HTMLElement;
  private warnEl!: HTMLElement;
  private logEl!: HTMLElement;
  private livePanel!: HTMLElement;
  private subscribeSection!: HTMLElement;
  private connectBtn!: HTMLButtonElement;
  private disconnectBtn!: HTMLButtonElement;
  private subscribeBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private devBtn!: HTMLButtonElement;
  private processEl!: HTMLElement;
  private textInput!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private checkoutBusy = false;
  private vizCanvas!: HTMLCanvasElement;
  private latencyEl!: HTMLElement;
  private visualizer: AudioVisualizer | null = null;
  private latencyMonitor: LatencyMonitor | null = null;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `
      <h1 class="brand">Aether <span>Vision</span></h1>

      <section class="subscribe" data-role="subscribe">
        <h2 class="subscribe-title">Subscription</h2>
        <p class="subscribe-lede">Monthly access — card checkout, no wallet required.</p>
        <p class="access" data-role="access">Checking access…</p>
        <p class="access-meta" data-role="access-meta" hidden></p>
        <div class="controls subscribe-actions">
          <button type="button" class="subscribe-cta" data-action="subscribe">Subscribe</button>
          <button type="button" class="secondary" data-action="reset-sub">Reset subscription</button>
          <button type="button" class="secondary" data-action="dev-unlock">Simulate unlock</button>
        </div>
        <p class="process" data-role="process" hidden></p>
        <p class="tokenomics" data-role="tokenomics"></p>
      </section>

      <section class="live-panel" data-role="live-panel" hidden>
        <div class="controls">
          <button type="button" data-action="connect">Connect Live</button>
          <button type="button" class="secondary" data-action="disconnect" disabled>Disconnect</button>
        </div>
        <p class="connection" data-role="status" data-state="CLOSED">CLOSED</p>
        <div class="hud-telemetry" data-role="hud-telemetry">
          <canvas class="audio-viz" data-role="audio-viz" width="640" height="96" aria-label="Audio visualizer"></canvas>
          <p class="latency" data-role="latency">PING: — | AI: —</p>
        </div>
        <div class="warn" data-role="warn" hidden></div>
        <div class="text-row">
          <input type="text" placeholder="Type a message to Aether…" data-role="text" />
          <button type="button" class="secondary" data-action="send-text" disabled>Send</button>
        </div>
        <ul class="log" data-role="log"></ul>
      </section>
    `;

    this.subscribeSection = this.root.querySelector("[data-role=subscribe]")!;
    this.statusEl = this.root.querySelector("[data-role=status]")!;
    this.accessEl = this.root.querySelector("[data-role=access]")!;
    this.accessMetaEl = this.root.querySelector("[data-role=access-meta]")!;
    this.warnEl = this.root.querySelector("[data-role=warn]")!;
    this.logEl = this.root.querySelector("[data-role=log]")!;
    this.livePanel = this.root.querySelector("[data-role=live-panel]")!;
    this.connectBtn = this.root.querySelector("[data-action=connect]")!;
    this.disconnectBtn = this.root.querySelector("[data-action=disconnect]")!;
    this.subscribeBtn = this.root.querySelector("[data-action=subscribe]")!;
    this.resetBtn = this.root.querySelector("[data-action=reset-sub]")!;
    this.devBtn = this.root.querySelector("[data-action=dev-unlock]")!;
    this.processEl = this.root.querySelector("[data-role=process]")!;
    this.textInput = this.root.querySelector("[data-role=text]")!;
    this.sendBtn = this.root.querySelector("[data-action=send-text]")!;
    this.vizCanvas = this.root.querySelector("[data-role=audio-viz]")!;
    this.latencyEl = this.root.querySelector("[data-role=latency]")!;
    const tokenomicsEl = this.root.querySelector<HTMLElement>("[data-role=tokenomics]")!;

    // Never hide the payment block in Gen-1 local HUD.
    this.subscribeSection.hidden = false;
    this.subscribeBtn.hidden = false;
    this.subscribeBtn.disabled = false;

    this.connectBtn.addEventListener("click", () => void this.connect());
    this.disconnectBtn.addEventListener("click", () => void this.disconnect());
    this.subscribeBtn.addEventListener("click", () => void this.subscribe());
    this.resetBtn.addEventListener("click", () => void this.resetSubscriptionFlow());
    this.devBtn.addEventListener("click", () => void this.simulateUnlock());
    this.sendBtn.addEventListener("click", () => this.sendText());
    this.textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.sendText();
      }
    });

    void this.bootstrapBilling(tokenomicsEl);
  }

  private async bootstrapBilling(tokenomicsEl: HTMLElement): Promise<void> {
    try {
      this.billingConfig = await fetchBillingConfig();
      this.renderSubscribeCta();
      tokenomicsEl.textContent =
        `Card payments auto-split on Solana: ${Math.round(this.billingConfig.treasury_share * 100)}% treasury / ` +
        `${Math.round(this.billingConfig.burn_share * 100)}% burn` +
        (this.billingConfig.solana_mode === "stub" ? " (stub mode locally)." : ".");

      const localSim =
        this.billingConfig.dev_unlock_enabled || this.billingConfig.mock_checkout;
      const devTools =
        Boolean(this.billingConfig.dev_tools_enabled) || localSim;
      this.devBtn.hidden = !this.billingConfig.dev_unlock_enabled;
      // Keep Reset available under sk_test_ when BILLING_DEV_UNLOCK=true.
      this.resetBtn.hidden = !devTools;

      if (this.billingConfig.bypass_subscription_check) {
        tokenomicsEl.textContent =
          `${tokenomicsEl.textContent} Paywall bypassed for AI testing (BYPASS_SUBSCRIPTION_CHECK).`;
      } else if (!canCheckout(this.billingConfig)) {
        this.accessEl.textContent =
          "Billing API reachable but checkout flags are off — check BILLING_DEV_UNLOCK.";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Keep CTA visible even if /billing/config fails (mock path still attempted on click).
      this.billingConfig = {
        stripe_configured: false,
        stripe_mode: "off",
        mock_checkout: true,
        publishable_key: null,
        dev_unlock_enabled: true,
        dev_tools_enabled: true,
        bypass_subscription_check: false,
        solana_mode: "stub",
        treasury_share: 0.7,
        burn_share: 0.3,
        unit_amount_cents: 1,
        currency: "brl",
        interval: "month",
        temp_test: true,
      };
      this.renderSubscribeCta();
      this.devBtn.hidden = false;
      this.resetBtn.hidden = false;
      this.accessEl.textContent = `Billing config error (CTA still available): ${message}`;
      tokenomicsEl.textContent = "Local mock checkout enabled after config error.";
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

  private renderSubscribeCta(): void {
    this.subscribeSection.hidden = false;
    this.subscribeBtn.hidden = false;
    this.subscribeBtn.disabled = false;
    const cfg = this.billingConfig;
    if (!cfg) {
      this.subscribeBtn.textContent = "Subscribe";
      return;
    }
    const price = formatPrice(cfg.unit_amount_cents, cfg.currency);
    const mode = cfg.mock_checkout && !cfg.stripe_configured ? " (mock)" : "";
    this.subscribeBtn.textContent = `Subscribe — ${price}/mo${mode}`;
  }

  private async refreshEntitlement(): Promise<void> {
    // TEMP AI testing: unlock Live/chat without Stripe when backend flag is on.
    if (this.billingConfig?.bypass_subscription_check) {
      this.setEntitled(true);
      this.accessEl.textContent = "Access active — paywall bypassed for AI testing.";
      this.setAccessMeta("BYPASS_SUBSCRIPTION_CHECK=true · Stripe structure kept · set false to re-enable paywall");
      return;
    }

    const id = loadSubscriberId();
    if (!id) {
      this.setEntitled(false);
      this.clearAccessMeta();
      if (
        !this.accessEl.textContent?.startsWith("Billing") &&
        !this.accessEl.textContent?.startsWith("Checkout") &&
        !this.accessEl.textContent?.includes("config error")
      ) {
        this.accessEl.textContent = "Subscribe to unlock Live HUD + chat.";
      }
      return;
    }

    try {
      const status = await fetchEntitlement(id);
      const canonical = status.subscriber_id || id;
      saveSubscriberId(canonical);
      this.setEntitled(Boolean(status.active));
      this.renderAccessGate(status);
    } catch {
      this.setEntitled(false);
      this.accessEl.textContent = "Could not verify access — Subscribe remains available.";
      this.setAccessMeta(`Stored session ${shortenSubscriberId(id)} (verify failed)`);
    }
  }

  private renderAccessGate(status: EntitlementStatus): void {
    const shortId = shortenSubscriberId(status.subscriber_id);
    const until = formatEpochLocal(status.expires_at);
    const granted = formatEpochLocal(status.granted_at);
    const expired =
      status.expires_at != null &&
      Number.isFinite(status.expires_at) &&
      status.expires_at * 1000 < Date.now();

    if (status.active) {
      this.accessEl.textContent = "Access active — Live unlocked.";
      const parts = [
        status.source ? `source ${status.source}` : null,
        until ? `until ${until}` : null,
        granted ? `granted ${granted}` : null,
        `id ${shortId}`,
      ].filter(Boolean);
      this.setAccessMeta(parts.join(" · "));
      return;
    }

    if (expired) {
      this.accessEl.textContent = "Access expired — Subscribe again to unlock Live.";
      this.setAccessMeta(
        [until ? `expired ${until}` : null, status.source ? `was ${status.source}` : null, `id ${shortId}`]
          .filter(Boolean)
          .join(" · "),
      );
      return;
    }

    this.accessEl.textContent = "Subscribe to unlock Live HUD + chat.";
    this.setAccessMeta(`Stored session ${shortId} (inactive)`);
  }

  private setAccessMeta(text: string | null): void {
    if (!text) {
      this.clearAccessMeta();
      return;
    }
    this.accessMetaEl.hidden = false;
    this.accessMetaEl.textContent = text;
  }

  private clearAccessMeta(): void {
    this.accessMetaEl.hidden = true;
    this.accessMetaEl.textContent = "";
  }

  private setEntitled(active: boolean): void {
    this.entitled = active;
    this.livePanel.hidden = !active;
    // Keep payment CTA visible + clickable in local/mock so the button never “disappears”.
    this.subscribeSection.hidden = false;
    this.subscribeBtn.hidden = false;
    this.subscribeBtn.disabled = !canCheckout(this.billingConfig);
    this.renderSubscribeCta();
  }

  private setProcess(text: string | null): void {
    if (!text) {
      this.processEl.hidden = true;
      this.processEl.textContent = "";
      return;
    }
    this.processEl.hidden = false;
    this.processEl.textContent = text;
  }

  private async subscribe(): Promise<void> {
    if (this.checkoutBusy) {
      return;
    }
    this.checkoutBusy = true;
    this.subscribeBtn.disabled = true;
    this.subscribeBtn.textContent = "Processing…";
    this.setProcess("Opening checkout…");
    this.accessEl.textContent = "Starting checkout…";
    try {
      if (!canCheckout(this.billingConfig)) {
        throw new Error("Checkout unavailable (set Stripe keys or BILLING_DEV_UNLOCK=true).");
      }
      this.setProcess("POST /api/billing/checkout …");
      const session = await startCheckout();
      saveSubscriberId(session.id);
      const checkoutUrl = session.url;
      const isMock = Boolean(session.mock) || session.id.startsWith("cs_test_mock_");
      if (isMock) {
        this.setProcess(`Mock session ${session.id} — opening checkout return…`);
        this.accessEl.textContent = "Mock checkout — redirecting to confirm payment…";
        await new Promise((r) => window.setTimeout(r, 350));
        window.location.href = checkoutUrl;
        return;
      }
      this.setProcess("Redirecting to Stripe Checkout…");
      this.accessEl.textContent = "Redirecting to Stripe hosted Checkout…";
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("[aether:ui] subscribe/checkout failed", err);
      const message = err instanceof Error ? err.message : String(err);
      this.accessEl.textContent = `Checkout error: ${message}`;
      this.setProcess(`Checkout failed — ${message}`);
      this.subscribeBtn.disabled = false;
      this.checkoutBusy = false;
      this.renderSubscribeCta();
    }
  }

  private async resetSubscriptionFlow(): Promise<void> {
    this.resetBtn.disabled = true;
    this.setProcess("Resetting subscription — locking access…");
    try {
      await this.disconnect();
      await resetSubscription(loadSubscriberId());
      clearSubscriberId();
      if (this.billingConfig?.bypass_subscription_check) {
        // Paywall still bypassed — keep Live available for AI testing.
        await this.refreshEntitlement();
        this.setProcess("Local entitlement cleared; paywall bypass still active.");
      } else {
        this.setEntitled(false);
        this.clearAccessMeta();
        this.accessEl.textContent = "Blocked — Subscribe again to unlock.";
        this.setProcess("Subscription reset. HUD is locked.");
      }
      this.renderSubscribeCta();
    } catch (err) {
      // Still clear local state so the user is not stuck unlocked.
      clearSubscriberId();
      if (this.billingConfig?.bypass_subscription_check) {
        await this.refreshEntitlement();
        this.setProcess("Local lock skipped — paywall bypass active.");
      } else {
        this.setEntitled(false);
        this.clearAccessMeta();
        const message = err instanceof Error ? err.message : String(err);
        this.accessEl.textContent = `Reset forced locally (${message}).`;
        this.setProcess("Local lock applied.");
      }
    } finally {
      this.resetBtn.disabled = false;
    }
  }

  private async simulateUnlock(): Promise<void> {
    try {
      this.setProcess("Simulating unlock…");
      const status = await devUnlock();
      this.setEntitled(Boolean(status.active));
      this.renderAccessGate(status);
      this.setProcess(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.accessEl.textContent = message;
      this.setProcess(null);
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

    this.visualizer = new AudioVisualizer();
    this.visualizer.mount(this.vizCanvas);
    this.visualizer.start();

    this.service = new GeminiLiveService({
      onEvent: (event) => this.handleEvent(event),
      visualizer: this.visualizer,
    });
    this.latencyMonitor = new LatencyMonitor(this.latencyEl, this.service.telemetry);
    this.latencyMonitor.start();
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
      const hint = /websocket|network|failed to fetch|econnrefused/i.test(message)
        ? " Check backend :8000 and Vite /api proxy."
        : /mic|device|permission|NotFoundError|NotAllowedError/i.test(message)
          ? " Mic blocked — text chat may still work after a successful connect."
          : "";
      this.showWarn(`Connect Live failed: ${message}.${hint}`);
      await this.service.disconnect();
      this.service = null;
      this.teardownTelemetryHud();
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
    this.teardownTelemetryHud();
  }

  private teardownTelemetryHud(): void {
    this.latencyMonitor?.stop();
    this.latencyMonitor = null;
    this.visualizer?.dispose();
    this.visualizer = null;
    this.latencyEl.textContent = "PING: — | AI: —";
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
