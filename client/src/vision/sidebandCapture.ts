/**
 * Background vision sideband — optimized frames ~every 2s or on scene change.
 * Sends only essential visual deltas to the multimodal WS to save bandwidth.
 */

import { FrameCapture, type CapturedFrame } from "../multimodal/FrameCapture";

export interface SidebandCaptureOptions {
  /** Nominal interval between frames (ms). Default 2000. */
  intervalMs?: number;
  /** Mean absolute pixel delta (0–255) to force an early send. Default 14. */
  motionThreshold?: number;
  /** Max long edge for sideband JPEG. Default 480 (lighter than HUD share-frame). */
  maxEdge?: number;
  quality?: number;
  /** Prefer camera; falls back to display if camera denied and allowDisplayFallback. */
  preferCamera?: boolean;
  allowDisplayFallback?: boolean;
  onFrame?: (frame: CapturedFrame, meta: { delta: boolean; hash: string }) => void;
  onError?: (err: unknown) => void;
}

export class SidebandCapture {
  private readonly intervalMs: number;
  private readonly motionThreshold: number;
  private readonly preferCamera: boolean;
  private readonly allowDisplayFallback: boolean;
  private readonly capture: FrameCapture;
  private readonly onFrame?: SidebandCaptureOptions["onFrame"];
  private readonly onError?: SidebandCaptureOptions["onError"];
  private timer: number | null = null;
  private running = false;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private lastHash: string | null = null;
  private lastSample: Uint8Array | null = null;
  private lastSentAt = 0;

  constructor(options: SidebandCaptureOptions = {}) {
    this.intervalMs = options.intervalMs ?? 2000;
    this.motionThreshold = options.motionThreshold ?? 14;
    this.preferCamera = options.preferCamera !== false;
    this.allowDisplayFallback = options.allowDisplayFallback === true;
    this.capture = new FrameCapture({
      maxEdge: options.maxEdge ?? 480,
      quality: options.quality ?? 0.48,
    });
    this.onFrame = options.onFrame;
    this.onError = options.onError;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Start background capture (requires prior user gesture for camera/display). */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    try {
      this.stream = await this.acquireStream();
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.srcObject = this.stream;
      await video.play();
      this.video = video;
      this.running = true;
      this.timer = window.setInterval(() => void this.tick(), this.intervalMs);
      // Immediate first sample after settle.
      window.setTimeout(() => void this.tick(true), 120);
    } catch (err) {
      this.onError?.(err);
      this.stop();
      throw err;
    }
  }

  stop(): void {
    this.running = false;
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) {
        t.stop();
      }
      this.stream = null;
    }
    this.lastHash = null;
    this.lastSample = null;
  }

  /** One-shot capture via FrameCapture display picker (user gesture). */
  async captureDisplayOnce(): Promise<CapturedFrame> {
    return this.capture.captureDisplay();
  }

  private async acquireStream(): Promise<MediaStream> {
    if (this.preferCamera && navigator.mediaDevices?.getUserMedia) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 2, max: 5 },
          },
        });
      } catch (err) {
        if (!this.allowDisplayFallback) {
          throw err;
        }
      }
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("No camera/display capture API available");
    }
    return navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 2 },
      audio: false,
    });
  }

  private async tick(force = false): Promise<void> {
    if (!this.running || !this.video) {
      return;
    }
    try {
      const frame = this.capture.encodeCanvas(this.drawToCanvas(this.video));
      const sample = downsampleLuma(this.video, 32, 18);
      const hash = roughHash(sample);
      const motion = this.lastSample ? meanAbsDiff(this.lastSample, sample) : 999;
      this.lastSample = sample;

      const due = force || performance.now() - this.lastSentAt >= this.intervalMs;
      const changed = this.lastHash == null || hash !== this.lastHash || motion >= this.motionThreshold;
      if (!due && !changed) {
        return;
      }
      // Skip near-identical frames even if interval elapsed (bandwidth save).
      if (!force && this.lastHash === hash && motion < this.motionThreshold * 0.35) {
        return;
      }

      this.lastHash = hash;
      this.lastSentAt = performance.now();
      this.onFrame?.(frame, { delta: motion >= this.motionThreshold, hash });
    } catch (err) {
      this.onError?.(err);
    }
  }

  private drawToCanvas(video: HTMLVideoElement): HTMLCanvasElement {
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 360;
    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2d context unavailable");
    }
    ctx.drawImage(video, 0, 0, vw, vh);
    return canvas;
  }
}

function downsampleLuma(video: HTMLVideoElement, w: number, h: number): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return new Uint8Array(w * h);
  }
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const out = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    out[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }
  return out;
}

function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / n;
}

function roughHash(sample: Uint8Array): string {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(sample.length / 64));
  for (let i = 0; i < sample.length; i += step) {
    h ^= sample[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
