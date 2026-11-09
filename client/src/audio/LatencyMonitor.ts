/**
 * Gen-1 discrete latency HUD — binds TelemetryMonitor RTT + AI cycle ms.
 * Does not own the ping loop; extends display only.
 */

import type { TelemetryMonitor } from "./TelemetryMonitor";
import type { TelemetrySnapshot } from "../types/live";

function fmtMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value)}ms`;
}

export function formatLatencyLine(snap: TelemetrySnapshot): string {
  const ai = snap.aiLatencyMs ?? snap.lastAiLatencyMs;
  const ttft = snap.ttftMs ?? snap.lastTtftMs;
  return `PING: ${fmtMs(snap.rttMs)} | AI: ${fmtMs(ai)} | TTFT: ${fmtMs(ttft)}`;
}

export class LatencyMonitor {
  private unsub: (() => void) | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly telemetry: TelemetryMonitor,
  ) {}

  start(): void {
    this.stop();
    this.unsub = this.telemetry.subscribe((snap) => this.render(snap));
  }

  stop(): void {
    this.unsub?.();
    this.unsub = null;
  }

  render(snap: TelemetrySnapshot): void {
    this.el.textContent = formatLatencyLine(snap);
    this.el.dataset.rtt = snap.rttMs != null ? String(Math.round(snap.rttMs)) : "";
    const ai = snap.aiLatencyMs ?? snap.lastAiLatencyMs;
    this.el.dataset.ai = ai != null ? String(Math.round(ai)) : "";
    const ttft = snap.ttftMs ?? snap.lastTtftMs;
    this.el.dataset.ttft = ttft != null ? String(Math.round(ttft)) : "";
  }
}
