/**
 * Elegant barge-in: abort AI playback + clear synth queue the instant user speaks.
 * Wired into GaplessPcmPlayer / GeminiLiveService without touching TTFT markers.
 */

export interface BargeInTargets {
  interruptPlayback: () => void;
  clearTokenStream?: () => void;
  notifyServer?: () => void;
  onBargeIn?: () => void;
}

export class BargeInController {
  private speaking = false;
  private armed = true;
  private lastAt = 0;

  constructor(private readonly targets: BargeInTargets) {}

  /** Call when AI audio / transcript starts. */
  markAssistantSpeaking(): void {
    this.speaking = true;
    this.armed = true;
  }

  /** Call on turn_complete / interrupted from server. */
  markAssistantIdle(): void {
    this.speaking = false;
    this.armed = true;
  }

  isAssistantSpeaking(): boolean {
    return this.speaking;
  }

  /**
   * Invoke when VAD detects user speech start.
   * Returns true if barge-in fired (playback aborted).
   */
  tryBargeIn(now = performance.now()): boolean {
    if (!this.speaking || !this.armed) {
      return false;
    }
    // Debounce double-triggers from consecutive PCM frames.
    if (now - this.lastAt < 80) {
      return false;
    }
    this.lastAt = now;
    this.armed = false;
    this.speaking = false;
    try {
      this.targets.interruptPlayback();
    } catch {
      // never block mic path
    }
    try {
      this.targets.clearTokenStream?.();
    } catch {
      // ignore
    }
    try {
      this.targets.notifyServer?.();
    } catch {
      // ignore
    }
    try {
      this.targets.onBargeIn?.();
    } catch {
      // ignore
    }
    return true;
  }
}
