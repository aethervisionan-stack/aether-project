/**
 * HUD controls for Copilot mode, hardware audio profile, PTT, GPS, notifications.
 */

import { audioProfileLabel, cycleAudioProfile } from "../hardware/AudioProfile";
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

export class MobilityPanel {
  private config: MobilityConfig = { ...DEFAULT_MOBILITY_CONFIG };
  private pace: PaceClass | string = "steady";
  private notify: MobilityNotify | null = null;
  private handlers: MobilityPanelHandlers | null = null;
  private pending: NotificationActionView | null = null;
  private root!: HTMLElement;
  private statusEl!: HTMLElement;
  private pendingEl!: HTMLElement;
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

  getConfig(): MobilityConfig {
    return { ...this.config };
  }

  setConnected(connected: boolean): void {
    this.root.querySelectorAll("button").forEach((btn) => {
      const el = btn as HTMLButtonElement;
      if (el.dataset.keepEnabled === "true") return;
      el.disabled = !connected;
    });
  }

  setPace(pace: PaceClass | string): void {
    this.pace = pace;
    this.renderStatus();
  }

  showNotificationAction(action: NotificationActionView, muted: boolean): void {
    if (muted) {
      this.notify?.("info", `Muted secondary alert (${action.priority})`);
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

  private renderShell(): void {
    this.mount.innerHTML = `
      <div class="mobility-panel" data-role="mobility-root">
        <div class="mobility-row">
          <button type="button" class="secondary" data-action="copilot">COPILOT OFF</button>
          <button type="button" class="secondary" data-action="profile">SPEAKER</button>
          <button type="button" class="secondary" data-action="ptt-mode">OPEN MIC</button>
          <button type="button" class="secondary ptt-hold" data-action="ptt-hold" disabled title="Hold to talk (when PTT on)">PTT</button>
        </div>
        <div class="mobility-row">
          <button type="button" class="secondary" data-action="gps">GPS</button>
          <button type="button" class="secondary" data-action="save-place">Save place</button>
          <button type="button" class="secondary" data-action="nav">Nav cue</button>
          <button type="button" class="secondary" data-action="demo-notif">Demo notif</button>
        </div>
        <p class="mobility-status" data-role="mobility-status">Mode assistant · SPEAKER · open mic · pace steady</p>
        <div class="mobility-pending" data-role="mobility-pending" hidden></div>
      </div>
    `;
    this.root = this.mount.querySelector("[data-role=mobility-root]")!;
    this.statusEl = this.mount.querySelector("[data-role=mobility-status]")!;
    this.pendingEl = this.mount.querySelector("[data-role=mobility-pending]")!;
    this.copilotBtn = this.mount.querySelector("[data-action=copilot]")!;
    this.profileBtn = this.mount.querySelector("[data-action=profile]")!;
    this.pttToggleBtn = this.mount.querySelector("[data-action=ptt-mode]")!;
    this.pttHoldBtn = this.mount.querySelector("[data-action=ptt-hold]")!;

    this.copilotBtn.addEventListener("click", () => {
      const next: CopilotMode = toggleCopilotMode(this.config.copilotMode);
      this.patch({ copilotMode: next });
      this.notify?.(
        "ok",
        next === "copilot" ? "Copilot companionship mode on" : "Assistant mode on",
      );
    });
    this.profileBtn.addEventListener("click", () => {
      const next: AudioProfileKind = cycleAudioProfile(this.config.audioProfile);
      this.patch({ audioProfile: next, interruptionFilter: true });
      this.notify?.("ok", `Audio profile: ${audioProfileLabel(next)}`);
    });
    this.pttToggleBtn.addEventListener("click", () => {
      const ptt = !this.config.pttEnabled;
      this.patch({ pttEnabled: ptt, openMic: !ptt });
      this.pttHoldBtn.disabled = !ptt;
      this.notify?.(
        "info",
        ptt
          ? "Push-to-Talk on — hold PTT / Space / headset media key (browser limits apply)"
          : "Open mic + VAD on — no wake word",
      );
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
      this.handlers?.onDemoNotification();
    });

    this.renderStatus();
    this.setConnected(false);
  }

  private patch(partial: Partial<MobilityConfig>): void {
    this.config = { ...this.config, ...partial };
    this.renderStatus();
    this.handlers?.onConfigChange(this.config);
  }

  private renderStatus(): void {
    const mode = this.config.copilotMode === "copilot" ? "copilot" : "assistant";
    const profile = audioProfileLabel(this.config.audioProfile);
    const mic = this.config.pttEnabled ? "PTT" : "open mic";
    this.statusEl.textContent = `Mode ${mode} · ${profile} · ${mic} · pace ${this.pace}`;
    this.copilotBtn.textContent =
      this.config.copilotMode === "copilot" ? "COPILOT ON" : "COPILOT OFF";
    this.copilotBtn.classList.toggle("is-active", this.config.copilotMode === "copilot");
    this.profileBtn.textContent = profile;
    this.pttToggleBtn.textContent = this.config.pttEnabled ? "PTT MODE" : "OPEN MIC";
    this.pttToggleBtn.classList.toggle("is-active", this.config.pttEnabled);
  }

  private renderPending(): void {
    if (!this.pending) {
      this.pendingEl.hidden = true;
      this.pendingEl.innerHTML = "";
      return;
    }
    const action = this.pending;
    this.pendingEl.hidden = false;
    this.pendingEl.innerHTML = `
      <p class="mobility-pending-summary">${escapeHtml(action.summary)}</p>
      <div class="mobility-row">
        <button type="button" data-action="confirm-notif">Confirm reply</button>
        <button type="button" class="secondary" data-action="dismiss-notif">Dismiss</button>
      </div>
    `;
    this.pendingEl.querySelector("[data-action=confirm-notif]")!.addEventListener("click", () => {
      this.handlers?.onConfirmNotification(action.id, action.suggested_reply);
      this.clearPending();
    });
    this.pendingEl.querySelector("[data-action=dismiss-notif]")!.addEventListener("click", () => {
      this.handlers?.onDismissNotification(action.id);
      this.clearPending();
    });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
