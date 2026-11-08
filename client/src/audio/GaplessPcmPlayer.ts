/**
 * Gapless playback of incoming Gemini PCM chunks at 24 kHz.
 * Schedules AudioBufferSourceNodes with precise next-start timing.
 */

const PLAYBACK_RATE = 24_000;

export class GaplessPcmPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private queuedSources = 0;
  private readonly onDepth?: (depth: number) => void;

  constructor(options?: { onDepth?: (depth: number) => void }) {
    this.onDepth = options?.onDepth;
  }

  get queueDepth(): number {
    return this.queuedSources;
  }

  async ensureStarted(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: PLAYBACK_RATE });
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
    source.connect(this.context.destination);

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

  /** Drop scheduled future audio (model interruption). */
  interrupt(): void {
    // Recreate context to flush scheduled sources cleanly.
    const prev = this.context;
    this.context = null;
    this.nextStartTime = 0;
    this.queuedSources = 0;
    this.onDepth?.(0);
    void prev?.close();
  }

  stop(): void {
    this.interrupt();
  }
}
