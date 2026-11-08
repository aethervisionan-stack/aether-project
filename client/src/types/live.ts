/** Wire protocol events between client and FastAPI `/ws/live`. */

export type WsReadyStateLabel =
  | "CONNECTING"
  | "OPEN"
  | "CLOSING"
  | "CLOSED"
  | "NONE";

export interface LiveReadyEvent {
  type: "ready";
  model: string;
}

export interface LivePongEvent {
  type: "pong";
  t?: number;
  server_t?: number;
}

export interface LiveTranscriptEvent {
  type: "user_transcript" | "aether_transcript";
  text: string;
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
  | LivePongEvent
  | LiveTranscriptEvent
  | LiveTurnEvent
  | LiveErrorEvent
  | { type: string; [key: string]: unknown };

export interface TelemetrySnapshot {
  rttMs: number | null;
  wsState: WsReadyStateLabel;
  fifoDiscardCount: number;
  fifoDepthMs: number;
  fifoQueuedBytes: number;
  playbackQueueDepth: number;
  updatedAt: number;
}
