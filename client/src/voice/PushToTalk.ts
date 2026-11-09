/**
 * Push-to-Talk via Media Session / keyboard media keys / HUD control.
 *
 * Browser limits (documented for HUD help):
 * - Media Session `setActionHandler` works best when a MediaMetadata session is set
 *   and usually requires a prior user gesture; headphone "play/pause" mapping varies.
 * - `navigator.mediaSession` is unavailable in some desktop browsers / insecure contexts.
 * - Physical frame/earbud buttons often appear as MediaPlayPause or toggle mute —
 *   there is no universal Web API for proprietary headset HID PTT.
 * - Fallback: Space (when PTT mode + Live focused) and the HUD PTT button (press/release).
 */

export type PttMode = "hold_to_talk" | "toggle";

export interface PushToTalkOptions {
  mode?: PttMode;
  onActiveChange?: (active: boolean) => void;
  /** When true, Space toggles/holds PTT (ignored while typing in inputs). */
  spaceKey?: boolean;
}

export class PushToTalk {
  private mode: PttMode;
  private readonly onActiveChange?: (active: boolean) => void;
  private readonly spaceKey: boolean;
  private enabled = false;
  private active = false;
  private mediaBound = false;
  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private readonly onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);

  constructor(options: PushToTalkOptions = {}) {
    this.mode = options.mode ?? "hold_to_talk";
    this.onActiveChange = options.onActiveChange;
    this.spaceKey = options.spaceKey !== false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isActive(): boolean {
    return this.active;
  }

  setMode(mode: PttMode): void {
    this.mode = mode;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.setActive(false);
      this.unbindMedia();
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      return;
    }
    this.bindMedia();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  /** HUD press / release */
  press(): void {
    if (!this.enabled) return;
    if (this.mode === "toggle") {
      this.setActive(!this.active);
      return;
    }
    this.setActive(true);
  }

  release(): void {
    if (!this.enabled) return;
    if (this.mode === "hold_to_talk") {
      this.setActive(false);
    }
  }

  dispose(): void {
    this.setEnabled(false);
  }

  private setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.onActiveChange?.(active);
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }
    const isMedia =
      e.code === "MediaPlayPause" ||
      e.key === "MediaPlayPause" ||
      e.code === "MediaTrackNext" ||
      e.key === "AudioVolumeMute";
    const isSpace = this.spaceKey && (e.code === "Space" || e.key === " ");
    if (!isMedia && !isSpace) return;
    e.preventDefault();
    if (isMedia) {
      // Headphone/frame click → toggle mic gate (release-to-send style via toggle).
      if (down) this.setActive(!this.active);
      return;
    }
    if (this.mode === "toggle") {
      if (down) this.setActive(!this.active);
      return;
    }
    this.setActive(down);
  }

  private bindMedia(): void {
    if (this.mediaBound) return;
    const ms = navigator.mediaSession;
    if (!ms || typeof ms.setActionHandler !== "function") {
      return;
    }
    try {
      ms.metadata = new MediaMetadata({
        title: "Aether Vision PTT",
        artist: "Aether",
        album: "Live",
      });
      const toggle = () => {
        if (this.enabled) this.setActive(!this.active);
      };
      ms.setActionHandler("play", toggle);
      ms.setActionHandler("pause", toggle);
      ms.setActionHandler("stop", () => this.setActive(false));
      this.mediaBound = true;
    } catch {
      // Browser rejected Media Session handlers — HUD/Space still work.
      this.mediaBound = false;
    }
  }

  private unbindMedia(): void {
    const ms = navigator.mediaSession;
    if (!ms || typeof ms.setActionHandler !== "function") {
      this.mediaBound = false;
      return;
    }
    try {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("stop", null);
    } catch {
      // ignore
    }
    this.mediaBound = false;
  }
}
