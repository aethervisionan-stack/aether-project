/**
 * Manages the browser WebSocket to the FastAPI Live bridge.
 *
 * Default URL: `ws(s)://<page-host>/api/ws/live`
 * Vite proxies `/api` → `http://127.0.0.1:8000` (path rewritten, `ws: true`).
 */

import { FifoRetentionBuffer } from "../audio/FifoRetentionBuffer";
import { GaplessPcmPlayer } from "../audio/GaplessPcmPlayer";
import { PcmCapture } from "../audio/PcmCapture";
import { TelemetryMonitor } from "../audio/TelemetryMonitor";
import type { LiveServerJsonEvent, WsReadyStateLabel } from "../types/live";

export type LiveEventHandler = (event: LiveServerJsonEvent) => void;

export interface GeminiLiveServiceOptions {
  /** Absolute ws URL or path. Default: same-origin `/api/ws/live`. */
  url?: string;
  telemetry?: TelemetryMonitor;
  onEvent?: LiveEventHandler;
}

function resolveDefaultWsUrl(): string {
  const fromEnv = import.meta.env.VITE_LIVE_WS_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ws/live`;
}

function readyStateLabel(ws: WebSocket | null): WsReadyStateLabel {
  if (!ws) {
    return "NONE";
  }
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return "NONE";
  }
}

export class GeminiLiveService {
  readonly telemetry: TelemetryMonitor;
  private readonly url: string;
  private readonly onEvent?: LiveEventHandler;
  private readonly fifo = new FifoRetentionBuffer(1500, 16_000 * 2);
  private readonly capture = new PcmCapture();
  private readonly player: GaplessPcmPlayer;
  private ws: WebSocket | null = null;
  private flushTimer: number | null = null;
  private micLabel: string | null = null;

  constructor(options: GeminiLiveServiceOptions = {}) {
    this.url = options.url ?? resolveDefaultWsUrl();
    this.telemetry = options.telemetry ?? new TelemetryMonitor({ logToConsole: true });
    this.onEvent = options.onEvent;
    this.player = new GaplessPcmPlayer({
      onDepth: (depth) => this.telemetry.setPlaybackQueueDepth(depth),
    });
  }

  getMicLabel(): string | null {
    return this.micLabel;
  }

  getWsUrl(): string {
    return this.url;
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    await this.player.ensureStarted();

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      this.telemetry.setWsState("CONNECTING");

      ws.onopen = () => {
        this.telemetry.setWsState("OPEN");
        this.telemetry.startPingLoop((t) => {
          this.sendJson({ type: "ping", t });
        });
        resolve();
      };

      ws.onerror = () => {
        this.telemetry.setWsState(readyStateLabel(ws));
        reject(new Error(`WebSocket error connecting to ${this.url}`));
      };

      ws.onclose = () => {
        this.telemetry.setWsState("CLOSED");
        this.telemetry.stopPingLoop();
      };

      ws.onmessage = (event) => {
        void this.handleMessage(event);
      };
    });

    const { label } = await this.capture.start((pcm) => {
      this.fifo.push(pcm);
      this.telemetry.setFifo(this.fifo.stats());
    });
    this.micLabel = label;
    this.startFlushLoop();
  }

  async disconnect(): Promise<void> {
    this.stopFlushLoop();
    this.capture.stop();
    this.player.stop();
    this.fifo.clear();
    this.telemetry.stopPingLoop();
    this.telemetry.setFifo(this.fifo.stats());
    this.telemetry.setPlaybackQueueDepth(0);

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.telemetry.setWsState("CLOSED");
  }

  sendText(text: string): void {
    this.sendJson({ type: "text", text });
  }

  private startFlushLoop(): void {
    this.stopFlushLoop();
    // Flush FIFO → socket ~ every 20 ms
    this.flushTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      let frame = this.fifo.shift();
      while (frame) {
        this.ws.send(frame);
        this.telemetry.setFifo(this.fifo.stats());
        frame = this.fifo.shift();
      }
    }, 20);
  }

  private stopFlushLoop(): void {
    if (this.flushTimer != null) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    if (event.data instanceof ArrayBuffer) {
      await this.player.ensureStarted();
      this.player.enqueuePcm16(event.data);
      return;
    }

    if (typeof event.data !== "string") {
      return;
    }

    let parsed: LiveServerJsonEvent;
    try {
      parsed = JSON.parse(event.data) as LiveServerJsonEvent;
    } catch {
      return;
    }

    if (parsed.type === "pong") {
      const echo = typeof (parsed as { t?: unknown }).t === "number"
        ? ((parsed as { t: number }).t)
        : undefined;
      this.telemetry.markPong(echo);
    }

    if (parsed.type === "interrupted") {
      this.player.interrupt();
      await this.player.ensureStarted();
    }

    this.onEvent?.(parsed);
  }
}
