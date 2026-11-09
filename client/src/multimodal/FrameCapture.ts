/**
 * Lightweight screen/image frame capture for multimodal Live ingestion.
 * Produces JPEG data URLs / base64 without touching the PCM flush loop.
 */

export interface CapturedFrame {
  mime: string;
  dataBase64: string;
  width: number;
  height: number;
  clientT: number;
}

export interface FrameCaptureOptions {
  /** Max long-edge pixels before encode. Default 720. */
  maxEdge?: number;
  /** JPEG quality 0–1. Default 0.56 (HUD context, not archival). */
  quality?: number;
}

export class FrameCapture {
  private readonly maxEdge: number;
  private readonly quality: number;

  constructor(options: FrameCaptureOptions = {}) {
    this.maxEdge = options.maxEdge ?? 720;
    this.quality = options.quality ?? 0.56;
  }

  /** Capture the current display (user gesture required by browsers). */
  async captureDisplay(): Promise<CapturedFrame> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 2 },
      audio: false,
    });
    try {
      const track = stream.getVideoTracks()[0];
      if (!track) {
        throw new Error("No video track from display capture");
      }
      const video = document.createElement("video");
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      // One frame settle.
      await new Promise((r) => window.setTimeout(r, 60));
      const frame = this.encodeVideoElement(video);
      track.stop();
      return frame;
    } finally {
      for (const t of stream.getTracks()) {
        t.stop();
      }
    }
  }

  /** Encode an existing canvas (e.g. HUD snapshot) to a JPEG frame. */
  encodeCanvas(canvas: HTMLCanvasElement): CapturedFrame {
    const { width, height } = this.fit(canvas.width, canvas.height);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    if (!ctx) {
      throw new Error("2d context unavailable");
    }
    ctx.drawImage(canvas, 0, 0, width, height);
    return this.fromCanvas(out);
  }

  private encodeVideoElement(video: HTMLVideoElement): CapturedFrame {
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 360;
    const { width, height } = this.fit(vw, vh);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2d context unavailable");
    }
    ctx.drawImage(video, 0, 0, width, height);
    return this.fromCanvas(canvas);
  }

  private fromCanvas(canvas: HTMLCanvasElement): CapturedFrame {
    const dataUrl = canvas.toDataURL("image/jpeg", this.quality);
    const comma = dataUrl.indexOf(",");
    const dataBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return {
      mime: "image/jpeg",
      dataBase64,
      width: canvas.width,
      height: canvas.height,
      clientT: performance.now(),
    };
  }

  private fit(w: number, h: number): { width: number; height: number } {
    const edge = Math.max(w, h);
    if (edge <= this.maxEdge) {
      return { width: w, height: h };
    }
    const scale = this.maxEdge / edge;
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
    };
  }
}
