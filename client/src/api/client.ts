import type { HealthResponse, ProcessAudioResponse } from "./types";
import { VoiceApiError, type ApiErrorBody } from "./types";

export interface VoiceApiConfig {
  /** Empty string uses Vite `/api` proxy in development. */
  baseUrl: string;
  timeoutMs: number;
}

const DEFAULT_CONFIG: VoiceApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "",
  timeoutMs: 35_000,
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
    options: { language?: string; locale?: string; filename?: string } = {},
  ): Promise<ProcessAudioResponse> {
    // FormData → browser sets multipart/form-data + boundary (do not set Content-Type).
    const form = new FormData();
    const filename = options.filename ?? "headset-capture.webm";
    form.append("audio", blob, filename);
    if (options.language) {
      form.append("language", options.language);
    }
    form.append("locale", options.locale ?? "pt-BR");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(resolveUrl("/process-audio", this.config.baseUrl), {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      return (await res.json()) as ProcessAudioResponse;
    } catch (err) {
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
}

export const voiceApi = new VoiceApiClient();
