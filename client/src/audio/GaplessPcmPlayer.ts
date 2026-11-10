/**
 * Gapless playback of incoming Gemini PCM chunks at 24 kHz.
 * Schedules AudioBufferSourceNodes with precise next-start timing.
 *
 * AnalyserNode sits on the live output graph (source → analyser → destination)
 * so HUD orbit can sample spectrum on rAF without a second silent PCM copy.
 */

import { createAnalyser, EMPTY_SPECTRUM, sampleAnalyser, type SpectrumBands } from "./SpectrumTap";

const PLAYBACK_RATE = 24_000;

export class GaplessPcmPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private queuedSources = 0;
  private analyser: AnalyserNode | null = null;
  private analyserWired = false;
  private freqBuf: Uint8Array | null = null;
  private readonly onDepth?: (depth: number) => void;

  constructor(options?: { onDepth?: (depth: number) => void }) {
    this.onDepth = options?.onDepth;
  }

  get queueDepth(): number {
    return this.queuedSources;
  }

  /** True while scheduled AI audio is still playing out. */
  get isPlaying(): boolean {
    return this.queuedSources > 0;
  }

  async ensureStarted(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: PLAYBACK_RATE });
      this.wireAnalyser(this.context);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    if (this.nextStartTime < this.context.currentTime) {
      this.nextStartTime = this.context.currentTime + 0.02;
    }
  }

  enqueuePcm16(pcm: ArrayBuffer): void {
    if (!this.context) {
      return;
    }
    if (!this.analyser) {
      this.wireAnalyser(this.context);
    }

    const int16 = new Int16Array(pcm.byteLength / 2);
    const view = new DataView(pcm);
    for (let i = 0; i < int16.length; i += 1) {
      int16[i] = view.getInt16(i * 2, true);
    }

    const audioBuffer = this.context.createBuffer(1, int16.length, PLAYBACK_RATE);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i += 1) {
      channel[i] = int16[i] / 0x8000;
    }

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    // Live tap: AnalyserNode is a zero-cost pass-through on the speaker path.
    if (this.analyser) {
      source.connect(this.analyser);
    } else {
      source.connect(this.context.destination);
    }

    const startAt = Math.max(this.nextStartTime, this.context.currentTime + 0.005);
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;
    this.queuedSources += 1;
    this.onDepth?.(this.queuedSources);

    source.onended = () => {
      this.queuedSources = Math.max(0, this.queuedSources - 1);
      this.onDepth?.(this.queuedSources);
    };
  }

  /** Sample playback FFT on the animation thread only. */
  sampleSpectrum(): SpectrumBands {
    return sampleAnalyser(this.analyser, this.freqBuf);
  }

  /** Drop scheduled future audio (model interruption / barge-in). */
  interrupt(): void {
    const prev = this.context;
    this.context = null;
    this.analyser = null;
    this.analyserWired = false;
    this.freqBuf = null;
    this.nextStartTime = 0;
    this.queuedSources = 0;
    this.onDepth?.(0);
    void prev?.close();
  }

  /** Alias for barge-in: abort playback and clear the synth/output queue. */
  clearOutputQueue(): void {
    this.interrupt();
  }

  stop(): void {
    this.interrupt();
  }

  private wireAnalyser(ctx: AudioContext): void {
    this.analyser = createAnalyser(ctx, 256);
    this.freqBuf = new Uint8Array(this.analyser.frequencyBinCount);
    if (!this.analyserWired) {
      this.analyser.connect(ctx.destination);
      this.analyserWired = true;
    }
  }
}

export { EMPTY_SPECTRUM };
