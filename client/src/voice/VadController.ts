/**
 * Advanced energy VAD for full-duplex open mic (no wake word).
 * Detects speech start (barge-in) and end-of-speech with hangover.
 */

export type VadPhase = "silence" | "speech" | "hangover";

export interface VadControllerOptions {
  /** RMS threshold 0–1 to enter speech. */
  startThreshold?: number;
  /** RMS threshold 0–1 to leave speech into hangover. */
  endThreshold?: number;
  /** Quiet ms before end-of-speech fires. */
  hangoverMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export class VadController {
  private readonly startThreshold: number;
  private readonly endThreshold: number;
  private readonly hangoverMs: number;
  private readonly onSpeechStart?: () => void;
  private readonly onSpeechEnd?: () => void;
  private phase: VadPhase = "silence";
  private quietSince = 0;
  private enabled = true;

  constructor(options: VadControllerOptions = {}) {
    this.startThreshold = options.startThreshold ?? 0.025;
    this.endThreshold = options.endThreshold ?? 0.015;
    this.hangoverMs = options.hangoverMs ?? 420;
    this.onSpeechStart = options.onSpeechStart;
    this.onSpeechEnd = options.onSpeechEnd;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.phase = "silence";
      this.quietSince = 0;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getPhase(): VadPhase {
    return this.phase;
  }

  /** Feed PCM 16-LE mono frame; returns true when speech is active (incl hangover). */
  pushPcm16(pcm: ArrayBuffer, now = performance.now()): boolean {
    if (!this.enabled) {
      return false;
    }
    const rms = pcmRms(pcm);
    if (this.phase === "silence") {
      if (rms >= this.startThreshold) {
        this.phase = "speech";
        this.quietSince = 0;
        this.onSpeechStart?.();
      }
      return this.phase !== "silence";
    }

    if (this.phase === "speech") {
      if (rms < this.endThreshold) {
        this.phase = "hangover";
        this.quietSince = now;
      }
      return true;
    }

    // hangover
    if (rms >= this.startThreshold) {
      this.phase = "speech";
      this.quietSince = 0;
      return true;
    }
    if (now - this.quietSince >= this.hangoverMs) {
      this.phase = "silence";
      this.onSpeechEnd?.();
      return false;
    }
    return true;
  }

  reset(): void {
    this.phase = "silence";
    this.quietSince = 0;
  }
}

function pcmRms(pcm: ArrayBuffer): number {
  const n = pcm.byteLength >> 1;
  if (n <= 0) return 0;
  const view = new DataView(pcm);
  let sum = 0;
  const step = Math.max(1, Math.floor(n / 64));
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const s = view.getInt16(i * 2, true) / 0x8000;
    sum += s * s;
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}
