/** Wire protocol events between client and FastAPI `/ws/live`. */

export type WsReadyStateLabel =
  | "CONNECTING"
  | "OPEN"
  | "RECONNECTING"
  | "CLOSING"
  | "CLOSED"
  | "NONE";

export interface LiveReadyEvent {
  type: "ready";
  model: string;
}

export interface LivePingEvent {
  type: "ping";
  t?: number;
  server_t?: number;
}

export interface LivePongEvent {
  type: "pong";
  t?: number;
  server_t?: number;
}

export interface LiveTranscriptEvent {
  type: "user_transcript" | "aether_transcript";
  text: string;
  /** Present on AI text after Motor de Segurança. */
  guardrail?: "secure" | "sanitizing" | "blocked" | string;
}

export interface LiveGuardrailEvent {
  type: "guardrail";
  status: "secure" | "sanitizing" | "blocked" | string;
  reason?: string;
  source_type?: string;
}

export interface LiveTurnEvent {
  type: "turn_complete" | "interrupted";
}

export interface LiveErrorEvent {
  type: "error";
  code?: string;
  message: string;
}

export type LiveServerJsonEvent =
  | LiveReadyEvent
  | LivePingEvent
  | LivePongEvent
  | LiveTranscriptEvent
  | LiveGuardrailEvent
  | LiveTurnEvent
  | LiveErrorEvent
  | { type: string; [key: string]: unknown };

export type GuardrailStatus = "secure" | "sanitizing" | "blocked";

export interface TelemetrySnapshot {
  rttMs: number | null;
  /** Client voice/text outbound → first AI audio/transcript chunk (ms). */
  aiLatencyMs: number | null;
  /** Last completed voice-cycle AI latency (sticky until next cycle). */
  lastAiLatencyMs: number | null;
  wsState: WsReadyStateLabel;
  fifoDiscardCount: number;
  fifoDepthMs: number;
  fifoQueuedBytes: number;
  playbackQueueDepth: number;
  updatedAt: number;
}
