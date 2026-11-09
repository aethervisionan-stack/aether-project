/**
 * Packages HUD telemetry for multimodal WS ingestion.
 * Keeps payloads tiny so the spectrogram / LatencyTracker stay untouched.
 */

import type { TelemetrySnapshot, WsReadyStateLabel } from "../types/live";
import type { VisualizerMode } from "../audio/AdvancedAudioVisualizer";

export interface HudTelemetryPayload {
  type: "telemetry";
  ping_ms: number | null;
  ai_ms: number | null;
  /** First-token latency from LatencyTracker — feeds system_help_tool health. */
  ttft_ms: number | null;
  ws_state: WsReadyStateLabel | string | null;
  viz_mode: VisualizerMode | string | null;
  fifo_depth_ms: number | null;
  client_t: number;
}

export function buildHudTelemetry(options: {
  snap: TelemetrySnapshot;
  vizMode?: VisualizerMode | string | null;
}): HudTelemetryPayload {
  const { snap, vizMode = null } = options;
  return {
    type: "telemetry",
    ping_ms: snap.rttMs,
    ai_ms: snap.aiLatencyMs ?? snap.lastAiLatencyMs,
    ttft_ms: snap.ttftMs ?? snap.lastTtftMs,
    ws_state: snap.wsState,
    viz_mode: vizMode,
    fifo_depth_ms: snap.fifoDepthMs,
    client_t: performance.now(),
  };
}
