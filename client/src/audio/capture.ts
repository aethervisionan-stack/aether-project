/**
 * Microphone capture aimed at generic Bluetooth headsets.
 *
 * Prefers MediaRecorder on the OS / Bluetooth input. Callers should fall back
 * to Web Speech (Safe Mode) on NotAllowedError / unsupported paths — without
 * freezing the UI (permission probes are timed).
 */

export type CaptureState = "idle" | "requesting" | "recording" | "stopping" | "error";

export type CaptureFailureKind =
  | "permission_denied"
  | "device_missing"
  | "unsupported"
  | "secure_context"
  | "timeout"
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
  /** Soft timeout for getUserMedia so the HUD never freezes. */
  permissionTimeoutMs?: number;
}

export interface CaptureCapabilities {
  secureContext: boolean;
  mediaDevices: boolean;
  getUserMedia: boolean;
  mediaRecorder: boolean;
  speechRecognition: boolean;
}

export type MicPermissionState = "prompt" | "granted" | "denied" | "unknown";

const DEFAULT_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const HEADSET_LABEL_HINTS = [
  "m100",
  "headset",
  "bluetooth",
  "hands-free",
  "handsfree",
  "airpods",
  "buds",
  "wh-",
  "bt ",
];

const DEFAULT_PERMISSION_TIMEOUT_MS = 8_000;

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

export function looksLikeHeadsetLabel(label: string | null | undefined): boolean {
  const lower = (label || "").toLowerCase();
  if (!lower) return false;
  return HEADSET_LABEL_HINTS.some((hint) => lower.includes(hint));
}

/** Prefer Bluetooth / Headset M100-style labels when enumerating inputs. */
export function pickPreferredAudioInput(
  devices: MediaDeviceInfo[],
): MediaDeviceInfo | null {
  const inputs = devices.filter((d) => d.kind === "audioinput");
  if (!inputs.length) return null;
  const labeled = inputs.find((d) => looksLikeHeadsetLabel(d.label));
  if (labeled) return labeled;
  const withLabel = inputs.find((d) => (d.label || "").trim().length > 0);
  return withLabel ?? inputs[0] ?? null;
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

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    /permission|notallowed|denied/i.test(message)
  ) {
    return new CaptureError(
      "permission_denied",
      "Permissão de microfone negada. Safe Mode disponível sem recarregar.",
      true,
    );
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return new CaptureError(
      "device_missing",
      "Nenhum microfone encontrado. Pareie o headset Bluetooth (ex.: M100) e tente de novo.",
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
  if (name === "AbortError" || /timeout/i.test(message)) {
    return new CaptureError(
      "timeout",
      "Pedido de permissão demorou demais — a tentar Safe Mode.",
      true,
    );
  }
  return new CaptureError("unknown", message, true);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new CaptureError("timeout", `${label} timeout (${ms}ms)`, true));
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

/** Clean audio constraints — default device, BT-friendly processing. */
export function buildHeadsetAudioConstraints(
  deviceId?: string | null,
): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
  if (deviceId) {
    return { ...base, deviceId: { exact: deviceId } };
  }
  return base;
}

/**
 * One-shot permission / stream request. Never hangs forever.
 * Releases the stream unless `keepStream` is true.
 */
export async function requestMicrophoneStream(options: {
  deviceId?: string | null;
  timeoutMs?: number;
  keepStream?: boolean;
} = {}): Promise<{ stream: MediaStream; label: string }> {
  const caps = probeCaptureCapabilities();
  if (!caps.secureContext) {
    throw new CaptureError("secure_context", "Microfone exige localhost ou HTTPS.", true);
  }
  if (!caps.getUserMedia) {
    throw new CaptureError("unsupported", "getUserMedia indisponível neste browser.", true);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_PERMISSION_TIMEOUT_MS;
  try {
    const stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        audio: buildHeadsetAudioConstraints(options.deviceId),
        video: false,
      }),
      timeoutMs,
      "getUserMedia",
    );
    const track = stream.getAudioTracks()[0];
    const label = track?.label?.trim() || "entrada padrão do sistema";
    if (!options.keepStream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    return { stream, label };
  } catch (err) {
    throw classifyMediaError(err);
  }
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

  async start(preferredDeviceId?: string | null): Promise<void> {
    if (this.state === "recording") {
      return;
    }

    const caps = probeCaptureCapabilities();
    if (!caps.secureContext) {
      this.state = "error";
      throw new CaptureError("secure_context", "Microfone exige localhost ou HTTPS.", true);
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
      // Prefer a known headset deviceId when provided; else OS default.
      const { stream, label } = await requestMicrophoneStream({
        deviceId: preferredDeviceId ?? null,
        timeoutMs: this.options.permissionTimeoutMs ?? DEFAULT_PERMISSION_TIMEOUT_MS,
        keepStream: true,
      });
      this.mediaStream = stream;
      this.activeLabel = label;
    } catch (err) {
      // Retry once without exact deviceId if preferred device vanished.
      if (preferredDeviceId) {
        try {
          const { stream, label } = await requestMicrophoneStream({
            deviceId: null,
            timeoutMs: this.options.permissionTimeoutMs ?? DEFAULT_PERMISSION_TIMEOUT_MS,
            keepStream: true,
          });
          this.mediaStream = stream;
          this.activeLabel = label;
        } catch (retryErr) {
          this.state = "error";
          this.activeLabel = null;
          throw classifyMediaError(retryErr);
        }
      } else {
        this.state = "error";
        this.activeLabel = null;
        throw classifyMediaError(err);
      }
    }

    const mimeType = pickMimeType(
      this.options.preferredMimeTypes ?? DEFAULT_MIME_CANDIDATES,
    );
    this.chunks = [];
    try {
      this.recorder = new MediaRecorder(
        this.mediaStream!,
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

/** Soft probe: request mic, then release — used by Reconectar / mount. */
export async function probeMicrophoneAccess(options: {
  timeoutMs?: number;
  preferredDeviceId?: string | null;
} = {}): Promise<{
  ok: boolean;
  label: string | null;
  deviceId: string | null;
  error: CaptureError | null;
}> {
  try {
    // Try preferred headset first when we already know a deviceId.
    const { label } = await requestMicrophoneStream({
      deviceId: options.preferredDeviceId ?? null,
      timeoutMs: options.timeoutMs ?? DEFAULT_PERMISSION_TIMEOUT_MS,
      keepStream: false,
    });
    // After grant, enumerate to resolve stable deviceId + nicer label.
    const inputs = await listAudioInputs();
    const preferred = pickPreferredAudioInput(inputs);
    return {
      ok: true,
      label: preferred?.label || label,
      deviceId: preferred?.deviceId ?? null,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      label: null,
      deviceId: null,
      error: classifyMediaError(err),
    };
  }
}

/** List audio input devices (after permission) so the user can confirm the BT mic. */
export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput");
}

export async function queryMicPermissionState(): Promise<MicPermissionState> {
  try {
    const perms = navigator.permissions;
    if (!perms?.query) return "unknown";
    const status = await perms.query({ name: "microphone" as PermissionName });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Subscribe to device / permission changes for reactive HUD labels. */
export function watchMicrophoneEnvironment(handlers: {
  onDevicesChanged?: () => void;
  onPermissionChange?: (state: MicPermissionState) => void;
}): () => void {
  const cleanups: Array<() => void> = [];

  if (navigator.mediaDevices?.addEventListener) {
    const onDevice = () => handlers.onDevicesChanged?.();
    navigator.mediaDevices.addEventListener("devicechange", onDevice);
    cleanups.push(() => navigator.mediaDevices.removeEventListener("devicechange", onDevice));
  }

  void (async () => {
    try {
      const perms = navigator.permissions;
      if (!perms?.query) return;
      const status = await perms.query({ name: "microphone" as PermissionName });
      const onChange = () => {
        const next =
          status.state === "granted" || status.state === "denied" || status.state === "prompt"
            ? status.state
            : "unknown";
        handlers.onPermissionChange?.(next);
      };
      status.addEventListener("change", onChange);
      cleanups.push(() => status.removeEventListener("change", onChange));
      onChange();
    } catch {
      // Safari / Firefox may reject microphone PermissionName — ignore.
    }
  })();

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
