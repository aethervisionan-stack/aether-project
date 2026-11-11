/**
 * Continuous perception VAD manager — speech start/end + clean interruptibility.
 * Wraps energy VAD; when user speaks during AI playback, aborts the local player
 * and soft-restarts the outbound audio stream (no noisy cut / no WS tear-down).
 * Echo cancellation is requested via getUserMedia constraints (PcmCapture).
 */

import { BargeInController } from "../voice/BargeInController";
import { VadController, type VadPhase } from "../voice/VadController";

export type VadManagerPhase = VadPhase;

export interface VadManagerTargets {
  /** Abort GaplessPcmPlayer queue immediately. */
  abortPlayback: () => void;
  /** Soft-clear outbound PCM buffer / multimodal stream (keep WS). */
  resetOutboundAudio?: () => void;
  /** Notify Live bridge of barge-in. */
  notifyServer?: () => void;
  clearTokenStream?: () => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onBargeIn?: () => void;
}

export interface VadManagerOptions {
  startThreshold?: number;
  endThreshold?: number;
  hangoverMs?: number;
  /** Min ms between barge-in soft-restarts. */
  restartCooldownMs?: number;
}

export class VadManager {
  private readonly vad: VadController;
  private readonly bargeIn: BargeInController;
  private readonly targets: VadManagerTargets;
  private readonly restartCooldownMs: number;
  private enabled = true;
  private lastRestartAt = 0;

  constructor(targets: VadManagerTargets, options: VadManagerOptions = {}) {
    this.targets = targets;
    this.restartCooldownMs = options.restartCooldownMs ?? 120;
    this.vad = new VadController({
      startThreshold: options.startThreshold ?? 0.024,
      endThreshold: options.endThreshold ?? 0.014,
      hangoverMs: options.hangoverMs ?? 400,
      onSpeechStart: () => {
        this.handleSpeechStart();
        this.targets.onSpeechStart?.();
      },
      onSpeechEnd: () => {
        this.targets.onSpeechEnd?.();
      },
    });
    this.bargeIn = new BargeInController({
      interruptPlayback: () => this.targets.abortPlayback(),
      clearTokenStream: () => this.targets.clearTokenStream?.(),
      notifyServer: () => this.targets.notifyServer?.(),
      onBargeIn: () => this.targets.onBargeIn?.(),
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.vad.setEnabled(enabled);
    if (!enabled) {
      this.vad.reset();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getPhase(): VadManagerPhase {
    return this.vad.getPhase();
  }

  isSpeech(): boolean {
    return this.vad.getPhase() !== "silence";
  }

  markAssistantSpeaking(): void {
    this.bargeIn.markAssistantSpeaking();
  }

  markAssistantIdle(): void {
    this.bargeIn.markAssistantIdle();
  }

  isAssistantSpeaking(): boolean {
    return this.bargeIn.isAssistantSpeaking();
  }

  /** Feed mic PCM (16-LE). Safe to call from capture callback. */
  pushPcm16(pcm: ArrayBuffer, now = performance.now()): boolean {
    if (!this.enabled) {
      return false;
    }
    return this.vad.pushPcm16(pcm, now);
  }

  /** Force a clean barge-in (e.g. PTT press). */
  forceBargeIn(now = performance.now()): boolean {
    const fired = this.bargeIn.tryBargeIn(now);
    if (fired) {
      this.softRestartOutbound(now);
    }
    return fired;
  }

  reset(): void {
    this.vad.reset();
    this.bargeIn.markAssistantIdle();
  }

  private handleSpeechStart(): void {
    const now = performance.now();
    const fired = this.bargeIn.tryBargeIn(now);
    if (fired) {
      this.softRestartOutbound(now);
    }
  }

  private softRestartOutbound(now: number): void {
    if (now - this.lastRestartAt < this.restartCooldownMs) {
      return;
    }
    this.lastRestartAt = now;
    try {
      this.targets.resetOutboundAudio?.();
    } catch {
      // never block mic path
    }
  }
}
