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
  | "device_busy"
  | "overconstrained"
  | "unsupported"
  | "secure_context"
  | "timeout"
  | "unknown";

export interface CaptureErrorDetail {
  domName?: string;
  constraint?: string;
  reason?: string;
}

export interface CaptureFailureRecord {
  at: string;
  context: string;
  domName: string;
  kind: CaptureFailureKind;
  message: string;
  reason: string;
  constraint: string | null;
  browserMessage: string;
}

const captureFailureLog: CaptureFailureRecord[] = [];
const CAPTURE_LOG_LIMIT = 8;

export class CaptureError extends Error {
  readonly kind: CaptureFailureKind;
  readonly recoverable: boolean;
  readonly domName: string | null;
  readonly constraint: string | null;
  readonly reason: string;

  constructor(
    kind: CaptureFailureKind,
    message: string,
    recoverable = true,
    detail?: CaptureErrorDetail,
  ) {
    super(message);
    this.name = "CaptureError";
    this.kind = kind;
    this.recoverable = recoverable;
    this.domName = detail?.domName ?? null;
    this.constraint = detail?.constraint ?? null;
    this.reason = detail?.reason ?? message;
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
  /** Fluxo caiu (mute prolongado ou track ended) — o HUD volta a procurar o Hands-Free. */
  onStreamInterrupted?: (info: { reason: "mute" | "ended"; label: string }) => void;
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

/** Captura Bluetooth do M100: o endpoint que o Windows chama Hands-Free / AG Audio. */
export function isM100HandsFreeLabel(label: string | null | undefined): boolean {
  const lower = (label || "").toLowerCase();
  if (!lower.includes("m100")) return false;
  return (
    lower.includes("hands-free") ||
    lower.includes("handsfree") ||
    lower.includes("hands free") ||
    lower.includes("ag audio") ||
    lower.includes("áudio ag") ||
    lower.includes("audio ag")
  );
}

export function looksLikeHeadsetLabel(label: string | null | undefined): boolean {
  const lower = (label || "").toLowerCase();
  if (!lower) return false;
  return HEADSET_LABEL_HINTS.some((hint) => lower.includes(hint));
}

/** Prefer Hands-Free, AG Audio, then any M100 capture. Never a list index. */
export function selectHandsFreeInput(
  devices: MediaDeviceInfo[],
): MediaDeviceInfo | null {
  const inputs = devices.filter((device) => {
    if (device.kind !== "audioinput") return false;
    if (!device.deviceId || device.deviceId === "default" || device.deviceId === "communications") {
      return false;
    }
    return true;
  });
  let best: MediaDeviceInfo | null = null;
  let bestScore = 0;
  for (const device of inputs) {
    const score = handsFreeLabelScore(device.label);
    if (score > bestScore) {
      best = device;
      bestScore = score;
    }
  }
  return best;
}

function handsFreeLabelScore(label: string | null | undefined): number {
  const lower = (label || "").toLowerCase();
  if (!lower) return 0;
  const handsFree = isHandsFreeAgLabel(lower);
  const m100 = lower.includes("m100");
  if (m100 && handsFree) return 3;
  if (handsFree) return 2;
  if (m100) return 1;
  return 0;
}

export function isHandsFreeAgLabel(label: string | null | undefined): boolean {
  const lower = (label || "").toLowerCase();
  return (
    lower.includes("hands-free") ||
    lower.includes("handsfree") ||
    lower.includes("hands free") ||
    lower.includes("ag audio") ||
    lower.includes("áudio ag") ||
    lower.includes("audio ag")
  );
}

export function pickPreferredAudioInput(
  devices: MediaDeviceInfo[],
): MediaDeviceInfo | null {
  return selectHandsFreeInput(devices);
}

/**
 * Resolve o microfone pelo label atual. O deviceId de um adaptador USB anterior
 * deixa de ser usado quando o Hands-Free volta com outro id.
 */
export async function resolveHandsFreeDeviceId(
  previousDeviceId?: string | null,
): Promise<string | null> {
  let inputs: MediaDeviceInfo[] = [];
  try {
    inputs = await listAudioInputs();
  } catch (err) {
    console.warn("[aether:audio] enumerateDevices falhou ao resolver Hands-Free", err);
    return null;
  }
  const selected = selectHandsFreeInput(inputs);
  if (!selected) {
    console.warn(
      "[aether:audio] nenhum audioinput Hands-Free / AG Audio. O id anterior não é reutilizado.",
      {
        previousDeviceId: previousDeviceId ?? null,
        inputs: inputs.map((device) => device.label || "(sem label)"),
      },
    );
    return null;
  }
  if (previousDeviceId && previousDeviceId !== selected.deviceId) {
    console.info("[aether:audio] endpoint Hands-Free mudou após troca de adaptador", {
      previousDeviceId,
      deviceId: selected.deviceId,
      label: selected.label,
    });
  } else {
    console.info("[aether:audio] Hands-Free AG Audio selecionado pelo label", {
      deviceId: selected.deviceId,
      label: selected.label,
    });
  }
  return selected.deviceId;
}

function readConstraint(err: unknown): string | null {
  if (!err || typeof err !== "object" || !("constraint" in err)) return null;
  const constraint = (err as { constraint?: unknown }).constraint;
  return typeof constraint === "string" && constraint.length > 0 ? constraint : null;
}

function failureDetail(
  domName: string,
  reason: string,
  constraint: string | null,
): CaptureErrorDetail {
  const detail: CaptureErrorDetail = { domName, reason };
  if (constraint) detail.constraint = constraint;
  return detail;
}

/**
 * Traduz o DOMException de getUserMedia para uma causa acionável.
 * NotFound / NotReadable / Overconstrained são as recusas típicas do
 * perfil Hands-Free quando o Windows só expõe A2DP ou segura o HFP.
 */
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
  const constraint = readConstraint(err);
  const browserNote = message && message !== name ? ` Mensagem do browser: ${message}` : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    /permission|notallowed|denied/i.test(message)
  ) {
    const reason =
      "Permissão de microfone negada ou o prompt foi fechado. O site precisa de acesso em localhost/HTTPS. Safe Mode (Web Speech) continua disponível.";
    return new CaptureError(
      "permission_denied",
      `${name || "NotAllowedError"}: ${reason}`,
      true,
      failureDetail(name || "NotAllowedError", reason, constraint),
    );
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    const reason =
      "Nenhum audioinput satisfaz o pedido. No Bluetooth, A2DP Stereo não tem microfone — a captura só existe no endpoint Hands-Free / AG Audio (HFP/HSP). Pareie o M100, confirme esse dispositivo em Som → Gravação e re-enumere.";
    return new CaptureError(
      "device_missing",
      `${name}: ${reason}${browserNote}`,
      true,
      failureDetail(name, reason, constraint),
    );
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    const reason =
      "O sistema recusou abrir o microfone. Causas habituais: outro processo (Teams, Discord, Zoom) está com o HFP em modo exclusivo, o perfil Bluetooth ficou preso, ou o driver devolveu o device mas não inicia a captura. Feche essas apps, desmarque o controlo exclusivo do microfone e force o reset do AudioContext.";
    return new CaptureError(
      "device_busy",
      `${name}: ${reason}${browserNote}`,
      true,
      failureDetail(name, reason, constraint),
    );
  }
  if (name === "OverconstrainedError") {
    const constraintNote = constraint ? ` Constraint recusada: ${constraint}.` : "";
    const reason =
      `As constraints não cabem neste endpoint.${constraintNote} deviceId exact pode apontar para um id que o Bluetooth já invalidou; channelCount, echoCancellation, noiseSuppression ou autoGainControl por vezes são recusados no HFP mono. A captura tenta de novo sem deviceId exact.`;
    return new CaptureError(
      "overconstrained",
      `${name}: ${reason}${browserNote}`,
      true,
      failureDetail(name, reason, constraint),
    );
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    const reason =
      "MediaRecorder ou getUserMedia indisponível neste browser. Entrando em Safe Mode (Web Speech).";
    return new CaptureError(
      "unsupported",
      `${name || "NotSupportedError"}: ${reason}`,
      true,
      failureDetail(name || "NotSupportedError", reason, constraint),
    );
  }
  if (name === "SecurityError") {
    const reason = "Microfone exige contexto seguro (localhost ou HTTPS).";
    return new CaptureError(
      "secure_context",
      `${name}: ${reason}`,
      true,
      failureDetail(name, reason, constraint),
    );
  }
  if (name === "AbortError" || /timeout/i.test(message)) {
    const reason = "O pedido de captura foi abortado ou a permissão demorou demais.";
    return new CaptureError(
      "timeout",
      `${name || "AbortError"}: ${reason}`,
      true,
      failureDetail(name || "AbortError", reason, constraint),
    );
  }
  const reason = message || "Falha desconhecida na captura de áudio.";
  return new CaptureError(
    "unknown",
    name ? `${name}: ${reason}` : reason,
    true,
    failureDetail(name || "Error", reason, constraint),
  );
}

/** Registo da sessão + console, para o HUD mostrar a recusa exacta do getUserMedia. */
export function recordCaptureFailure(err: unknown, context: string): CaptureError {
  const browserMessage = err instanceof Error ? err.message : "";
  const classified = classifyMediaError(err);
  const entry: CaptureFailureRecord = {
    at: new Date().toISOString(),
    context,
    domName: classified.domName ?? "Error",
    kind: classified.kind,
    message: classified.message,
    reason: classified.reason,
    constraint: classified.constraint,
    browserMessage,
  };
  captureFailureLog.unshift(entry);
  if (captureFailureLog.length > CAPTURE_LOG_LIMIT) {
    captureFailureLog.length = CAPTURE_LOG_LIMIT;
  }
  console.error("[aether:audio] captura recusada", entry);
  return classified;
}

export function recentCaptureFailures(): CaptureFailureRecord[] {
  return captureFailureLog.slice();
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
  /** Falha fica no console e não altera o estado visível da aplicação. */
  silent?: boolean;
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
    if (options.silent) {
      const classified = classifyMediaError(err);
      console.info("[aether:audio] getUserMedia silencioso", {
        kind: classified.kind,
        deviceId: options.deviceId ?? null,
      });
      throw classified;
    }
    throw recordCaptureFailure(err, "getUserMedia");
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
    const resolvedId = await resolveHandsFreeDeviceId(preferredDeviceId);
    try {
      const { stream, label } = await requestMicrophoneStream({
        deviceId: resolvedId,
        timeoutMs: this.options.permissionTimeoutMs ?? DEFAULT_PERMISSION_TIMEOUT_MS,
        keepStream: true,
      });
      this.mediaStream = stream;
      this.activeLabel = label;
    } catch (err) {
      const retryId = await resolveHandsFreeDeviceId(null);
      if (retryId && retryId !== resolvedId) {
        try {
          console.info("[aether:audio] nova tentativa no Hands-Free recém-enumerado", {
            deviceId: retryId,
          });
          const { stream, label } = await requestMicrophoneStream({
            deviceId: retryId,
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

    const track = this.mediaStream?.getAudioTracks()[0];
    if (track) this.armTrackWatch(track);

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
    console.log("[aether:stage] capture.start", {
      mimeType: this.recorder.mimeType || mimeType || "(default)",
      label: this.activeLabel,
      tracks: this.mediaStream?.getAudioTracks().length ?? 0,
    });
  }

  async stop(): Promise<CaptureResult> {
    if (!this.recorder || this.state !== "recording") {
      throw new CaptureError("unknown", "Captura não está ativa", false);
    }
    this.state = "stopping";
    const recorder = this.recorder;
    const mimeType = recorder.mimeType || "audio/webm";
    const trackLabel = this.activeLabel;
    console.log("[aether:stage] capture.stopping", {
      mimeType,
      chunks: this.chunks.length,
      label: trackLabel,
    });

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
    const result = {
      blob,
      mimeType,
      durationMs: Math.round(performance.now() - this.startedAt),
      trackLabel,
    };
    console.log("[aether:stage] capture.stopped", {
      size: result.blob.size,
      type: result.mimeType,
      durationMs: result.durationMs,
      label: result.trackLabel,
    });
    return result;
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

  private armTrackWatch(track: MediaStreamTrack): void {
    let muteTimer: number | undefined;
    const report = (reason: "mute" | "ended") => {
      const label = track.label || this.activeLabel || "";
      console.warn("[aether:audio] fluxo de áudio caiu por perda de pacote Bluetooth", {
        reason,
        label,
        readyState: track.readyState,
        muted: track.muted,
      });
      console.info(
        "[aether:audio] reconexão automática: a procurar Hands-Free AG Audio / M100 pelo label",
      );
      this.options.onStreamInterrupted?.({ reason, label });
    };
    track.addEventListener("mute", () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
      muteTimer = window.setTimeout(() => {
        if (track.muted || track.readyState === "ended") report("mute");
      }, 700);
    });
    track.addEventListener("unmute", () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
      muteTimer = undefined;
      console.info("[aether:audio] fluxo Bluetooth retomado", { label: track.label });
    });
    track.addEventListener("ended", () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
      report("ended");
    });
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
  silent?: boolean;
} = {}): Promise<{
  ok: boolean;
  label: string | null;
  deviceId: string | null;
  error: CaptureError | null;
}> {
  try {
    const deviceId = await resolveHandsFreeDeviceId(options.preferredDeviceId);
    const opened = await requestMicrophoneStream({
      deviceId,
      timeoutMs: options.timeoutMs ?? DEFAULT_PERMISSION_TIMEOUT_MS,
      keepStream: false,
      ...(options.silent ? { silent: true } : {}),
    });
    const label = opened.label;
    const inputs = await listAudioInputs();
    const preferred = selectHandsFreeInput(inputs);
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
    } catch {
      // Safari / Firefox may reject microphone PermissionName — ignore.
    }
  })();

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
