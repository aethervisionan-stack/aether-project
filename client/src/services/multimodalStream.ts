/**
 * Bidirectional low-latency multimodal stream coordinator.
 * Unifies PCM uplink + compressed video frames over the Live WebSocket
 * without blocking the HUD rAF / orbit path.
 *
 * Protocol (server also accepts legacy raw PCM):
 *  - Binary PCM: raw Int16 LE mono @ 16 kHz (lowest latency path)
 *  - Binary video: magic `AVF1` + mimeLen(u8) + mime + jpeg/png bytes
 *  - JSON: frame / telemetry / barge_in / control (existing)
 */

import type { CapturedFrame } from "../multimodal/FrameCapture";

export const AV_FRAME_MAGIC = "AVF1";

export type MultimodalSendBinary = (data: ArrayBuffer | Blob | ArrayBufferView) => void;
export type MultimodalSendJson = (payload: Record<string, unknown>) => void;

export interface MultimodalStreamOptions {
  sendBinary: MultimodalSendBinary;
  sendJson: MultimodalSendJson;
  /** Max outbound PCM chunks buffered while WS reconnects. Default 24 (~1s @ 40ms). */
  maxPcmBuffer?: number;
  /** Prefer binary AVF1 frames when true (default). Falls back to JSON base64. */
  preferBinaryVideo?: boolean;
  isSocketOpen: () => boolean;
  onTtftHint?: (ms: number | null) => void;
}

export interface MultimodalStreamStats {
  pcmSent: number;
  pcmBuffered: number;
  pcmDropped: number;
  framesSent: number;
  framesDropped: number;
  lastFrameAt: number | null;
  lastPcmAt: number | null;
}

export class MultimodalStream {
  private readonly sendBinary: MultimodalSendBinary;
  private readonly sendJson: MultimodalSendJson;
  private readonly maxPcmBuffer: number;
  private readonly preferBinaryVideo: boolean;
  private readonly isSocketOpen: () => boolean;
  private readonly onTtftHint?: (ms: number | null) => void;
  private pcmQueue: ArrayBuffer[] = [];
  private stats: MultimodalStreamStats = {
    pcmSent: 0,
    pcmBuffered: 0,
    pcmDropped: 0,
    framesSent: 0,
    framesDropped: 0,
    lastFrameAt: null,
    lastPcmAt: null,
  };
  private outboundMarkAt: number | null = null;

  constructor(options: MultimodalStreamOptions) {
    this.sendBinary = options.sendBinary;
    this.sendJson = options.sendJson;
    this.maxPcmBuffer = options.maxPcmBuffer ?? 24;
    this.preferBinaryVideo = options.preferBinaryVideo !== false;
    this.isSocketOpen = options.isSocketOpen;
    this.onTtftHint = options.onTtftHint;
  }

  getStats(): MultimodalStreamStats {
    return { ...this.stats, pcmBuffered: this.pcmQueue.length };
  }

  /** Enqueue / flush mic PCM. Never throws into capture callback. */
  pushPcm(pcm: ArrayBuffer | ArrayBufferView): void {
    const buffer =
      pcm instanceof ArrayBuffer
        ? pcm
        : Uint8Array.from(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)).buffer;
    if (!buffer.byteLength) {
      return;
    }
    if (this.isSocketOpen()) {
      this.flushPcmQueue();
      try {
        this.sendBinary(buffer);
        this.stats.pcmSent += 1;
        this.stats.lastPcmAt = performance.now();
        if (this.outboundMarkAt == null) {
          this.outboundMarkAt = this.stats.lastPcmAt;
        }
      } catch {
        this.bufferPcm(buffer);
      }
      return;
    }
    this.bufferPcm(buffer);
  }

  /** Push a JPEG/PNG frame (camera/screen). Prefer binary AVF1 envelope. */
  pushFrame(frame: CapturedFrame, meta?: { delta?: boolean; hash?: string }): void {
    if (!this.isSocketOpen()) {
      this.stats.framesDropped += 1;
      return;
    }
    try {
      if (this.preferBinaryVideo) {
        const bin = encodeAvFrameBinary(frame);
        this.sendBinary(bin);
      } else {
        this.sendJson({
          type: "frame",
          mime: frame.mime,
          data: frame.dataBase64,
          width: frame.width,
          height: frame.height,
          client_t: frame.clientT,
          delta: meta?.delta ?? false,
          hash: meta?.hash ?? null,
        });
      }
      // Also emit lightweight JSON sidecar for LatencyTracker / HUD ack path.
      this.sendJson({
        type: "frame_meta",
        mime: frame.mime,
        width: frame.width,
        height: frame.height,
        client_t: frame.clientT,
        delta: meta?.delta ?? false,
        hash: meta?.hash ?? null,
        bytes: Math.floor((frame.dataBase64.length * 3) / 4),
      });
      this.stats.framesSent += 1;
      this.stats.lastFrameAt = performance.now();
    } catch {
      this.stats.framesDropped += 1;
    }
  }

  /** Call after WS opens / reconnects to drain buffered PCM. */
  onSocketOpen(): void {
    this.flushPcmQueue();
  }

  /** Soft-reset outbound buffers after barge-in (keep WS). */
  resetOutboundAudio(): void {
    this.pcmQueue = [];
    this.outboundMarkAt = null;
    this.stats.pcmBuffered = 0;
  }

  /** First inbound AI audio after outbound → TTFT hint for LatencyTracker. */
  markFirstAudioIn(): void {
    if (this.outboundMarkAt == null) {
      return;
    }
    const ms = performance.now() - this.outboundMarkAt;
    this.outboundMarkAt = null;
    this.onTtftHint?.(ms);
  }

  clear(): void {
    this.pcmQueue = [];
    this.outboundMarkAt = null;
    this.stats.pcmBuffered = 0;
  }

  private bufferPcm(pcm: ArrayBuffer): void {
    this.pcmQueue.push(pcm.slice(0));
    while (this.pcmQueue.length > this.maxPcmBuffer) {
      this.pcmQueue.shift();
      this.stats.pcmDropped += 1;
    }
    this.stats.pcmBuffered = this.pcmQueue.length;
  }

  private flushPcmQueue(): void {
    if (!this.isSocketOpen() || this.pcmQueue.length === 0) {
      return;
    }
    const batch = this.pcmQueue.splice(0, this.pcmQueue.length);
    for (const chunk of batch) {
      try {
        this.sendBinary(chunk);
        this.stats.pcmSent += 1;
        this.stats.lastPcmAt = performance.now();
      } catch {
        this.bufferPcm(chunk);
        break;
      }
    }
    this.stats.pcmBuffered = this.pcmQueue.length;
  }
}

/** Encode CapturedFrame as AVF1 binary envelope for the Live bridge. */
export function encodeAvFrameBinary(frame: CapturedFrame): ArrayBuffer {
  const mime = (frame.mime || "image/jpeg").slice(0, 64);
  const mimeBytes = new TextEncoder().encode(mime);
  const raw = base64ToBytes(frame.dataBase64);
  const out = new Uint8Array(4 + 1 + mimeBytes.length + raw.length);
  out[0] = 0x41; // A
  out[1] = 0x56; // V
  out[2] = 0x46; // F
  out[3] = 0x31; // 1
  out[4] = mimeBytes.length;
  out.set(mimeBytes, 5);
  out.set(raw, 5 + mimeBytes.length);
  return out.buffer;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}
