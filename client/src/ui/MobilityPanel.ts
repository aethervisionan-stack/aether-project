/**
 * HUD controls for Copilot mode, hardware audio profile, PTT, GPS, notifications.
 * Local unlock: hardware / Open-Mic / PTT toggles stay enabled without Live connect.
 */

import { audioProfileLabel, cycleAudioProfile } from "../hardware/AudioProfile";
import { msg, t } from "../i18n";
import { toggleCopilotMode } from "../mobility/CopilotMode";
import type {
  AudioProfileKind,
  CopilotMode,
  MobilityConfig,
  NotificationActionView,
  PaceClass,
} from "../types/mobility";
import { DEFAULT_MOBILITY_CONFIG } from "../types/mobility";

export type MobilityNotify = (kind: "ok" | "warn" | "info" | "danger", text: string) => void;

export interface MobilityPanelHandlers {
  onConfigChange: (cfg: MobilityConfig) => void;
  onPttPress: () => void;
  onPttRelease: () => void;
  onEnableGps: () => void;
  onSavePlace: () => void;
  onNavRequest: () => void;
  onDemoNotification: () => void;
  onConfirmNotification: (id: string, reply: string | null) => void;
  onDismissNotification: (id: string) => void;
}

const ALWAYS_ENABLED = new Set([
  "copilot",
  "profile",
  "ptt-mode",
  "demo-notif",
  "clear-notif-hist",
]);

export class MobilityPanel {
  private config: MobilityConfig = { ...DEFAULT_MOBILITY_CONFIG };
  private pace: PaceClass | string = "steady";
  private notify: MobilityNotify | null = null;
  private handlers: MobilityPanelHandlers | null = null;
  private pending: NotificationActionView | null = null;
  private history: NotificationActionView[] = [];
  private unlockMode = true;
  private connected = false;
  private root!: HTMLElement;
  private statusEl!: HTMLElement;
  private pendingEl!: HTMLElement;
  private historyEl!: HTMLElement;
  private copilotBtn!: HTMLButtonElement;
  private profileBtn!: HTMLButtonElement;
  private pttToggleBtn!: HTMLButtonElement;
  private pttHoldBtn!: HTMLButtonElement;

  constructor(private readonly mount: HTMLElement) {
    this.renderShell();
  }

  setNotify(fn: MobilityNotify): void {
    this.notify = fn;
  }

  setHandlers(handlers: MobilityPanelHandlers): void {
    this.handlers = handlers;
  }

  setUnlockMode(unlocked: boolean): void {
    this.unlockMode = unlocked;
    this.applyEnabledState();
  }

  getConfig(): MobilityConfig {
    return { ...this.config };
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    this.applyEnabledState();
  }

  setPace(pace: PaceClass | string): void {
    this.pace = pace;
    this.renderStatus();
  }

  applyLocale(): void {
    const m = msg().mobility;
    this.profileBtn.title = m.profileTitle;
    this.pttToggleBtn.title = m.pttModeTitle;
    this.pttHoldBtn.title = m.pttHoldTitle;
    this.pttHoldBtn.textContent = m.ptt;
    const setBtn = (action: string, label: string) => {
      const btn = this.mount.querySelector(`[data-action="${action}"]`);
      if (btn) btn.textContent = label;
    };
    setBtn("gps", m.gps);
    setBtn("save-place", m.savePlace);
    setBtn("nav", m.navCue);
    setBtn("demo-notif", m.demoNotif);
    setBtn("clear-notif-hist", m.clearNotifHist);
    this.renderStatus();
    this.renderPending();
    this.renderHistory();
  }

  showNotificationAction(action: NotificationActionView, muted: boolean): void {
    this.pushHistory(action, muted ? "muted" : "pending");
    if (muted) {
      this.notify?.("info", t(msg().mobility.mutedAlert, { priority: action.priority }));
      return;
    }
    this.pending = action;
    this.renderPending();
    this.notify?.("warn", action.summary);
  }

  clearPending(): void {
    this.pending = null;
    this.renderPending();
  }

  private pushHistory(action: NotificationActionView, state: string): void {
    this.history = [{ ...action, summary: `[${state}] ${action.summary}` }, ...this.history].slice(
      0,
      12,
    );
    this.renderHistory();
  }

  private applyEnabledState(): void {
    this.root.querySelectorAll("button").forEach((btn) => {
      const el = btn as HTMLButtonElement;
      const action = el.dataset.action || "";
      if (el.dataset.keepEnabled === "true" || (this.unlockMode && ALWAYS_ENABLED.has(action))) {
        if (action === "ptt-hold") {
          el.disabled = !this.config.pttEnabled || (!this.connected && !this.unlockMode);
          return;
        }
        el.disabled = false;
        return;
      }
      if (action === "ptt-hold") {
        el.disabled = !this.config.pttEnabled || !this.connected;
        return;
      }
      el.disabled = !this.connected;
    });
    // PTT hold needs Live audio path — allow arming in unlock only when PTT mode on.
    if (this.unlockMode && this.config.pttEnabled) {
      this.pttHoldBtn.disabled = !this.connected;
    }
  }

  private renderShell(): void {
    const m = msg().mobility;
    this.mount.innerHTML = `
      <div class="mobility-panel" data-role="mobility-root">
        <div class="mobility-row mobility-hardware">
          <button type="button" class="secondary" data-action="copilot" data-keep-enabled="true">${escapeHtml(m.copilotOff)}</button>
          <button type="button" class="secondary" data-action="profile" data-keep-enabled="true" title="${escapeAttr(m.profileTitle)}">${escapeHtml(m.speaker)}</button>
          <button type="button" class="secondary" data-action="ptt-mode" data-keep-enabled="true" title="${escapeAttr(m.pttModeTitle)}">${escapeHtml(m.openMic)}</button>
          <button type="button" class="secondary ptt-hold" data-action="ptt-hold" disabled title="${escapeAttr(m.pttHoldTitle)}">${escapeHtml(m.ptt)}</button>
        </div>
        <div class="mobility-row">
          <button type="button" class="secondary" data-action="gps">${escapeHtml(m.gps)}</button>
          <button type="button" class="secondary" data-action="save-place">${escapeHtml(m.savePlace)}</button>
          <button type="button" class="secondary" data-action="nav">${escapeHtml(m.navCue)}</button>
          <button type="button" class="secondary" data-action="demo-notif" data-keep-enabled="true">${escapeHtml(m.demoNotif)}</button>
        </div>
        <p class="mobility-status" data-role="mobility-status"></p>
        <div class="mobility-pending" data-role="mobility-pending" hidden></div>
        <details class="mobility-history" data-role="mobility-history" open>
          <summary></summary>
          <ul data-role="notif-history-list"></ul>
          <button type="button" class="secondary" data-action="clear-notif-hist" data-keep-enabled="true">${escapeHtml(m.clearNotifHist)}</button>
        </details>
      </div>
    `;
    this.root = this.mount.querySelector("[data-role=mobility-root]")!;
    this.statusEl = this.mount.querySelector("[data-role=mobility-status]")!;
    this.pendingEl = this.mount.querySelector("[data-role=mobility-pending]")!;
    this.historyEl = this.mount.querySelector("[data-role=mobility-history]")!;
    this.copilotBtn = this.mount.querySelector("[data-action=copilot]")!;
    this.profileBtn = this.mount.querySelector("[data-action=profile]")!;
    this.pttToggleBtn = this.mount.querySelector("[data-action=ptt-mode]")!;
    this.pttHoldBtn = this.mount.querySelector("[data-action=ptt-hold]")!;

    this.copilotBtn.addEventListener("click", () => {
      const next: CopilotMode = toggleCopilotMode(this.config.copilotMode);
      this.patch({ copilotMode: next });
      this.notify?.(
        "ok",
        next === "copilot" ? msg().mobility.copilotOnToast : msg().mobility.assistantOnToast,
      );
    });
    this.profileBtn.addEventListener("click", () => {
      const next: AudioProfileKind = cycleAudioProfile(this.config.audioProfile);
      this.patch({ audioProfile: next, interruptionFilter: true });
      this.notify?.(
        "ok",
        t(msg().mobility.audioProfileToast, { profile: audioProfileLabel(next) }),
      );
    });
    this.pttToggleBtn.addEventListener("click", () => {
      const ptt = !this.config.pttEnabled;
      this.patch({ pttEnabled: ptt, openMic: !ptt });
      this.applyEnabledState();
      this.notify?.("info", ptt ? msg().mobility.pttOnToast : msg().mobility.openMicToast);
    });
    this.pttHoldBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.handlers?.onPttPress();
      this.pttHoldBtn.classList.add("is-active");
    });
    const release = () => {
      this.handlers?.onPttRelease();
      this.pttHoldBtn.classList.remove("is-active");
    };
    this.pttHoldBtn.addEventListener("pointerup", release);
    this.pttHoldBtn.addEventListener("pointerleave", release);
    this.pttHoldBtn.addEventListener("pointercancel", release);

    this.mount.querySelector("[data-action=gps]")!.addEventListener("click", () => {
      this.handlers?.onEnableGps();
    });
    this.mount.querySelector("[data-action=save-place]")!.addEventListener("click", () => {
      this.handlers?.onSavePlace();
    });
    this.mount.querySelector("[data-action=nav]")!.addEventListener("click", () => {
      this.handlers?.onNavRequest();
    });
    this.mount.querySelector("[data-action=demo-notif]")!.addEventListener("click", () => {
      // Local unlock: also seed history when Live is offline so the panel is actionable.
      if (!this.connected) {
        const demo: NotificationActionView = {
          id: `local_${Date.now()}`,
          source: "sms",
          title: "João",
          body: "Você vai se atrasar?",
          summary: "João asked if you'll be late. Reply that you arrive in 10 min?",
          suggested_reply: "I'll arrive in about 10 minutes.",
          awaiting_confirmation: true,
          priority: "normal",
          created_at: Date.now() / 1000,
        };
        this.showNotificationAction(demo, false);
      }
      this.handlers?.onDemoNotification();
    });
    this.mount.querySelector("[data-action=clear-notif-hist]")!.addEventListener("click", () => {
      this.history = [];
      this.renderHistory();
      this.notify?.("info", msg().mobility.notifHistCleared);
    });

    this.renderStatus();
    this.renderHistory();
    this.applyEnabledState();
  }

  private patch(partial: Partial<MobilityConfig>): void {
    this.config = { ...this.config, ...partial };
    this.renderStatus();
    this.handlers?.onConfigChange(this.config);
  }

  private renderStatus(): void {
    const m = msg().mobility;
    const mode = this.config.copilotMode === "copilot" ? m.modeCopilot : m.modeAssistant;
    const profile = audioProfileLabel(this.config.audioProfile);
    const mic = this.config.pttEnabled ? m.micPtt : m.micOpen;
    this.statusEl.textContent = t(m.statusLine, { mode, profile, mic, pace: this.pace });
    this.copilotBtn.textContent =
      this.config.copilotMode === "copilot" ? m.copilotOn : m.copilotOff;
    this.copilotBtn.classList.toggle("is-active", this.config.copilotMode === "copilot");
    this.profileBtn.textContent = profile;
    this.pttToggleBtn.textContent = this.config.pttEnabled ? m.pttMode : m.openMic;
    this.pttToggleBtn.classList.toggle("is-active", this.config.pttEnabled);
  }

  private renderPending(): void {
    if (!this.pending) {
      this.pendingEl.hidden = true;
      this.pendingEl.innerHTML = "";
      return;
    }
    const action = this.pending;
    const m = msg().mobility;
    this.pendingEl.hidden = false;
    this.pendingEl.innerHTML = `
      <p class="mobility-pending-summary">${escapeHtml(action.summary)}</p>
      <div class="mobility-row">
        <button type="button" data-action="confirm-notif" data-keep-enabled="true">${escapeHtml(m.confirmReply)}</button>
        <button type="button" class="secondary" data-action="dismiss-notif" data-keep-enabled="true">${escapeHtml(m.dismiss)}</button>
      </div>
    `;
    this.pendingEl.querySelector("[data-action=confirm-notif]")!.addEventListener("click", () => {
      this.pushHistory(action, "confirmed");
      this.handlers?.onConfirmNotification(action.id, action.suggested_reply);
      this.clearPending();
    });
    this.pendingEl.querySelector("[data-action=dismiss-notif]")!.addEventListener("click", () => {
      this.pushHistory(action, "dismissed");
      this.handlers?.onDismissNotification(action.id);
      this.clearPending();
    });
  }

  private renderHistory(): void {
    const m = msg().mobility;
    const summary = this.historyEl.querySelector("summary");
    if (summary) {
      summary.textContent = t(m.notifHistory, { count: this.history.length });
    }
    const list = this.historyEl.querySelector("[data-role=notif-history-list]");
    if (!list) return;
    if (!this.history.length) {
      list.innerHTML = `<li class="mobility-empty">${escapeHtml(m.notifEmpty)}</li>`;
      return;
    }
    list.innerHTML = this.history
      .map(
        (h) =>
          `<li><span class="mobility-hist-pri">${escapeHtml(h.priority)}</span> ${escapeHtml(h.summary)}</li>`,
      )
      .join("");
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
