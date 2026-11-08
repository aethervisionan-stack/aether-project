/**
 * Lightweight telemetry for real-time Live validation:
 * RTT, WebSocket state, FIFO discard count, buffer queue depth.
 */

import type { TelemetrySnapshot, WsReadyStateLabel } from "../types/live";

export type TelemetryListener = (snapshot: TelemetrySnapshot) => void;

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
    const sent = echoT ?? this.lastPingSentAt;
    if (sent == null) {
      return;
    }
    this.rttMs = Math.max(0, performance.now() - sent);
    this.lastPingSentAt = null;
    this.emit();
  }

  /**
   * Periodically invoke `sendPing` while the socket is open.
   * `sendPing` should send `{"type":"ping","t": <ms>}`.
   */
  startPingLoop(sendPing: (t: number) => void, intervalMs = 2000): void {
    this.stopPingLoop();
    this.pingTimer = window.setInterval(() => {
      if (this.wsState !== "OPEN") {
        return;
      }
      const t = performance.now();
      this.markPingSent(t);
      sendPing(t);
    }, intervalMs);
  }

  stopPingLoop(): void {
    if (this.pingTimer != null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
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
