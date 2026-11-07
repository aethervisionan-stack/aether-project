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

export interface ConsensoAgentLatency {
  agent_id: string;
  agent_role: string;
  duration_ms: number;
  label: string;
}

export interface ConsensoResult {
  approved: boolean;
  agreement_ratio: number;
  final_text: string;
  votes: AgentVote[];
  hallucination_flags: string[];
  duration_ms: number;
  skipped: boolean;
  agent_latencies: ConsensoAgentLatency[];
}

export interface LatencyBreakdown {
  stt_ms: number;
  consenso_ms: number;
  agent_ms: number;
  tts_ms: number;
  total_ms: number;
  consenso_grounding_ms: number;
  consenso_safety_tone_ms: number;
  consenso_consistency_ms: number;
  consenso_agents_ms: Record<string, number>;
}

export interface ToolInvocation {
  name: string;
  arguments: Record<string, unknown>;
  approved: boolean;
  executed: boolean;
  blocked_reason: string | null;
  result_preview: string | null;
  duration_ms: number;
}

export interface ProcessAudioMeta {
  request_id: string;
  pipeline_mode: string;
  use_mock_audio: boolean;
  stt_provider: string;
  tts_provider: string;
  consenso_enabled: boolean;
  used_safe_fallback: boolean;
  fallback_reason: string | null;
  created_at: string;
  depin_attestation: Record<string, unknown> | null;
  tools_invoked?: boolean;
  tools_executed_count?: number;
}

export interface ProcessAudioResponse {
  transcript: string;
  response_text: string;
  consenso: ConsensoResult;
  audio_base64: string;
  audio_mime_type: string;
  /** Relative or absolute URL for GET /audio/{filename} (preferred for autoplay). */
  audio_url?: string | null;
  tools?: ToolInvocation[];
  latency: LatencyBreakdown;
  meta: ProcessAudioMeta;
}

export interface HealthResponse {
  status: string;
  version: string;
  pipeline_mode: string;
  use_mock_audio: boolean;
  stt_provider: string;
  tts_provider: string;
  consenso_enabled: boolean;
  depin_ready: boolean;
  web3_rpc_configured: boolean;
  /** Presence only — never the secret value. */
  openai_api_key_configured?: boolean;
  /** True when key starts with sk- and passes length/charset checks. */
  has_valid_openai_key?: boolean;
  /** Absolute path of the .env file the backend loaded. */
  env_file?: string;
  api_port?: number;
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

/** GET /api/history item (SessionLogs row). */
export interface SessionHistoryItem {
  id: number;
  timestamp: string | null;
  request_id: string;
  client_id: string;
  transcription: string;
  agent_response: string;
  tools_invoked: ToolInvocation[] | Record<string, unknown>[];
  latency_ms: {
    stt: number;
    agent: number;
    consenso: number;
    tts: number;
    total: number;
  };
  consensus_score: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface HistoryResponse {
  count: number;
  items: SessionHistoryItem[];
}

/** GET /api/metrics consolidated payload. */
export interface MetricsResponse {
  session_count: number;
  latency_ms: {
    avg_stt: number;
    avg_agent: number;
    avg_consenso: number;
    avg_tts: number;
    avg_total: number;
  };
  tokens: {
    tracked: boolean;
    total_prompt: number;
    total_completion: number;
    total: number;
    avg_total: number;
  };
  consensus: {
    avg_score: number;
  };
  audit: {
    approve: number;
    reject: number;
  };
}
