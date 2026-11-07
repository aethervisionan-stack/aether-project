/** Strongly typed contracts mirroring the FastAPI /process-audio envelope. */

export interface AgentVote {
  agent_id: string;
  agent_role: string;
  approved: boolean;
  score: number;
  rationale: string;
  revised_text: string | null;
  duration_ms: number;
}

export interface ConsensoResult {
  approved: boolean;
  agreement_ratio: number;
  final_text: string;
  votes: AgentVote[];
  hallucination_flags: string[];
  duration_ms: number;
  skipped: boolean;
}

export interface LatencyBreakdown {
  stt_ms: number;
  consenso_ms: number;
  agent_ms: number;
  tts_ms: number;
  total_ms: number;
}

export interface ProcessAudioMeta {
  request_id: string;
  pipeline_mode: string;
  stt_provider: string;
  tts_provider: string;
  consenso_enabled: boolean;
  created_at: string;
  depin_attestation: Record<string, unknown> | null;
}

export interface ProcessAudioResponse {
  transcript: string;
  response_text: string;
  consenso: ConsensoResult;
  audio_base64: string;
  audio_mime_type: string;
  latency: LatencyBreakdown;
  meta: ProcessAudioMeta;
}

export interface HealthResponse {
  status: string;
  version: string;
  pipeline_mode: string;
  stt_provider: string;
  tts_provider: string;
  consenso_enabled: boolean;
  depin_ready: boolean;
}

export interface ApiErrorBody {
  error: string;
  detail: string;
  request_id?: string | null;
  retryable: boolean;
  stage?: string | null;
}

export class VoiceApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly stage: string | null;
  readonly detail: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error || `HTTP ${status}`);
    this.name = "VoiceApiError";
    this.status = status;
    this.retryable = body.retryable;
    this.stage = body.stage ?? null;
    this.detail = body.detail;
  }
}
