/**
 * Lightweight telemetry for real-time Live validation:
 * RTT, AI voice-cycle latency, WebSocket state, FIFO discard count, buffer queue depth.
 *
 * Also owns the client→server app-level ping loop with pong timeout detection
 * so half-open sockets (proxy idle kill) surface quickly.
 *
 * Voice-cycle timing: markOutbound() when mic/text leaves the client; markAiFirstChunk()
 * on the first AI audio/transcript for that cycle → aiLatencyMs.
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
  private aiLatencyMs: number | null = null;
  private lastAiLatencyMs: number | null = null;
  private ttftMs: number | null = null;
  private lastTtftMs: number | null = null;
  private outboundAt: number | null = null;
  private awaitingAi = false;
  private awaitingTtft = false;
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
      aiLatencyMs: this.aiLatencyMs,
      lastAiLatencyMs: this.lastAiLatencyMs,
      ttftMs: this.ttftMs,
      lastTtftMs: this.lastTtftMs,
      wsState: this.wsState,
      fifoDiscardCount: this.fifoDiscardCount,
      fifoDepthMs: this.fifoDepthMs,
      fifoQueuedBytes: this.fifoQueuedBytes,
      playbackQueueDepth: this.playbackQueueDepth,
      updatedAt: performance.now(),
    };
  }

  /**
   * Stamp client outbound for a voice/text cycle (idempotent while awaiting).
   * `clientT` should be performance.now() at send time.
   */
  markOutbound(clientT: number = performance.now()): void {
    if (this.awaitingAi && this.outboundAt != null) {
      return;
    }
    this.outboundAt = clientT;
    this.awaitingAi = true;
    this.awaitingTtft = true;
    this.aiLatencyMs = null;
    this.ttftMs = null;
    this.emit();
  }

  /** First AI audio chunk or transcript after markOutbound → AI processing latency. */
  markAiFirstChunk(clientT: number = performance.now()): void {
    if (!this.awaitingAi || this.outboundAt == null) {
      return;
    }
    const ms = Math.max(0, clientT - this.outboundAt);
    this.aiLatencyMs = ms;
    this.lastAiLatencyMs = ms;
    this.awaitingAi = false;
    // Keep outboundAt until TTFT lands if token streaming is still pending.
    if (!this.awaitingTtft) {
      this.outboundAt = null;
    }
    this.emit();
  }

  /**
   * First streamed token_delta after outbound → text TTFT (ms).
   * Independent of spectrogram; safe to call on every delta (idempotent).
   */
  markTtft(clientT: number = performance.now()): void {
    if (!this.awaitingTtft || this.outboundAt == null) {
      return;
    }
    const ms = Math.max(0, clientT - this.outboundAt);
    this.ttftMs = ms;
    this.lastTtftMs = ms;
    this.awaitingTtft = false;
    if (!this.awaitingAi) {
      this.outboundAt = null;
    }
    this.emit();
  }

  /** Reset in-flight AI timing (disconnect / interrupt without a measured chunk). */
  clearAiCycle(): void {
    this.awaitingAi = false;
    this.awaitingTtft = false;
    this.outboundAt = null;
    this.aiLatencyMs = null;
    this.ttftMs = null;
    this.emit();
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
          `ai=${snap.aiLatencyMs?.toFixed(0) ?? snap.lastAiLatencyMs?.toFixed(0) ?? "—"}ms ` +
          `ttft=${snap.ttftMs?.toFixed(0) ?? snap.lastTtftMs?.toFixed(0) ?? "—"}ms ` +
          `fifoDepth=${snap.fifoDepthMs.toFixed(0)}ms discards=${snap.fifoDiscardCount} ` +
          `playQ=${snap.playbackQueueDepth}`,
      );
    }
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}
