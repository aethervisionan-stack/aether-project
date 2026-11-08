/**
 * Manages the browser WebSocket to the FastAPI Live bridge.
 *
 * Default URL: `ws(s)://<page-host>/api/ws/live`
 * Vite proxies `/api` → `http://127.0.0.1:8000` (path rewritten, `ws: true`).
 *
 * Keeps the Live session stable with:
 *  - client→server ping / pong RTT + timeout
 *  - response to server→client heartbeat pings
 *  - transparent auto-reconnect (HUD: RECONNECTING) after unexpected drops
 *  - mic-fallback hybrid: text chat stays available if capture fails
 */

import { FifoRetentionBuffer } from "../audio/FifoRetentionBuffer";
import { GaplessPcmPlayer } from "../audio/GaplessPcmPlayer";
import { formatMicError, PcmCapture } from "../audio/PcmCapture";
import { TelemetryMonitor } from "../audio/TelemetryMonitor";
import type { LiveServerJsonEvent, WsReadyStateLabel } from "../types/live";

export type LiveEventHandler = (event: LiveServerJsonEvent) => void;

export interface GeminiLiveServiceOptions {
  /** Absolute ws URL or path. Default: same-origin `/api/ws/live`. */
  url?: string;
  telemetry?: TelemetryMonitor;
  onEvent?: LiveEventHandler;
}

export interface LiveConnectResult {
  /** True when mic capture started and PCM flush loop is active. */
  micEnabled: boolean;
  micLabel: string | null;
  /** Present when Live stayed connected in text-only / hybrid-without-mic mode. */
  micWarning: string | null;
}

const CLIENT_PING_INTERVAL_MS = 10_000;
const CLIENT_PONG_TIMEOUT_MS = 30_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8_000;

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
  private micEnabled = false;
  private micWarning: string | null = null;
  private wantConnected = false;
  private intentionalClose = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private opening: Promise<void> | null = null;

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

  isMicEnabled(): boolean {
    return this.micEnabled;
  }

  getMicWarning(): string | null {
    return this.micWarning;
  }

  getWsUrl(): string {
    return this.url;
  }

  async connect(): Promise<LiveConnectResult> {
    this.wantConnected = true;
    this.intentionalClose = false;
    this.clearReconnectTimer();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.connectResult();
    }

    // Playback can still work for Gemini audio replies even if mic capture fails.
    try {
      await this.player.ensureStarted();
    } catch (err) {
      console.warn("[aether] audio playback init failed; continuing for text", err);
    }

    await this.openSocket(/*isReconnect=*/ false);
    await this.ensureMicCapture();
    this.reconnectAttempt = 0;
    return this.connectResult();
  }

  async disconnect(): Promise<void> {
    this.wantConnected = false;
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.telemetry.stopPingLoop();
    this.stopFlushLoop();
    this.capture.stop();
    this.player.stop();
    this.fifo.clear();
    this.micEnabled = false;
    this.micLabel = null;
    this.micWarning = null;
    this.reconnectAttempt = 0;
    this.telemetry.setFifo(this.fifo.stats());
    this.telemetry.setPlaybackQueueDepth(0);
    this.detachAndCloseSocket();
    this.telemetry.setWsState("CLOSED");
  }

  sendText(text: string): void {
    this.sendJson({ type: "text", text });
  }

  private connectResult(): LiveConnectResult {
    return {
      micEnabled: this.micEnabled,
      micLabel: this.micLabel,
      micWarning: this.micWarning,
    };
  }

  private async openSocket(isReconnect: boolean): Promise<void> {
    if (this.opening) {
      return this.opening;
    }

    this.opening = new Promise<void>((resolve, reject) => {
      if (isReconnect) {
        this.telemetry.setWsState("RECONNECTING");
      } else {
        this.telemetry.setWsState("CONNECTING");
      }

      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      let settled = false;

      const settleOk = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      const settleErr = (err: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(err);
      };

      ws.onopen = () => {
        this.telemetry.setWsState("OPEN");
        this.telemetry.startPingLoop((t) => this.sendJson({ type: "ping", t }), {
          intervalMs: CLIENT_PING_INTERVAL_MS,
          timeoutMs: CLIENT_PONG_TIMEOUT_MS,
          onTimeout: () => this.forceReconnect("ping timeout"),
        });
        if (this.micEnabled) {
          this.startFlushLoop();
        }
        settleOk();
      };

      ws.onerror = () => {
        this.telemetry.setWsState(readyStateLabel(ws));
        if (!settled) {
          settleErr(new Error(`WebSocket error connecting to ${this.url}`));
        }
      };

      ws.onclose = () => {
        this.telemetry.stopPingLoop();
        this.stopFlushLoop();
        this.telemetry.setWsState("CLOSED");
        if (!settled) {
          settleErr(new Error(`WebSocket closed before open (${this.url})`));
          return;
        }
        if (this.wantConnected && !this.intentionalClose) {
          this.scheduleReconnect();
        }
      };

      ws.onmessage = (event) => {
        void this.handleMessage(event);
      };
    }).finally(() => {
      this.opening = null;
    });

    return this.opening;
  }

  private async ensureMicCapture(): Promise<void> {
    if (this.micEnabled && this.capture.isRunning) {
      this.startFlushLoop();
      return;
    }

    this.micEnabled = false;
    this.micLabel = null;
    this.micWarning = null;

    try {
      const { label } = await this.capture.start((pcm) => {
        this.fifo.push(pcm);
        this.telemetry.setFifo(this.fifo.stats());
      });
      this.micLabel = label;
      this.micEnabled = true;
      this.startFlushLoop();
    } catch (err) {
      // Keep the Live WebSocket open for typed text (and any playback).
      this.micWarning = formatMicError(err);
      console.warn("[aether] mic capture unavailable; text chat still active", err);
      this.capture.stop();
      this.stopFlushLoop();
    }
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected || this.intentionalClose || this.reconnectTimer != null) {
      return;
    }

    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.telemetry.setWsState("RECONNECTING");
    console.warn(
      `[aether] ws dropped; reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`,
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnectNow();
    }, delay);
  }

  private async reconnectNow(): Promise<void> {
    if (!this.wantConnected || this.intentionalClose) {
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.detachAndCloseSocket();
    this.telemetry.setWsState("RECONNECTING");

    try {
      await this.openSocket(/*isReconnect=*/ true);
      // Mic stream can survive across WS reconnects; only re-acquire if needed.
      if (this.micEnabled && this.capture.isRunning) {
        this.startFlushLoop();
      } else if (!this.micEnabled && this.micWarning) {
        // Stay text-only; do not re-prompt getUserMedia on every drop.
      } else {
        await this.ensureMicCapture();
      }
      this.reconnectAttempt = 0;
      this.onEvent?.({
        type: "info",
        message: "WebSocket reconnected",
      } as LiveServerJsonEvent);
    } catch (err) {
      console.warn("[aether] reconnect failed", err);
      this.scheduleReconnect();
    }
  }

  private forceReconnect(reason: string): void {
    console.warn(`[aether] forcing reconnect: ${reason}`);
    this.telemetry.stopPingLoop();
    this.stopFlushLoop();
    // Closing triggers onclose → scheduleReconnect when wantConnected.
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    } else if (this.wantConnected && !this.intentionalClose) {
      this.scheduleReconnect();
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private detachAndCloseSocket(): void {
    if (!this.ws) {
      return;
    }
    const ws = this.ws;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    // Keep onclose null during intentional teardown so we do not schedule reconnect.
    ws.onclose = null;
    this.ws = null;
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    } catch {
      // ignore
    }
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
    this.telemetry.markActivity();

    if (event.data instanceof ArrayBuffer) {
      try {
        await this.player.ensureStarted();
        this.player.enqueuePcm16(event.data);
      } catch (err) {
        console.warn("[aether] playback enqueue failed", err);
      }
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

    if (parsed.type === "ping") {
      // Answer server heartbeat so proxies see bidirectional traffic.
      this.sendJson({
        type: "pong",
        t: (parsed as { t?: number }).t,
        client_t: performance.now(),
      });
      return;
    }

    if (parsed.type === "pong") {
      const echo = typeof (parsed as { t?: unknown }).t === "number"
        ? ((parsed as { t: number }).t)
        : undefined;
      this.telemetry.markPong(echo);
      return;
    }

    if (parsed.type === "interrupted") {
      this.player.interrupt();
      try {
        await this.player.ensureStarted();
      } catch {
        // ignore
      }
    }

    this.onEvent?.(parsed);
  }
}
