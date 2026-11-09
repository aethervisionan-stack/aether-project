/**
 * Gen-1 discrete latency HUD — binds TelemetryMonitor RTT + AI cycle ms.
 * Does not own the ping loop; extends display only.
 */

import { msg } from "../i18n";
import type { TelemetrySnapshot } from "../types/live";
import type { TelemetryMonitor } from "./TelemetryMonitor";

function fmtMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value)}ms`;
}

export function formatLatencyLine(snap: TelemetrySnapshot): string {
  const L = msg().latency;
  const ai = snap.aiLatencyMs ?? snap.lastAiLatencyMs;
  const ttft = snap.ttftMs ?? snap.lastTtftMs;
  return `${L.ping}: ${fmtMs(snap.rttMs)} | ${L.ai}: ${fmtMs(ai)} | ${L.ttft}: ${fmtMs(ttft)}`;
}

export function idleLatencyLine(): string {
  return msg().latency.idle;
}

export class LatencyMonitor {
  private unsub: (() => void) | null = null;
  private lastSnap: TelemetrySnapshot | null = null;

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

  /** Re-apply locale labels without waiting for the next telemetry tick. */
  applyLocale(): void {
    if (this.lastSnap) {
      this.render(this.lastSnap);
      return;
    }
    this.el.textContent = idleLatencyLine();
  }

  render(snap: TelemetrySnapshot): void {
    this.lastSnap = snap;
    this.el.textContent = formatLatencyLine(snap);
    this.el.dataset.rtt = snap.rttMs != null ? String(Math.round(snap.rttMs)) : "";
    const ai = snap.aiLatencyMs ?? snap.lastAiLatencyMs;
    this.el.dataset.ai = ai != null ? String(Math.round(ai)) : "";
    const ttft = snap.ttftMs ?? snap.lastTtftMs;
    this.el.dataset.ttft = ttft != null ? String(Math.round(ttft)) : "";
  }
}
