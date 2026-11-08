import type {
  CognitiveChatRequest,
  CognitiveChatResponse,
  HealthResponse,
  HistoryResponse,
  MetricsResponse,
  ProcessAudioResponse,
} from "./types";
import {
  VoiceApiError,
  normalizeProcessAudioResponse,
  type ApiErrorBody,
} from "./types";

export interface VoiceApiConfig {
  /**
   * FastAPI origin. Empty string → same-origin Vite `/api` proxy → http://127.0.0.1:8001.
   * Keep empty for LAN / phone / tunnel (absolute localhost breaks off-PC clients).
   * Set `VITE_API_BASE_URL` only for direct API calls from the same machine.
   */
  baseUrl: string;
  timeoutMs: number;
}

const DEFAULT_CONFIG: VoiceApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "",
  // Tunnel + Gemini 3.x STT/cognitive routinely exceed 60s on phone networks.
  timeoutMs: 120_000,
};

function resolveUrl(path: string, baseUrl: string): string {
  if (!baseUrl) {
    return `/api${path}`;
  }
  return `${baseUrl}${path}`;
}

async function parseError(res: Response): Promise<VoiceApiError> {
  let body: ApiErrorBody = {
    error: res.statusText || "Request failed",
    detail: "",
    retryable: res.status >= 500,
  };
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // keep defaults
  }
  return new VoiceApiError(res.status, body);
}

export class VoiceApiClient {
  private readonly config: VoiceApiConfig;

  constructor(config: Partial<VoiceApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async health(): Promise<HealthResponse> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(resolveUrl("/health", this.config.baseUrl), {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      return (await res.json()) as HealthResponse;
    } finally {
      window.clearTimeout(timer);
    }
  }

  /**
   * Upload headset-captured audio and receive Consenso-validated TTS audio.
   */
  async processAudio(
    blob: Blob,
    options: {
      language?: string;
      locale?: string;
      filename?: string;
      clientId?: string;
    } = {},
  ): Promise<ProcessAudioResponse> {
    // FormData → browser sets multipart/form-data + boundary (do not set Content-Type).
    const form = new FormData();
    const filename = options.filename ?? "headset-capture.webm";
    form.append("audio", blob, filename);
    if (options.language) {
      form.append("language", options.language);
    }
    form.append("locale", options.locale ?? "pt-BR");
    form.append("client_id", options.clientId ?? "default");

    const url = resolveUrl("/process-audio", this.config.baseUrl);
    console.log("[aether:stage] request.prepare", {
      method: "POST",
      url,
      baseUrl: this.config.baseUrl || "(same-origin /api proxy)",
      blobSize: blob.size,
      blobType: blob.type || "(empty)",
      filename,
      locale: options.locale ?? "pt-BR",
      clientId: options.clientId ?? "default",
      timeoutMs: this.config.timeoutMs,
    });

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      console.log("[aether:stage] request.sent", { method: "POST", url });
      const res = await fetch(url, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const bodyPreview = await res.clone().text().catch(() => "");
      console.log("[aether:stage] response.status", {
        url,
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get("content-type"),
        bodyChars: bodyPreview.length,
        bodySummary: bodyPreview.slice(0, 240),
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      const raw = JSON.parse(bodyPreview || "{}") as ProcessAudioResponse;
      // Map transcript/response_text/consenso/audio_url → HUD Gemini aliases.
      const normalized = normalizeProcessAudioResponse(raw);
      console.log("[aether:stage] response.parsed", {
        transcriptChars: (normalized.transcript || "").length,
        responseChars: (normalized.response_text || "").length,
        hasAudioUrl: !!normalized.audio_url,
        hasAudioBase64: !!normalized.audio_base64,
        audioMime: normalized.audio_mime_type,
        ttsProvider: normalized.meta?.tts_provider,
        fallback: normalized.meta?.used_safe_fallback,
        fallbackReason: normalized.meta?.fallback_reason,
        status: normalized.status,
      });
      return normalized;
    } catch (err) {
      console.error("[aether:stage] request.error", err);
      if (err instanceof Error && err.stack) {
        console.error("[aether:stage] request.error.stack", err.stack);
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new VoiceApiError(408, {
          error: "Timeout de rede",
          detail: "O servidor não respondeu a tempo. Verifique o backend e a conexão Bluetooth.",
          retryable: true,
          stage: "total",
        });
      }
      if (err instanceof TypeError) {
        throw new VoiceApiError(0, {
          error: "Falha de rede",
          detail: err.message,
          retryable: true,
          stage: "total",
        });
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }

  /** Recent SessionLogs — Vite proxy: `/api/history` → backend `/history` or `/api/history`. */
  async history(options: { limit?: number; clientId?: string } = {}): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    params.set("limit", String(options.limit ?? 50));
    if (options.clientId) {
      params.set("client_id", options.clientId);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(
        `${resolveUrl("/history", this.config.baseUrl)}?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!res.ok) {
        throw await parseError(res);
      }
      return (await res.json()) as HistoryResponse;
    } finally {
      window.clearTimeout(timer);
    }
  }

  /** Consolidated latency / token metrics. */
  async metrics(): Promise<MetricsResponse> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(resolveUrl("/metrics", this.config.baseUrl), {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      return (await res.json()) as MetricsResponse;
    } finally {
      window.clearTimeout(timer);
    }
  }

  /** Gemini flash|pro chat → Consenso → unified HUD payload. */
  async cognitiveChat(body: CognitiveChatRequest): Promise<CognitiveChatResponse> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(resolveUrl("/cognitive/chat", this.config.baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: body.query,
          history: body.history ?? [],
          mode: body.mode ?? "flash",
          locale: body.locale ?? "pt-BR",
          client_id: body.client_id ?? "default",
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      return (await res.json()) as CognitiveChatResponse;
    } finally {
      window.clearTimeout(timer);
    }
  }
}

export const voiceApi = new VoiceApiClient();
