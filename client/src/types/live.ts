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

/** Streaming token chunks for ultra-low TTFT HUD paint. */
export interface LiveTokenDeltaEvent {
  type: "token_delta";
  stream_id?: string;
  index?: number;
  text: string;
}

export interface LiveTokenDoneEvent {
  type: "token_done";
  stream_id?: string;
  chunks?: number;
  text?: string;
}

/** Async CoT / memory / tools decision sidecar (never gates PCM). */
export interface LiveDecisionEvent {
  type: "decision";
  turn_id: string;
  complexity: "simple" | "complex" | string;
  skipped_heavy?: boolean;
  preference_summary?: string;
  plan?: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
  elapsed_ms?: number;
}

export interface LiveToolResultEvent {
  type: "tool_result";
  name: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string | null;
  elapsed_ms?: number;
}

export interface LiveMultimodalAckEvent {
  type: "multimodal_ack";
  kind: "frame" | "telemetry" | string;
  ok: boolean;
  viz_mode?: string | null;
  stats?: Record<string, unknown>;
}

export interface LiveOutboundAckEvent {
  type: "outbound_ack";
  client_t: number;
  server_t?: number;
}

/** Mobility / hardware / voice UX events from `/ws/live`. */
export interface LiveMobilityAckEvent {
  type: "mobility_ack";
  ok: boolean;
  state?: Record<string, unknown>;
  policy?: Record<string, unknown>;
}

export interface LiveNotificationActionEvent {
  type: "notification_action";
  action: Record<string, unknown>;
  muted?: boolean;
  reason?: string;
}

export interface LiveProductivityAckEvent {
  type: "productivity_ack";
  intent: Record<string, unknown>;
  memory_saved?: boolean;
}

export interface LiveNavGuidanceEvent {
  type: "nav_guidance";
  ok: boolean;
  steps?: string[];
  nearby?: Array<Record<string, unknown>>;
  prompt_block?: string;
}

export interface LivePriorityPolicyEvent {
  type: "priority_policy";
  policy: Record<string, unknown>;
}

export type LiveServerJsonEvent =
  | LiveReadyEvent
  | LivePingEvent
  | LivePongEvent
  | LiveTranscriptEvent
  | LiveGuardrailEvent
  | LiveTurnEvent
  | LiveErrorEvent
  | LiveTokenDeltaEvent
  | LiveTokenDoneEvent
  | LiveDecisionEvent
  | LiveToolResultEvent
  | LiveMultimodalAckEvent
  | LiveOutboundAckEvent
  | LiveMobilityAckEvent
  | LiveNotificationActionEvent
  | LiveProductivityAckEvent
  | LiveNavGuidanceEvent
  | LivePriorityPolicyEvent
  | { type: string; [key: string]: unknown };

export type GuardrailStatus = "secure" | "sanitizing" | "blocked";

export interface TelemetrySnapshot {
  rttMs: number | null;
  /** Client voice/text outbound → first AI audio/transcript chunk (ms). */
  aiLatencyMs: number | null;
  /** Last completed voice-cycle AI latency (sticky until next cycle). */
  lastAiLatencyMs: number | null;
  /** First token_delta after outbound (text TTFT), ms. */
  ttftMs: number | null;
  lastTtftMs: number | null;
  wsState: WsReadyStateLabel;
  fifoDiscardCount: number;
  fifoDepthMs: number;
  fifoQueuedBytes: number;
  playbackQueueDepth: number;
  updatedAt: number;
}
