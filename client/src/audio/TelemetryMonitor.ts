/**
 * Lightweight telemetry for real-time Live validation:
 * RTT, WebSocket state, FIFO discard count, buffer queue depth.
 *
 * Also owns the client→server app-level ping loop with pong timeout detection
 * so half-open sockets (proxy idle kill) surface quickly.
 */

import type { TelemetrySnapshot, WsReadyStateLabel } from "../types/live";

export type TelemetryListener = (snapshot: TelemetrySnapshot) => void;

export interface PingLoopOptions {
  /** How often to send `{"type":"ping","t":…}`. Default 10s. */
  intervalMs?: number;
  /** Max age of last successful pong before `onTimeout`. Default 30s. */
  timeoutMs?: number;
  /** Fired once when a pong is overdue; caller should reconnect. */
  onTimeout?: () => void;
}

export class TelemetryMonitor {
  private rttMs: number | null = null;
  private wsState: WsReadyStateLabel = "NONE";
  private fifoDiscardCount = 0;
  private fifoDepthMs = 0;
  private fifoQueuedBytes = 0;
  private playbackQueueDepth = 0;
  private readonly listeners = new Set<TelemetryListener>();
  private pingTimer: number | null = null;
  private lastPingSentAt: number | null = null;
  private lastPongAt: number | null = null;
  private timeoutFired = false;
  private logToConsole: boolean;

  constructor(options?: { logToConsole?: boolean }) {
    this.logToConsole = options?.logToConsole ?? true;
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): TelemetrySnapshot {
    return {
      rttMs: this.rttMs,
      wsState: this.wsState,
      fifoDiscardCount: this.fifoDiscardCount,
      fifoDepthMs: this.fifoDepthMs,
      fifoQueuedBytes: this.fifoQueuedBytes,
      playbackQueueDepth: this.playbackQueueDepth,
      updatedAt: performance.now(),
    };
  }

  setWsState(state: WsReadyStateLabel): void {
    this.wsState = state;
    this.emit();
  }

  setFifo(stats: {
    discardCount: number;
    depthMs: number;
    queuedBytes: number;
  }): void {
    this.fifoDiscardCount = stats.discardCount;
    this.fifoDepthMs = stats.depthMs;
    this.fifoQueuedBytes = stats.queuedBytes;
    this.emit();
  }

  setPlaybackQueueDepth(depth: number): void {
    this.playbackQueueDepth = depth;
    this.emit();
  }

  /** Call when sending a ping control message. */
  markPingSent(clientT: number = performance.now()): void {
    this.lastPingSentAt = clientT;
  }

  /** Call when a pong arrives (optionally echoing client `t`). */
  markPong(echoT?: number): void {
    const now = performance.now();
    const sent = echoT ?? this.lastPingSentAt;
    if (sent != null) {
      this.rttMs = Math.max(0, now - sent);
    }
    this.lastPingSentAt = null;
    this.lastPongAt = now;
    this.timeoutFired = false;
    this.emit();
  }

  /** Treat any inbound WS traffic as liveness (server ping, audio, events). */
  markActivity(): void {
    this.lastPongAt = performance.now();
    this.timeoutFired = false;
  }

  /**
   * Periodically invoke `sendPing` while the socket is open.
   * `sendPing` should send `{"type":"ping","t": <ms>}`.
   */
  startPingLoop(sendPing: (t: number) => void, options: PingLoopOptions | number = {}): void {
    this.stopPingLoop();
    const opts: PingLoopOptions =
      typeof options === "number" ? { intervalMs: options } : options;
    const intervalMs = opts.intervalMs ?? 10_000;
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const onTimeout = opts.onTimeout;
    this.lastPongAt = performance.now();
    this.timeoutFired = false;

    this.pingTimer = window.setInterval(() => {
      if (this.wsState !== "OPEN") {
        return;
      }

      const now = performance.now();
      if (
        onTimeout &&
        !this.timeoutFired &&
        this.lastPongAt != null &&
        now - this.lastPongAt > timeoutMs
      ) {
        this.timeoutFired = true;
        console.warn(
          `[aether:telemetry] ping timeout after ${timeoutMs}ms — forcing reconnect`,
        );
        onTimeout();
        return;
      }

      const t = now;
      this.markPingSent(t);
      sendPing(t);
    }, intervalMs);
  }

  stopPingLoop(): void {
    if (this.pingTimer != null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.lastPingSentAt = null;
  }

  private emit(): void {
    const snap = this.snapshot();
    if (this.logToConsole) {
      // Compact single-line HUD-friendly log
      console.debug(
        `[aether:telemetry] ws=${snap.wsState} rtt=${snap.rttMs?.toFixed(0) ?? "—"}ms ` +
          `fifoDepth=${snap.fifoDepthMs.toFixed(0)}ms discards=${snap.fifoDiscardCount} ` +
          `playQ=${snap.playbackQueueDepth}`,
      );
    }
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}
