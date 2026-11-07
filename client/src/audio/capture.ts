/**
 * Microphone capture aimed at generic Bluetooth headsets.
 *
 * Prefers MediaRecorder on the OS default input. Callers should fall back to
 * Web Speech (Safe Mode) when `isMediaRecorderCaptureAvailable()` is false or
 * `start()` throws a recoverable capture error.
 */

export type CaptureState = "idle" | "requesting" | "recording" | "stopping" | "error";

export type CaptureFailureKind =
  | "permission_denied"
  | "device_missing"
  | "unsupported"
  | "secure_context"
  | "unknown";

export class CaptureError extends Error {
  readonly kind: CaptureFailureKind;
  readonly recoverable: boolean;

  constructor(kind: CaptureFailureKind, message: string, recoverable = true) {
    super(message);
    this.name = "CaptureError";
    this.kind = kind;
    this.recoverable = recoverable;
  }
}

export interface CaptureResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  trackLabel: string | null;
}

export interface HeadsetCaptureOptions {
  /** Prefer these MIME types when the browser supports them. */
  preferredMimeTypes?: string[];
  audioBitsPerSecond?: number;
}

export interface CaptureCapabilities {
  secureContext: boolean;
  mediaDevices: boolean;
  getUserMedia: boolean;
  mediaRecorder: boolean;
  speechRecognition: boolean;
}

const DEFAULT_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(candidates: string[]): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

export function probeCaptureCapabilities(): CaptureCapabilities {
  const mediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices;
  const speechCtor =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  return {
    secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
    mediaDevices,
    getUserMedia: mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function",
    mediaRecorder: typeof MediaRecorder !== "undefined",
    speechRecognition: typeof speechCtor === "function",
  };
}

export function isMediaRecorderCaptureAvailable(): boolean {
  const caps = probeCaptureCapabilities();
  return caps.secureContext && caps.getUserMedia && caps.mediaRecorder;
}

export function classifyMediaError(err: unknown): CaptureError {
  if (err instanceof CaptureError) {
    return err;
  }
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: string }).name)
      : "";
  const message =
    err instanceof Error ? err.message : "Falha desconhecida na captura de áudio.";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return new CaptureError(
      "permission_denied",
      "Permissão de microfone bloqueada. Autorize o mic e use Reconectar.",
      true,
    );
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return new CaptureError(
      "device_missing",
      "Nenhum microfone encontrado. Pareie o headset Bluetooth e tente de novo.",
      true,
    );
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return new CaptureError(
      "unsupported",
      "MediaRecorder indisponível neste browser. Entrando em Safe Mode (Web Speech).",
      true,
    );
  }
  if (name === "SecurityError") {
    return new CaptureError(
      "secure_context",
      "Microfone exige contexto seguro (localhost/HTTPS).",
      true,
    );
  }
  return new CaptureError("unknown", message, true);
}

export class HeadsetCapture {
  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;
  private state: CaptureState = "idle";
  private activeLabel: string | null = null;

  constructor(private readonly options: HeadsetCaptureOptions = {}) {}

  getState(): CaptureState {
    return this.state;
  }

  getActiveLabel(): string | null {
    return this.activeLabel;
  }

  async start(): Promise<void> {
    if (this.state === "recording") {
      return;
    }

    const caps = probeCaptureCapabilities();
    if (!caps.secureContext) {
      this.state = "error";
      throw new CaptureError(
        "secure_context",
        "Microfone exige localhost ou HTTPS.",
        true,
      );
    }
    if (!caps.getUserMedia) {
      this.state = "error";
      throw new CaptureError(
        "unsupported",
        "getUserMedia não está disponível neste browser.",
        true,
      );
    }
    if (!caps.mediaRecorder) {
      this.state = "error";
      throw new CaptureError(
        "unsupported",
        "MediaRecorder não está disponível neste browser.",
        true,
      );
    }

    this.state = "requesting";
    try {
      // Omit deviceId → browser/OS default input (Bluetooth headset when default).
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      const track = this.mediaStream.getAudioTracks()[0];
      this.activeLabel = track?.label || "entrada padrão do sistema";
    } catch (err) {
      this.state = "error";
      this.activeLabel = null;
      throw classifyMediaError(err);
    }

    const mimeType = pickMimeType(
      this.options.preferredMimeTypes ?? DEFAULT_MIME_CANDIDATES,
    );
    this.chunks = [];
    try {
      this.recorder = new MediaRecorder(
        this.mediaStream,
        mimeType
          ? {
              mimeType,
              audioBitsPerSecond: this.options.audioBitsPerSecond ?? 128_000,
            }
          : { audioBitsPerSecond: this.options.audioBitsPerSecond ?? 128_000 },
      );
    } catch (err) {
      this.teardownStream();
      this.state = "error";
      throw classifyMediaError(err);
    }

    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.startedAt = performance.now();
    this.recorder.start(100);
    this.state = "recording";
  }

  async stop(): Promise<CaptureResult> {
    if (!this.recorder || this.state !== "recording") {
      throw new CaptureError("unknown", "Captura não está ativa", false);
    }
    this.state = "stopping";
    const recorder = this.recorder;
    const mimeType = recorder.mimeType || "audio/webm";
    const trackLabel = this.activeLabel;

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () =>
        reject(new CaptureError("unknown", "MediaRecorder error", true));
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: mimeType }));
      };
      recorder.stop();
    });

    this.teardownStream();
    this.state = "idle";
    return {
      blob,
      mimeType,
      durationMs: Math.round(performance.now() - this.startedAt),
      trackLabel,
    };
  }

  cancel(): void {
    if (this.recorder && (this.state === "recording" || this.state === "stopping")) {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.teardownStream();
    this.chunks = [];
    this.state = "idle";
  }

  private teardownStream(): void {
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.recorder = null;
  }
}

/** Soft probe: request mic, then release — used by Reconectar. */
export async function probeMicrophoneAccess(): Promise<{
  ok: boolean;
  label: string | null;
  error: CaptureError | null;
}> {
  const caps = probeCaptureCapabilities();
  if (!caps.secureContext) {
    return {
      ok: false,
      label: null,
      error: new CaptureError("secure_context", "Contexto inseguro (precisa localhost/HTTPS).", true),
    };
  }
  if (!caps.getUserMedia) {
    return {
      ok: false,
      label: null,
      error: new CaptureError("unsupported", "getUserMedia indisponível.", true),
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const label = stream.getAudioTracks()[0]?.label || "entrada padrão do sistema";
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true, label, error: null };
  } catch (err) {
    return { ok: false, label: null, error: classifyMediaError(err) };
  }
}

/** List audio input devices (after permission) so the user can confirm the BT mic. */
export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput");
}
