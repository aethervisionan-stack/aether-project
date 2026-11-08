/**
 * FIFO PCM retention buffer with a hard time cap (default 1.5s).
 *
 * On network micro-drops / slow sends, oldest frames are discarded so the
 * browser does not accumulate unbounded mic latency or memory.
 */

export interface FifoStats {
  queuedBytes: number;
  depthMs: number;
  discardCount: number;
  frameCount: number;
}

export class FifoRetentionBuffer {
  private readonly frames: Uint8Array[] = [];
  private queuedBytes = 0;
  private discardCount = 0;

  /**
   * @param maxMs Maximum retained audio duration
   * @param bytesPerSecond PCM byte rate (16-bit mono @ 16 kHz → 32_000)
   */
  constructor(
    private readonly maxMs: number = 1500,
    private readonly bytesPerSecond: number = 16_000 * 2,
  ) {}

  get maxBytes(): number {
    return Math.floor((this.bytesPerSecond * this.maxMs) / 1000);
  }

  push(frame: ArrayBuffer | Uint8Array): Uint8Array | null {
    const copy =
      frame instanceof Uint8Array
        ? frame.slice()
        : new Uint8Array(frame.slice(0));

    this.frames.push(copy);
    this.queuedBytes += copy.byteLength;
    this.trim();
    return copy;
  }

  /** Pop next frame for sending, or null if empty. */
  shift(): Uint8Array | null {
    const next = this.frames.shift();
    if (!next) {
      return null;
    }
    this.queuedBytes -= next.byteLength;
    return next;
  }

  clear(): void {
    this.frames.length = 0;
    this.queuedBytes = 0;
  }

  stats(): FifoStats {
    return {
      queuedBytes: this.queuedBytes,
      depthMs: this.bytesPerSecond
        ? (this.queuedBytes / this.bytesPerSecond) * 1000
        : 0,
      discardCount: this.discardCount,
      frameCount: this.frames.length,
    };
  }

  private trim(): void {
    const limit = this.maxBytes;
    while (this.queuedBytes > limit && this.frames.length > 0) {
      const dropped = this.frames.shift();
      if (!dropped) {
        break;
      }
      this.queuedBytes -= dropped.byteLength;
      this.discardCount += 1;
    }
  }
}
