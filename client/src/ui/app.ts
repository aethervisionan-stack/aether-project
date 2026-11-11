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
import { idleLatencyLine, LatencyMonitor } from "../audio/LatencyMonitor";
import { AetherVisualCoreHost } from "../components/aether-visual/AetherVisualCoreHost";
import { envDevUnlock, isFeatureUnlock } from "../dev/unlock";
import { classifyPace } from "../hardware/NotificationPriority";
import { initI18n, msg, onLocaleChange, t } from "../i18n";
import { GeoNavigation } from "../mobility/GeoNavigation";
import { parseProductivityLocal } from "../mobility/ProductivityVoice";
import { FrameCapture } from "../multimodal/FrameCapture";
import { ConfirmationLoop } from "../os/ConfirmationLoop";
import { playSuccessBeep } from "../os/SuccessBeep";
import { GeminiLiveService } from "../services/GeminiLiveService";
import type { LiveServerJsonEvent, TelemetrySnapshot, WsReadyStateLabel } from "../types/live";
import type { NotificationActionView } from "../types/mobility";
import { DevToolsPanel } from "./DevToolsPanel";
import { GuardrailIndicator } from "./GuardrailIndicator";
import { LanguageToggle } from "./LanguageToggle";
import { MemoryInspector } from "./MemoryInspector";
import { MobilityPanel } from "./MobilityPanel";
import { ToastHost } from "./ToastHost";
import { TranscriptFeed } from "./TranscriptFeed";
import { TreasuryWidget } from "./TreasuryWidget";

/** Generation-1 connection labels — no PCM/path/telemetry prose. */
function connectionLabel(state: WsReadyStateLabel): string {
  const c = msg().connection;
  switch (state) {
    case "OPEN":
      return c.open;
    case "RECONNECTING":
    case "CONNECTING":
      return c.reconnecting;
    case "CLOSING":
    case "CLOSED":
      return c.closed;
    default:
      return c.closed;
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
  private orbitHost!: HTMLElement;
  private latencyEl!: HTMLElement;
  private visualizer: AdvancedAudioVisualizer | null = null;
  private orbit: AetherVisualCoreHost | null = null;
  private latencyMonitor: LatencyMonitor | null = null;
  private treasury: TreasuryWidget | null = null;
  private transcript: TranscriptFeed | null = null;
  private guardrail: GuardrailIndicator | null = null;
  private memory: MemoryInspector | null = null;
  private mobility: MobilityPanel | null = null;
  private devTools: DevToolsPanel | null = null;
  private toasts = new ToastHost();
  private focusBtn!: HTMLButtonElement;
  private frameBtn!: HTMLButtonElement;
  private focusMode = false;
  private lastWsLabel: string | null = null;
  private treasuryToastArmed = false;
  private readonly frameCapture = new FrameCapture();
  private readonly geo = new GeoNavigation();
  private readonly confirmLoop = new ConfirmationLoop();

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    initI18n();
    // Optimistic local unlock: show Live HUD immediately (VITE_DEV_UNLOCK default on).
    const optimisticUnlock = envDevUnlock();
    const m = msg();
    this.root.innerHTML = `
      <div class="hud-topbar">
        <h1 class="brand">${m.brand.aether} <span>${m.brand.vision}</span></h1>
        <div class="lang-mount" data-role="lang"></div>
      </div>

      <section class="subscribe glass" data-role="subscribe">
        <h2 class="subscribe-title" data-i18n="subscribe.title">${m.subscribe.title}</h2>
        <p class="subscribe-lede" data-i18n="subscribe.lede">${m.subscribe.lede}</p>
        <p class="access is-loading skeleton" data-role="access">${m.subscribe.checking}</p>
        <p class="access-meta" data-role="access-meta" hidden></p>
        <div class="controls subscribe-actions">
          <button type="button" class="subscribe-cta" data-action="subscribe">${m.subscribe.cta}</button>
          <button type="button" class="secondary" data-action="reset-sub">${m.subscribe.reset}</button>
          <button type="button" class="secondary" data-action="dev-unlock">${m.subscribe.simulate}</button>
        </div>
        <p class="process" data-role="process" hidden></p>
        <div class="treasury-mount" data-role="treasury"></div>
      </section>

      <section class="live-panel glass" data-role="live-panel"${optimisticUnlock ? "" : " hidden"}>
        <div class="live-toolbar">
          <div class="controls">
            <button type="button" data-action="connect">${m.live.connect}</button>
            <button type="button" class="secondary" data-action="disconnect" disabled>${m.live.disconnect}</button>
            <button type="button" class="secondary" data-action="share-frame" disabled title="${m.live.frameTitle}">${m.live.frame}</button>
          </div>
          <div class="live-toolbar-right">
            <div class="memory-mount" data-role="memory"></div>
            <button type="button" class="secondary focus-toggle" data-action="focus-toggle" aria-pressed="false">${m.live.focus}</button>
          </div>
        </div>
        <div class="live-status-row">
          <p class="connection" data-role="status" data-state="CLOSED">${m.connection.closed}</p>
          <p class="guardrail" data-role="guardrail">${m.guardrail.prefix}: ${m.guardrail.secure}</p>
        </div>
        <div class="hud-grid">
          <div class="ai-orbit-stage" data-role="ai-orbit" aria-label="${m.live.vizLabel}"></div>
          <div class="hud-telemetry" data-role="hud-telemetry">
            <canvas class="audio-viz audio-viz--analysis" data-role="audio-viz" width="64" height="32" aria-hidden="true"></canvas>
            <p class="latency" data-role="latency">${m.latency.idle}</p>
          </div>
        </div>
        <div class="warn" data-role="warn" hidden></div>
        <div class="mobility-mount" data-role="mobility"></div>
        <div class="devtools-mount" data-role="devtools"></div>
        <div class="text-row">
          <input type="text" placeholder="${m.live.placeholder}" data-role="text" />
          <button type="button" class="secondary" data-action="send-text" disabled>${m.live.send}</button>
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
    this.frameBtn = this.root.querySelector("[data-action=share-frame]")!;
    this.processEl = this.root.querySelector("[data-role=process]")!;
    this.textInput = this.root.querySelector("[data-role=text]")!;
    this.sendBtn = this.root.querySelector("[data-action=send-text]")!;
    this.vizCanvas = this.root.querySelector("[data-role=audio-viz]")!;
    this.orbitHost = this.root.querySelector("[data-role=ai-orbit]")!;
    this.latencyEl = this.root.querySelector("[data-role=latency]")!;
    const langMount = this.root.querySelector<HTMLElement>("[data-role=lang]")!;
    const treasuryMount = this.root.querySelector<HTMLElement>("[data-role=treasury]")!;
    const transcriptMount = this.root.querySelector<HTMLElement>("[data-role=transcript]")!;
    const guardrailEl = this.root.querySelector<HTMLElement>("[data-role=guardrail]")!;
    const memoryMount = this.root.querySelector<HTMLElement>("[data-role=memory]")!;
    const mobilityMount = this.root.querySelector<HTMLElement>("[data-role=mobility]")!;
    const devtoolsMount = this.root.querySelector<HTMLElement>("[data-role=devtools]")!;

    this.orbit = new AetherVisualCoreHost();
    this.orbit.mount(this.orbitHost);
    this.orbit.start(() => this.readOrbitDrive());

    new LanguageToggle(langMount);
    this.treasury = new TreasuryWidget(treasuryMount);
    this.transcript = new TranscriptFeed(transcriptMount);
    this.guardrail = new GuardrailIndicator(guardrailEl);
    this.memory = new MemoryInspector(memoryMount);
    this.mobility = new MobilityPanel(mobilityMount);
    this.mobility.setUnlockMode(optimisticUnlock);
    this.devTools = new DevToolsPanel(devtoolsMount);
    this.mobility.setNotify((kind, text) => {
      if (kind === "ok") this.toasts.ok(text);
      else if (kind === "warn") this.toasts.warn(text);
      else if (kind === "danger") this.toasts.danger(text);
      else this.toasts.info(text);
    });
    this.devTools.setNotify((kind, text) => {
      if (kind === "ok") this.toasts.ok(text);
      else if (kind === "warn") this.toasts.warn(text);
      else if (kind === "danger") this.toasts.danger(text);
      else this.toasts.info(text);
    });
    this.mobility.setHandlers({
      onConfigChange: (cfg) => {
        this.service?.applyMobilityConfig(cfg);
      },
      onPttPress: () => this.service?.pttPress(),
      onPttRelease: () => this.service?.pttRelease(),
      onEnableGps: () => this.enableGps(),
      onSavePlace: () => this.saveGeoPlace(),
      onNavRequest: () => {
        this.service?.requestNavGuidance();
        this.toasts.info(msg().mobilityApp.requestingNav);
      },
      onDemoNotification: () => this.demoNotification(),
      onConfirmNotification: (id, reply) => {
        this.service?.confirmNotificationReply(id, reply);
        this.transcript?.push(
          "system",
          t(msg().mobilityApp.notifReplyConfirmed, {
            detail: reply ? `: ${reply}` : "",
          }),
        );
        this.toasts.ok(msg().mobilityApp.replyConfirmed);
      },
      onDismissNotification: (id) => {
        this.service?.dismissNotification(id);
        this.transcript?.push("system", t(msg().mobilityApp.notifDismissed, { id }));
      },
    });
    this.geo.setOnFix((fix) => {
      this.service?.sendGeoFix(fix);
      this.mobility?.setPace(classifyPace(fix.speed_mps ?? null));
    });
    this.memory.setNotify((notifyMsg) => {
      if (notifyMsg.kind === "ok") {
        this.toasts.ok(notifyMsg.text);
      } else if (notifyMsg.kind === "warn") {
        this.toasts.warn(notifyMsg.text);
      } else if (notifyMsg.kind === "danger") {
        this.toasts.danger(notifyMsg.text);
      } else {
        this.toasts.info(notifyMsg.text);
      }
    });
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
        this.toasts.warn(
          status.error ? `Treasury RPC: ${status.error}` : msg().treasury.treasuryReconnect,
        );
      }
    });

    onLocaleChange(() => this.applyLocale());

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
    this.frameBtn.addEventListener("click", () => void this.shareFrame());
    this.sendBtn.addEventListener("click", () => this.sendText());
    this.textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.sendText();
      }
    });

    if (optimisticUnlock) {
      this.entitled = true;
      this.livePanel.hidden = false;
      this.devBtn.hidden = false;
      this.resetBtn.hidden = false;
      void this.memory?.openPanel(true);
    }

    void this.bootstrapBilling();
  }

  private applyLocale(): void {
    const m = msg();
    const brand = this.root.querySelector(".brand");
    if (brand) {
      brand.innerHTML = `${m.brand.aether} <span>${m.brand.vision}</span>`;
    }
    const title = this.root.querySelector("[data-i18n='subscribe.title']");
    const lede = this.root.querySelector("[data-i18n='subscribe.lede']");
    if (title) title.textContent = m.subscribe.title;
    if (lede) lede.textContent = m.subscribe.lede;
    this.resetBtn.textContent = m.subscribe.reset;
    this.devBtn.textContent = m.subscribe.simulate;
    this.connectBtn.textContent = m.live.connect;
    this.disconnectBtn.textContent = m.live.disconnect;
    this.frameBtn.textContent = m.live.frame;
    this.frameBtn.title = m.live.frameTitle;
    this.focusBtn.textContent = this.focusMode ? m.live.focusOn : m.live.focus;
    this.sendBtn.textContent = m.live.send;
    this.vizCanvas.setAttribute("aria-label", m.live.vizLabel);
    if (!this.connected) {
      this.textInput.placeholder = m.live.placeholder;
      this.latencyEl.textContent = idleLatencyLine();
      this.statusEl.textContent = connectionLabel("CLOSED");
      this.statusEl.dataset.state = msg().connection.closed;
    } else {
      this.textInput.placeholder = m.live.placeholder;
    }
    this.renderSubscribeCta();
    void this.refreshEntitlement();
    this.latencyMonitor?.applyLocale();
    this.guardrail?.applyLocale();
    this.memory?.applyLocale();
    this.mobility?.applyLocale();
    this.devTools?.applyLocale();
    this.treasury?.applyLocale();
  }

  private toggleFocusMode(force?: boolean): void {
    this.focusMode = force ?? !this.focusMode;
    this.root.classList.toggle("focus-mode", this.focusMode);
    this.focusBtn.setAttribute("aria-pressed", this.focusMode ? "true" : "false");
    this.focusBtn.textContent = this.focusMode ? msg().live.focusOn : msg().live.focus;
    if (this.focusMode) {
      this.toasts.info(msg().live.focusToast);
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
    if (busy && label) {
      if (!btn.dataset.label) {
        btn.dataset.label = btn.textContent || "";
      }
      btn.textContent = label;
      return;
    }
    if (!busy && btn.dataset.label) {
      btn.textContent = btn.dataset.label;
      delete btn.dataset.label;
    }
  }

  private async bootstrapBilling(): Promise<void> {
    try {
      this.billingConfig = await fetchBillingConfig();
      this.renderSubscribeCta();
      this.treasury?.applyBillingConfig(this.billingConfig);
      this.treasury?.start();

      const unlocked = isFeatureUnlock(this.billingConfig);
      const localSim =
        this.billingConfig.dev_unlock_enabled || this.billingConfig.mock_checkout;
      const devTools =
        Boolean(this.billingConfig.dev_tools_enabled) || localSim || unlocked;
      this.devBtn.hidden = !(this.billingConfig.dev_unlock_enabled || unlocked);
      // Keep Reset available under sk_test_ when BILLING_DEV_UNLOCK=true.
      this.resetBtn.hidden = !devTools;
      this.mobility?.setUnlockMode(unlocked);
      if (unlocked) {
        void this.memory?.openPanel(true);
      }

      if (this.billingConfig.bypass_subscription_check || unlocked) {
        // Access meta already covers bypass; treasury card stays independent.
      } else if (!canCheckout(this.billingConfig)) {
        this.accessEl.textContent = msg().subscribe.billingFlagsOff;
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
        bypass_subscription_check: true,
        feature_unlock: true,
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
      this.mobility?.setUnlockMode(true);
      void this.memory?.openPanel(true);
      this.accessEl.textContent = t(msg().subscribe.billingConfigError, { message });
      this.treasury?.applyBillingConfig(this.billingConfig);
      this.treasury?.start();
    }

    const ret = readCheckoutReturn();
    if (ret.success && ret.sessionId) {
      saveSubscriberId(ret.sessionId);
      clearCheckoutQuery();
      this.accessEl.textContent = msg().subscribe.paymentReceived;
    } else if (ret.success) {
      clearCheckoutQuery();
    } else if (new URLSearchParams(window.location.search).get("checkout") === "cancel") {
      clearCheckoutQuery();
      this.accessEl.textContent = msg().subscribe.checkoutCanceled;
    }

    await this.refreshEntitlement();
  }

  private renderSubscribeCta(): void {
    this.subscribeSection.hidden = false;
    this.subscribeBtn.hidden = false;
    this.subscribeBtn.disabled = false;
    const cfg = this.billingConfig;
    const s = msg().subscribe;
    if (!cfg) {
      this.subscribeBtn.textContent = s.cta;
      return;
    }
    const price = formatPrice(cfg.unit_amount_cents, cfg.currency);
    const mode = cfg.mock_checkout && !cfg.stripe_configured ? s.ctaMock : "";
    this.subscribeBtn.textContent = t(s.ctaPrice, { price, mode });
  }

  private async refreshEntitlement(): Promise<void> {
    // Local unlock: Live/HUD/tools without Stripe when bypass / feature_unlock / VITE_DEV_UNLOCK.
    if (isFeatureUnlock(this.billingConfig)) {
      this.setEntitled(true);
      this.accessEl.classList.remove("is-loading", "skeleton");
      this.accessEl.textContent = msg().subscribe.accessActiveUnlock;
      this.setAccessMeta(
        this.billingConfig?.bypass_subscription_check
          ? msg().subscribe.accessMetaBypass
          : msg().subscribe.accessMetaDev,
      );
      return;
    }

    const id = loadSubscriberId();
    if (!id) {
      this.setEntitled(false);
      this.clearAccessMeta();
      this.accessEl.classList.remove("is-loading", "skeleton");
      const access = this.accessEl.textContent || "";
      const preserveAccess =
        /billing|checkout|config error|config de billing|erro na config|error de config/i.test(
          access,
        );
      if (!preserveAccess) {
        this.accessEl.textContent = msg().subscribe.accessSubscribe;
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
      this.accessEl.textContent = msg().subscribe.accessVerifyFailed;
      this.setAccessMeta(t(msg().subscribe.storedVerifyFailed, { id: shortenSubscriberId(id) }));
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
      this.accessEl.textContent = msg().subscribe.accessActiveLive;
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
      this.accessEl.textContent = msg().subscribe.accessExpired;
      this.setAccessMeta(
        [until ? `expired ${until}` : null, status.source ? `was ${status.source}` : null, `id ${shortId}`]
          .filter(Boolean)
          .join(" · "),
      );
      return;
    }

    this.accessEl.textContent = msg().subscribe.accessSubscribe;
    this.setAccessMeta(t(msg().subscribe.storedInactive, { id: shortId }));
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
    const s = msg().subscribe;
    this.checkoutBusy = true;
    this.subscribeBtn.disabled = true;
    this.pulseButton(this.subscribeBtn);
    this.setBusy(this.subscribeBtn, true, s.processing);
    this.setProcess(s.openingCheckout);
    this.accessEl.classList.remove("is-loading", "skeleton");
    this.accessEl.textContent = s.startingCheckout;
    this.toasts.info(s.creatingSession);
    try {
      if (!canCheckout(this.billingConfig)) {
        throw new Error(s.checkoutUnavailable);
      }
      this.setProcess(s.postCheckout);
      const session = await startCheckout();
      saveSubscriberId(session.id);
      const checkoutUrl = session.url;
      const isMock = Boolean(session.mock) || session.id.startsWith("cs_test_mock_");
      if (isMock) {
        this.setProcess(`Mock session ${session.id} — opening checkout return…`);
        this.accessEl.textContent = s.mockRedirect;
        await new Promise((r) => window.setTimeout(r, 350));
        window.location.href = checkoutUrl;
        return;
      }
      this.setProcess(s.stripeRedirect);
      this.accessEl.textContent = s.stripeRedirect;
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("[aether:ui] subscribe/checkout failed", err);
      const message = err instanceof Error ? err.message : String(err);
      this.accessEl.textContent = t(s.checkoutError, { message });
      this.setProcess(t(s.checkoutFailed, { message }));
      this.toasts.danger(t(s.checkoutFailed, { message }));
      this.subscribeBtn.disabled = false;
      this.setBusy(this.subscribeBtn, false);
      this.checkoutBusy = false;
      this.renderSubscribeCta();
    }
  }

  private async resetSubscriptionFlow(): Promise<void> {
    const s = msg().subscribe;
    this.resetBtn.disabled = true;
    this.setProcess(s.resetting);
    try {
      await this.disconnect();
      await resetSubscription(loadSubscriberId());
      clearSubscriberId();
      if (isFeatureUnlock(this.billingConfig)) {
        // Local unlock still active — keep Live / HUD available.
        await this.refreshEntitlement();
        this.setProcess(s.resetDoneUnlock);
      } else {
        this.setEntitled(false);
        this.clearAccessMeta();
        this.accessEl.textContent = s.accessBlocked;
        this.setProcess(s.resetDoneLocked);
      }
      this.renderSubscribeCta();
    } catch (err) {
      // Still clear local state so the user is not stuck unlocked.
      clearSubscriberId();
      if (isFeatureUnlock(this.billingConfig)) {
        await this.refreshEntitlement();
        this.setProcess(s.resetSkippedUnlock);
      } else {
        this.setEntitled(false);
        this.clearAccessMeta();
        const message = err instanceof Error ? err.message : String(err);
        this.accessEl.textContent = t(s.resetForced, { message });
        this.setProcess(s.resetLocalLock);
      }
    } finally {
      this.resetBtn.disabled = false;
    }
  }

  private async simulateUnlock(): Promise<void> {
    try {
      this.setProcess(msg().subscribe.simulating);
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
    const live = msg().live;
    if (!this.entitled) {
      this.showWarn(live.subscribeToUnlock);
      this.toasts.warn(live.subscribeToUnlock);
      return;
    }
    // Optimistic HUD feedback while WS opens.
    this.setConnection("CONNECTING");
    this.clearWarn();
    this.connectBtn.disabled = true;
    this.setBusy(this.connectBtn, true, live.connecting);
    this.pulseButton(this.connectBtn);
    this.toasts.info(live.openingBridge);

    // Analyser taps only (hidden canvas) — orbit is the visible AI presence.
    this.visualizer?.dispose();
    this.visualizer = new AdvancedAudioVisualizer();
    this.visualizer.mount(this.vizCanvas);

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
      this.frameBtn.disabled = false;
      this.sendBtn.disabled = false;
      this.setBusy(this.connectBtn, false);
      this.setConnection("OPEN");
      this.guardrail?.reset();
      this.transcript?.clear();
      this.mobility?.setConnected(true);
      if (this.mobility) {
        this.service.applyMobilityConfig(this.mobility.getConfig());
      }
      this.toasts.ok(live.connected);
      this.toggleFocusMode(true);

      if (result.micEnabled) {
        this.textInput.placeholder = live.placeholder;
        this.clearWarn();
      } else {
        const detail = result.micWarning ?? live.micUnavailable;
        this.textInput.placeholder = live.placeholderTextOnly;
        this.showWarn(t(live.textStillWorks, { detail }));
        this.toasts.warn(detail);
        this.textInput.focus();
      }
    } catch (err) {
      this.connectBtn.disabled = false;
      this.setBusy(this.connectBtn, false);
      const message = err instanceof Error ? err.message : String(err);
      this.setConnection("CLOSED");
      const hint = /websocket|network|failed to fetch|econnrefused/i.test(message)
        ? live.networkHint
        : /mic|device|permission|NotFoundError|NotAllowedError/i.test(message)
          ? live.micHint
          : "";
      this.showWarn(t(live.connectFailedDetail, { message, hint }));
      this.toasts.danger(t(live.connectFailed, { message }));
      await this.service.disconnect();
      this.service = null;
      this.teardownTelemetryHud();
    }
  }

  private async disconnect(): Promise<void> {
    const live = msg().live;
    this.pulseButton(this.disconnectBtn);
    this.setBusy(this.disconnectBtn, true, live.closing);
    await this.service?.disconnect();
    this.service = null;
    this.connected = false;
    this.connectBtn.disabled = false;
    this.disconnectBtn.disabled = true;
    this.frameBtn.disabled = true;
    this.setBusy(this.disconnectBtn, false);
    this.sendBtn.disabled = true;
    this.textInput.placeholder = live.placeholder;
    this.clearWarn();
    this.setConnection("CLOSED");
    this.mobility?.setConnected(false);
    this.mobility?.clearPending();
    this.geo.stopWatch();
    this.teardownTelemetryHud();
    this.toggleFocusMode(false);
    this.toasts.info(live.disconnected);
  }

  private enableGps(): void {
    const ok = this.geo.startWatch();
    if (!ok) {
      this.toasts.warn(msg().mobilityApp.geoUnavailable);
      return;
    }
    this.toasts.ok(msg().mobilityApp.gpsStarted);
    const fix = this.geo.getLastFix();
    if (fix) {
      this.service?.sendGeoFix(fix);
    }
  }

  private saveGeoPlace(): void {
    const place = this.geo.saveCurrentPlace(msg().mobilityApp.placeName, "saved");
    if (!place) {
      this.toasts.warn(msg().mobilityApp.noGpsFix);
      return;
    }
    this.service?.sendPlace(place);
    this.transcript?.push(
      "system",
      t(msg().mobilityApp.savedPlace, {
        name: place.name,
        lat: place.lat.toFixed(4),
        lon: place.lon.toFixed(4),
      }),
    );
    this.toasts.ok(msg().mobilityApp.placeSaved);
  }

  private demoNotification(): void {
    const raw = {
      source: "sms",
      sender: "João",
      title: "João",
      body: "Você vai se atrasar?",
      raw: "João: Você vai se atrasar?",
    };
    this.service?.sendRawNotification(raw);
    this.transcript?.push("system", msg().mobilityApp.demoSent);
  }

  private teardownTelemetryHud(): void {
    this.latencyMonitor?.stop();
    this.latencyMonitor = null;
    this.visualizer?.dispose();
    this.visualizer = null;
    this.latencyEl.textContent = idleLatencyLine();
  }

  /**
   * Drive AetherVisualCore (R3F island) from live WS / VAD / GaplessPcmPlayer analyser taps.
   * Maps playbackActive → isSpeaking, playLevel → audioIntensity (0–1).
   * Demo query still available: ?orbit=full|pulse|user (does not replace Live binding).
   */
  private readOrbitDrive() {
    const demo = new URLSearchParams(window.location.search).get("orbit");
    // Prefer real Live taps whenever the service exists (even with demo query for overlay tests).
    if (this.service && demo !== "pulse" && demo !== "user" && demo !== "full") {
      return this.service.getOrbitAudioSnapshot();
    }

    if (demo === "full" || demo === "pulse" || demo === "user") {
      const t = performance.now() / 1000;
      if (demo === "full") {
        return {
          wsOpen: true,
          vadSpeech: false,
          playbackActive: false,
          mode: "listening",
          micLevel: 0,
          playLevel: 0,
          bass: 0,
          mid: 0,
          treble: 0,
        };
      }
      if (demo === "user") {
        const e = 0.4 + 0.35 * Math.sin(t * 4.2);
        return {
          wsOpen: true,
          vadSpeech: true,
          playbackActive: false,
          mode: "listening",
          micLevel: e,
          playLevel: 0,
          bass: e * 0.6,
          mid: e * 0.5,
          treble: e * 0.4,
        };
      }
      // pulse = assistant undulation
      const voice = 0.36 + 0.22 * Math.sin(t * 1.4) + 0.1 * Math.sin(t * 2.6);
      return {
        wsOpen: true,
        vadSpeech: false,
        playbackActive: true,
        mode: "speaking",
        micLevel: 0.08,
        playLevel: voice,
        bass: 0.38 + 0.22 * Math.sin(t * 1.35),
        mid: 0.34 + 0.2 * Math.cos(t * 2.1),
        treble: 0.2 + 0.12 * Math.sin(t * 2.8),
      };
    }

    if (this.service) {
      return this.service.getOrbitAudioSnapshot();
    }

    const snap = this.visualizer?.getSpectrumSnapshot();
    const wsOpen = this.lastWsLabel === "OPEN";
    return {
      wsOpen,
      vadSpeech: false,
      playbackActive: false,
      mode: snap?.mode ?? "idle",
      micLevel: snap?.micLevel ?? 0,
      playLevel: snap?.playLevel ?? 0,
      bass: snap?.bass ?? 0,
      mid: snap?.mid ?? 0,
      treble: snap?.treble ?? 0,
    };
  }

  private async shareFrame(): Promise<void> {
    if (!this.service || !this.connected) {
      return;
    }
    this.frameBtn.disabled = true;
    this.pulseButton(this.frameBtn);
    try {
      const frame = await this.frameCapture.captureDisplay();
      this.service.sendFrame(frame);
      this.transcript?.push(
        "system",
        t(msg().mobilityApp.screenFrame, { width: frame.width, height: frame.height }),
      );
      this.toasts.ok(msg().mobilityApp.frameSent);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.toasts.warn(t(msg().mobilityApp.frameCapture, { message }));
    } finally {
      this.frameBtn.disabled = !this.connected;
    }
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
    const productivity = parseProductivityLocal(text);
    if (productivity.ok) {
      this.service.sendProductivityCommand(text);
    } else {
      this.service.sendText(text);
    }
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
          this.transcript?.push("system", msg().guardrail.blockedFragment, "blocked");
          this.toasts.warn(msg().guardrail.blockedToast);
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
      case "decision": {
        const ev = event as {
          complexity?: string;
          skipped_heavy?: boolean;
          preference_summary?: string;
          elapsed_ms?: number;
        };
        if (!ev.skipped_heavy) {
          const prefs = ev.preference_summary ? ` · prefs ${ev.preference_summary}` : "";
          this.transcript?.push(
            "system",
            t(msg().mobilityApp.cotLine, {
              complexity: ev.complexity ?? "complex",
              ms: Math.round(ev.elapsed_ms ?? 0),
              prefs,
            }),
          );
        }
        break;
      }
      case "tool_confirm_request": {
        const ev = event as {
          name?: string;
          pending_id?: string | null;
          speak?: string;
          action?: string | null;
        };
        this.confirmLoop.onConfirmRequest({
          type: "tool_confirm_request",
          name: ev.name ?? "tool",
          ok: true,
          pending_id: ev.pending_id,
          action: ev.action,
          speak: ev.speak,
          requires_confirmation: true,
        });
        const speak = ev.speak || `Confirm ${ev.name}?`;
        this.transcript?.push("system", speak);
        this.toasts.info(speak);
        break;
      }
      case "tool_result": {
        const ev = event as {
          name?: string;
          ok?: boolean;
          error?: string | null;
          result?: {
            status?: string;
            speak?: string;
            success_beep?: boolean;
            pending_id?: string;
          };
        };
        const status = ev.result?.status;
        if (status === "pending_confirmation") {
          // Mirrored confirm request already handled via tool_confirm_request.
          break;
        }
        if (status === "cancelled") {
          this.confirmLoop.clear();
          this.transcript?.push("system", ev.result?.speak || "Cancelado.");
          this.toasts.warn(ev.result?.speak || "Cancelado.");
          break;
        }
        const label = ev.ok ? "ok" : `fail ${ev.error ?? ""}`.trim();
        this.transcript?.push(
          "system",
          t(msg().mobilityApp.toolLine, { name: ev.name ?? "?", label }),
        );
        if (ev.result?.success_beep && ev.ok) {
          this.confirmLoop.clear();
          void playSuccessBeep();
          if (ev.result.speak) this.toasts.ok(ev.result.speak);
        }
        break;
      }
      case "notification_action": {
        const ev = event as {
          action?: NotificationActionView;
          muted?: boolean;
          level?: string;
          favorite?: boolean;
        };
        if (ev.action) {
          this.mobility?.showNotificationAction(ev.action, Boolean(ev.muted));
          if (!ev.muted) {
            const prefix = ev.favorite ? "★ " : "";
            const level = ev.level ? `[${ev.level}] ` : "";
            this.transcript?.push("system", `${prefix}${level}${ev.action.summary}`);
          }
        }
        break;
      }
      case "productivity_ack": {
        const ev = event as {
          intent?: { kind?: string; title?: string; ok?: boolean };
          memory_saved?: boolean;
        };
        if (ev.intent?.ok) {
          this.transcript?.push(
            "system",
            t(msg().mobilityApp.productivityLine, {
              kind: ev.intent.kind ?? "",
              title: ev.intent.title ?? "",
              memory: ev.memory_saved ? " · memory" : "",
            }),
          );
          this.toasts.ok(t(msg().mobilityApp.productivitySaved, { kind: ev.intent.kind ?? "" }));
        }
        break;
      }
      case "nav_guidance": {
        const ev = event as { ok?: boolean; steps?: string[] };
        if (ev.ok && ev.steps?.length) {
          this.transcript?.push("system", t(msg().mobilityApp.navLine, { step: ev.steps[0] }));
          this.toasts.info(ev.steps[0]);
        } else {
          this.toasts.warn(msg().mobilityApp.navUnavailable);
        }
        break;
      }
      case "priority_policy": {
        const pace = (event as { policy?: { pace?: string } }).policy?.pace;
        if (pace) this.mobility?.setPace(pace);
        break;
      }
      case "mobility_ack":
      case "token_delta":
      case "token_done":
      case "multimodal_ack":
      case "outbound_ack":
        // TTFT / multimodal / mobility acks feed LatencyTracker + buffers; no HUD spam.
        break;
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
    const c = msg().connection;
    this.statusEl.textContent = label;
    this.statusEl.dataset.state = label;
    if (label !== this.lastWsLabel) {
      if (label === c.reconnecting) {
        this.toasts.warn(c.wsReconnecting);
      } else if (label === c.open && this.lastWsLabel === c.reconnecting) {
        this.toasts.ok(c.wsRestored);
      } else if (label === c.closed && this.lastWsLabel === c.open) {
        this.toasts.warn(c.wsOffline);
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
