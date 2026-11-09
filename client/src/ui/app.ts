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
import { AdvancedAudioVisualizer } from "../audio/AdvancedAudioVisualizer";
import { LatencyMonitor } from "../audio/LatencyMonitor";
import { GeminiLiveService } from "../services/GeminiLiveService";
import type { LiveServerJsonEvent, TelemetrySnapshot, WsReadyStateLabel } from "../types/live";
import { GuardrailIndicator } from "./GuardrailIndicator";
import { ToastHost } from "./ToastHost";
import { TranscriptFeed } from "./TranscriptFeed";
import { TreasuryWidget } from "./TreasuryWidget";

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
  private visualizer: AdvancedAudioVisualizer | null = null;
  private latencyMonitor: LatencyMonitor | null = null;
  private treasury: TreasuryWidget | null = null;
  private transcript: TranscriptFeed | null = null;
  private guardrail: GuardrailIndicator | null = null;
  private toasts = new ToastHost();
  private focusBtn!: HTMLButtonElement;
  private focusMode = false;
  private lastWsLabel: string | null = null;
  private treasuryToastArmed = false;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `
      <h1 class="brand">Aether <span>Vision</span></h1>

      <section class="subscribe glass" data-role="subscribe">
        <h2 class="subscribe-title">Subscription</h2>
        <p class="subscribe-lede">Monthly access — card checkout, no wallet required.</p>
        <p class="access is-loading skeleton" data-role="access">Checking access…</p>
        <p class="access-meta" data-role="access-meta" hidden></p>
        <div class="controls subscribe-actions">
          <button type="button" class="subscribe-cta" data-action="subscribe">Subscribe</button>
          <button type="button" class="secondary" data-action="reset-sub">Reset subscription</button>
          <button type="button" class="secondary" data-action="dev-unlock">Simulate unlock</button>
        </div>
        <p class="process" data-role="process" hidden></p>
        <div class="treasury-mount" data-role="treasury"></div>
      </section>

      <section class="live-panel glass" data-role="live-panel" hidden>
        <div class="live-toolbar">
          <div class="controls">
            <button type="button" data-action="connect">Connect Live</button>
            <button type="button" class="secondary" data-action="disconnect" disabled>Disconnect</button>
          </div>
          <button type="button" class="secondary focus-toggle" data-action="focus-toggle" aria-pressed="false">FOCUS</button>
        </div>
        <div class="live-status-row">
          <p class="connection" data-role="status" data-state="CLOSED">CLOSED</p>
          <p class="guardrail" data-role="guardrail">GUARDRAIL: SECURE</p>
        </div>
        <div class="hud-grid">
          <div class="hud-telemetry" data-role="hud-telemetry">
            <canvas class="audio-viz" data-role="audio-viz" width="640" height="110" aria-label="Advanced audio visualizer"></canvas>
            <p class="latency" data-role="latency">PING: — | AI: —</p>
          </div>
        </div>
        <div class="warn" data-role="warn" hidden></div>
        <div class="text-row">
          <input type="text" placeholder="Type a message to Aether…" data-role="text" />
          <button type="button" class="secondary" data-action="send-text" disabled>Send</button>
        </div>
        <div class="transcript-mount" data-role="transcript"></div>
      </section>
    `;

    this.subscribeSection = this.root.querySelector("[data-role=subscribe]")!;
    this.statusEl = this.root.querySelector("[data-role=status]")!;
    this.accessEl = this.root.querySelector("[data-role=access]")!;
    this.accessMetaEl = this.root.querySelector("[data-role=access-meta]")!;
    this.warnEl = this.root.querySelector("[data-role=warn]")!;
    this.livePanel = this.root.querySelector("[data-role=live-panel]")!;
    this.connectBtn = this.root.querySelector("[data-action=connect]")!;
    this.disconnectBtn = this.root.querySelector("[data-action=disconnect]")!;
    this.subscribeBtn = this.root.querySelector("[data-action=subscribe]")!;
    this.resetBtn = this.root.querySelector("[data-action=reset-sub]")!;
    this.devBtn = this.root.querySelector("[data-action=dev-unlock]")!;
    this.focusBtn = this.root.querySelector("[data-action=focus-toggle]")!;
    this.processEl = this.root.querySelector("[data-role=process]")!;
    this.textInput = this.root.querySelector("[data-role=text]")!;
    this.sendBtn = this.root.querySelector("[data-action=send-text]")!;
    this.vizCanvas = this.root.querySelector("[data-role=audio-viz]")!;
    this.latencyEl = this.root.querySelector("[data-role=latency]")!;
    const treasuryMount = this.root.querySelector<HTMLElement>("[data-role=treasury]")!;
    const transcriptMount = this.root.querySelector<HTMLElement>("[data-role=transcript]")!;
    const guardrailEl = this.root.querySelector<HTMLElement>("[data-role=guardrail]")!;

    this.treasury = new TreasuryWidget(treasuryMount);
    this.transcript = new TranscriptFeed(transcriptMount);
    this.guardrail = new GuardrailIndicator(guardrailEl);
    this.treasury.setStatusHandler((status) => {
      if (status.ok) {
        this.treasuryToastArmed = true;
        return;
      }
      if (!this.treasuryToastArmed && status.reconnecting) {
        // First paint may reconnect — wait for a settled failure/retry.
        this.treasuryToastArmed = true;
        return;
      }
      if (status.reconnecting || !status.online) {
        this.toasts.warn(status.error ? `Treasury RPC: ${status.error}` : "Treasury sync reconnecting…");
      }
    });

    // Never hide the payment block in Gen-1 local HUD.
    this.subscribeSection.hidden = false;
    this.subscribeBtn.hidden = false;
    this.subscribeBtn.disabled = false;

    this.connectBtn.addEventListener("click", () => void this.connect());
    this.disconnectBtn.addEventListener("click", () => void this.disconnect());
    this.subscribeBtn.addEventListener("click", () => void this.subscribe());
    this.resetBtn.addEventListener("click", () => void this.resetSubscriptionFlow());
    this.devBtn.addEventListener("click", () => void this.simulateUnlock());
    this.focusBtn.addEventListener("click", () => this.toggleFocusMode());
    this.sendBtn.addEventListener("click", () => this.sendText());
    this.textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.sendText();
      }
    });

    void this.bootstrapBilling();
  }

  private toggleFocusMode(force?: boolean): void {
    this.focusMode = force ?? !this.focusMode;
    this.root.classList.toggle("focus-mode", this.focusMode);
    this.focusBtn.setAttribute("aria-pressed", this.focusMode ? "true" : "false");
    this.focusBtn.textContent = this.focusMode ? "FOCUS ON" : "FOCUS";
    if (this.focusMode) {
      this.toasts.info("Focus mode — spectrogram + chat prioritized");
    }
  }

  private pulseButton(btn: HTMLButtonElement): void {
    btn.classList.remove("voice-pulse");
    // Force reflow so repeated pulses retrigger.
    void btn.offsetWidth;
    btn.classList.add("voice-pulse");
  }

  private setBusy(btn: HTMLButtonElement, busy: boolean, label?: string): void {
    btn.classList.toggle("is-busy", busy);
    if (label) {
      btn.dataset.label = btn.dataset.label || btn.textContent || "";
      btn.textContent = busy ? label : btn.dataset.label || btn.textContent || "";
      if (!busy) {
        delete btn.dataset.label;
      }
    }
  }

  private async bootstrapBilling(): Promise<void> {
    try {
      this.billingConfig = await fetchBillingConfig();
      this.renderSubscribeCta();
      this.treasury?.applyBillingConfig(this.billingConfig);
      this.treasury?.start();

      const localSim =
        this.billingConfig.dev_unlock_enabled || this.billingConfig.mock_checkout;
      const devTools =
        Boolean(this.billingConfig.dev_tools_enabled) || localSim;
      this.devBtn.hidden = !this.billingConfig.dev_unlock_enabled;
      // Keep Reset available under sk_test_ when BILLING_DEV_UNLOCK=true.
      this.resetBtn.hidden = !devTools;

      if (this.billingConfig.bypass_subscription_check) {
        // Access meta already covers bypass; treasury card stays independent.
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
        treasury_wallet: "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa",
        treasury_rpc_url: "https://api.mainnet-beta.solana.com",
        unit_amount_cents: 1,
        currency: "brl",
        interval: "month",
        temp_test: true,
      };
      this.renderSubscribeCta();
      this.devBtn.hidden = false;
      this.resetBtn.hidden = false;
      this.accessEl.textContent = `Billing config error (CTA still available): ${message}`;
      this.treasury?.applyBillingConfig(this.billingConfig);
      this.treasury?.start();
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
      this.accessEl.classList.remove("is-loading", "skeleton");
      this.accessEl.textContent = "Access active — paywall bypassed for AI testing.";
      this.setAccessMeta("BYPASS_SUBSCRIPTION_CHECK=true · Stripe structure kept · set false to re-enable paywall");
      return;
    }

    const id = loadSubscriberId();
    if (!id) {
      this.setEntitled(false);
      this.clearAccessMeta();
      this.accessEl.classList.remove("is-loading", "skeleton");
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
    this.accessEl.classList.remove("is-loading", "skeleton");
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
    this.pulseButton(this.subscribeBtn);
    this.setBusy(this.subscribeBtn, true, "Processing…");
    this.setProcess("Opening checkout…");
    this.accessEl.classList.remove("is-loading", "skeleton");
    this.accessEl.textContent = "Starting checkout…";
    this.toasts.info("Creating checkout session…");
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
      this.toasts.danger(`Checkout failed: ${message}`);
      this.subscribeBtn.disabled = false;
      this.setBusy(this.subscribeBtn, false);
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
      this.toasts.warn("Subscribe to unlock Live");
      return;
    }
    // Optimistic HUD feedback while WS opens.
    this.setConnection("CONNECTING");
    this.clearWarn();
    this.connectBtn.disabled = true;
    this.setBusy(this.connectBtn, true, "Connecting…");
    this.pulseButton(this.connectBtn);
    this.toasts.info("Opening Live bridge…");

    this.visualizer = new AdvancedAudioVisualizer();
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
      this.setBusy(this.connectBtn, false);
      this.setConnection("OPEN");
      this.guardrail?.reset();
      this.transcript?.clear();
      this.toasts.ok("Live connected");
      this.toggleFocusMode(true);

      if (result.micEnabled) {
        this.textInput.placeholder = "Type a message to Aether…";
        this.clearWarn();
      } else {
        const detail = result.micWarning ?? "Microphone unavailable.";
        this.textInput.placeholder = "Type to chat with Aether…";
        this.showWarn(`${detail} You can still chat by text.`);
        this.toasts.warn(detail);
        this.textInput.focus();
      }
    } catch (err) {
      this.connectBtn.disabled = false;
      this.setBusy(this.connectBtn, false);
      const message = err instanceof Error ? err.message : String(err);
      this.setConnection("CLOSED");
      const hint = /websocket|network|failed to fetch|econnrefused/i.test(message)
        ? " Check backend :8000 and Vite /api proxy."
        : /mic|device|permission|NotFoundError|NotAllowedError/i.test(message)
          ? " Mic blocked — text chat may still work after a successful connect."
          : "";
      this.showWarn(`Connect Live failed: ${message}.${hint}`);
      this.toasts.danger(`Connect failed: ${message}`);
      await this.service.disconnect();
      this.service = null;
      this.teardownTelemetryHud();
    }
  }

  private async disconnect(): Promise<void> {
    this.pulseButton(this.disconnectBtn);
    this.setBusy(this.disconnectBtn, true, "Closing…");
    await this.service?.disconnect();
    this.service = null;
    this.connected = false;
    this.connectBtn.disabled = false;
    this.disconnectBtn.disabled = true;
    this.setBusy(this.disconnectBtn, false);
    this.sendBtn.disabled = true;
    this.textInput.placeholder = "Type a message to Aether…";
    this.clearWarn();
    this.setConnection("CLOSED");
    this.teardownTelemetryHud();
    this.toggleFocusMode(false);
    this.toasts.info("Live disconnected");
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
    // Optimistic: show utterance immediately, pulse send, then fire WS.
    this.transcript?.push("user", text);
    this.textInput.value = "";
    this.pulseButton(this.sendBtn);
    this.service.sendText(text);
    if (!this.focusMode) {
      this.toggleFocusMode(true);
    }
  }

  private handleEvent(event: LiveServerJsonEvent): void {
    switch (event.type) {
      case "user_transcript":
        this.transcript?.push("user", (event as { text: string }).text);
        break;
      case "aether_transcript": {
        const ev = event as { text: string; guardrail?: string };
        if (ev.guardrail) {
          this.guardrail?.setStatus(ev.guardrail);
        } else {
          this.guardrail?.setStatus("secure");
        }
        this.transcript?.push("aether", ev.text, ev.guardrail);
        if (!this.focusMode) {
          this.toggleFocusMode(true);
        }
        break;
      }
      case "guardrail": {
        const status = (event as { status?: string }).status;
        this.guardrail?.setStatus(status);
        if (status === "blocked") {
          this.transcript?.push(
            "system",
            "Guardrail blocked an AI fragment (empty/corrupt after sanitize).",
            "blocked",
          );
          this.toasts.warn("Guardrail blocked a fragment");
        }
        break;
      }
      case "error": {
        const code = (event as { code?: string }).code;
        const message = (event as { message: string }).message;
        if (code !== "session_retry") {
          this.showWarn(message);
          this.toasts.danger(message);
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
    if (label !== this.lastWsLabel) {
      if (label === "RECONNECTING") {
        this.toasts.warn("WebSocket reconnecting…");
      } else if (label === "OPEN" && this.lastWsLabel === "RECONNECTING") {
        this.toasts.ok("WebSocket restored");
      } else if (label === "CLOSED" && this.lastWsLabel === "OPEN") {
        this.toasts.warn("WebSocket offline");
      }
      this.lastWsLabel = label;
    }
  }

  private showWarn(text: string): void {
    this.warnEl.hidden = false;
    this.warnEl.textContent = text;
  }

  private clearWarn(): void {
    this.warnEl.hidden = true;
    this.warnEl.textContent = "";
  }

}
