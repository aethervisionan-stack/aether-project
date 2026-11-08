import { voiceApi } from "../api/client";
import type {
  ChatHistoryItem,
  CognitiveChatResponse,
  GeminiMode,
  HealthResponse,
  MetricsResponse,
  ProcessAudioResponse,
  SessionHistoryItem,
} from "../api/types";
import { VoiceApiError } from "../api/types";
import type { ConsensoResult } from "../api/types";
import {
  CaptureError,
  HeadsetCapture,
  isM100HandsFreeLabel,
  isMediaRecorderCaptureAvailable,
  listAudioInputs,
  looksLikeHeadsetLabel,
  pickPreferredAudioInput,
  probeCaptureCapabilities,
  probeMicrophoneAccess,
  queryMicPermissionState,
  selectHandsFreeInput,
  recentCaptureFailures,
  watchMicrophoneEnvironment,
  type MicPermissionState,
} from "../audio/capture";
import {
  ensureAudioContextRunning,
  isBluetoothRadioMissing,
  inspectAudioDevices,
  readAudioContextState,
  resetAudioContext,
  unlockAudioForGesture,
  type AudioDeviceInspection,
} from "../audio/diagnostics";
import { playResponseAudio } from "../audio/playback";
import {
  SpeechCaptureError,
  WebSpeechCapture,
  isSpeechRecognitionAvailable,
  speakLocally,
} from "../audio/speech";
import { renderAudioDiagnosticsPanel } from "./components/AudioDiagnosticsPanel";
import { renderMetricsPanel } from "./components/MetricsPanel";
import { renderSessionHistory } from "./components/SessionHistory";
import { escapeHtml, formatMs, formatPercent } from "./html";
import { renderMarkdown } from "./markdown";

/** Portuguese flow states for the Bluetooth headset control UI. */
type UiPhase = "idle" | "listening" | "validating" | "responding";
type AuditTab = "history" | "metrics";
/** Mic HUD: MediaRecorder ok · permission denied · Web Speech fallback. */
type MicStatus = "active" | "blocked" | "safe";
type CaptureMode = "mediarecorder" | "webspeech";

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "Pronto",
  listening: "A escutar...",
  validating: "Validando no Consenso Alfa...",
  responding: "A responder...",
};

const MIC_STATUS_LABEL: Record<MicStatus, string> = {
  active: "Active",
  blocked: "Blocked",
  safe: "Safe Mode",
};

const HUD_CLIENT_ID = "default";

export class ControlApp {
  private readonly root: HTMLElement;
  private lastBluetoothDropAt = 0;
  private readonly capture = new HeadsetCapture({
    onStreamInterrupted: (info) => {
      const now = Date.now();
      if (now - this.lastBluetoothDropAt < 4_000) {
        console.info("[aether:audio] reconexão silenciosa adiada", info);
        return;
      }
      this.lastBluetoothDropAt = now;
      console.info("[aether:audio] reconexão silenciosa do microfone Hands-Free", info);
      void this.reconnectMic({ silent: true });
    },
  });
  private readonly speech = new WebSpeechCapture();
  private phase: UiPhase = "idle";
  private health: HealthResponse | null = null;
  private lastResult: ProcessAudioResponse | null = null;
  private errorMessage: string | null = null;
  private devices: MediaDeviceInfo[] = [];
  private audioInspect: AudioDeviceInspection[] = [];
  private audioContextState = "none";
  private diagBusy = false;
  private diagNote: string | null = null;
  private activeMicLabel: string | null = null;
  private healthTimer: number | null = null;
  private readonly healthPollMs = 4_000;
  /** Start blocked until probe — never default into Web Speech Safe Mode. */
  private micStatus: MicStatus = "blocked";
  private captureMode: CaptureMode = "mediarecorder";
  private reconnectBusy = false;
  private speechInterim = "";
  private speechPollTimer: number | null = null;
  private preferredDeviceId: string | null = null;
  private permissionState: MicPermissionState = "unknown";
  private autoRetryDone = false;
  private micWatchStop: (() => void) | null = null;
  private enteringSafeMode = false;
  /** deviceIds de audioinput já vistos — chegadas novas disparam o reconnect. */
  private knownInputIds = new Set<string>();
  private inputBaselineReady = false;
  private m100ActivatedLogged = false;
  private deviceChangeTimer: number | null = null;

  /** Collapsible audit panel (history + metrics). */
  private auditOpen = true;
  private auditTab: AuditTab = "history";
  private historyItems: SessionHistoryItem[] = [];
  private metrics: MetricsResponse | null = null;
  private auditLoading = false;
  private auditError: string | null = null;

  /** Gemini cognitive chat (flash | pro) + structured history. */
  private geminiMode: GeminiMode = "flash";
  private chatHistory: ChatHistoryItem[] = [];
  private lastChat: CognitiveChatResponse | null = null;
  private chatBusy = false;
  private chatDraft = "";
  /** Text kept when autoplay + speechSynthesis both fail — tap «Ouvir resposta». */
  private pendingSpeakText: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async mount(): Promise<void> {
    this.render();
    await this.refreshHealth();
    await this.probeMicStatus({ quiet: true });
    await this.captureInputBaseline();
    this.bindMicEnvironmentWatch();
    // One soft auto-retry if still blocked (permission prompt may have been missed).
    if (this.micStatus === "blocked" && !this.autoRetryDone) {
      this.autoRetryDone = true;
      window.setTimeout(() => {
        if (this.micStatus === "blocked" && this.phase === "idle") {
          void this.reconnectMic({ fromAutoRetry: true });
        }
      }, 1200);
    }
    await this.refreshAudit({ quiet: true });
    this.startHealthPolling();
    this.startHandsFreeWatch();
  }

  private bindMicEnvironmentWatch(): void {
    this.micWatchStop?.();
    this.micWatchStop = watchMicrophoneEnvironment({
      onDevicesChanged: () => {
        this.scheduleAudioInputReconnect();
      },
      onPermissionChange: (state) => {
        this.permissionState = state;
        if (state === "granted") {
          void this.probeMicStatus({ quiet: true });
        } else if (state === "denied") {
          // Instant Safe Mode — never freeze on Blocked when Web Speech works.
          void this.enterSafeModeInstant(
            "Permissão negada pelo browser — Safe Mode ativo.",
          );
        }
        this.render();
      },
    });
  }

  /** Soft mic probe — no full page reload. Prefer MediaRecorder; Safe Mode only on true mic deny. */
  private async probeMicStatus(options: { quiet?: boolean; silent?: boolean } = {}): Promise<void> {
    this.permissionState = await queryMicPermissionState();
    await this.refreshAudioInspect();
    const caps = probeCaptureCapabilities();
    if (!isMediaRecorderCaptureAvailable()) {
      // Keep Gemini path preferred on phone HTTPS — do NOT auto-drop to Web Speech.
      this.micStatus = "blocked";
      this.captureMode = "mediarecorder";
      const detail = !caps.secureContext
        ? "Contexto inseguro — abra o túnel HTTPS (start_mobile_test.ps1)."
        : !caps.getUserMedia
          ? "getUserMedia indisponível neste browser."
          : "MediaRecorder indisponível — use HTTPS / browser atualizado.";
      console.error("[aether:stage] mic.probe.mediarecorder_unavailable", {
        caps,
        detail,
      });
      if (!options.quiet) {
        this.errorMessage = `${detail} Safe Mode manual disponível se a permissão estiver bloqueada.`;
      }
      this.render();
      return;
    }

    const probe = await probeMicrophoneAccess({
      preferredDeviceId: this.preferredDeviceId,
      timeoutMs: 8_000,
      ...(options.silent ? { silent: true } : {}),
    });
    if (!probe.ok && options.silent) {
      console.info("[aether:audio] reconexão silenciosa sem endpoint Hands-Free", {
        kind: probe.error?.kind ?? "unknown",
      });
      return;
    }
    if (probe.ok) {
      this.micStatus = "active";
      this.captureMode = "mediarecorder";
      this.activeMicLabel = probe.label;
      this.preferredDeviceId = probe.deviceId;
      this.permissionState = "granted";
      try {
        this.devices = await listAudioInputs();
        const preferred = pickPreferredAudioInput(this.devices);
        this.noteInputIds(this.devices);
        if (preferred?.label) {
          this.activeMicLabel = preferred.label;
          this.preferredDeviceId = preferred.deviceId;
        }
        await this.refreshAudioInspect();
      } catch {
        // enumeration optional after grant
      }
      if (!options.quiet) {
        this.errorMessage = null;
      }
      this.render();
      return;
    }

    const kind = probe.error?.kind;
    const realError =
      probe.error?.message ?? "Falha ao abrir o microfone (MediaRecorder).";
    console.error("[aether:stage] mic.probe.failed", {
      kind: kind ?? "unknown",
      message: realError,
      permissionState: this.permissionState,
    });

    // Safe Mode ONLY for true mic permission block — never for network/API/device glitches.
    if (kind === "permission_denied" && isSpeechRecognitionAvailable()) {
      this.permissionState = "denied";
      await this.enterSafeModeInstant(
        options.quiet
          ? null
          : `${realError} — Safe Mode (Web Speech) só por bloqueio de permissão.`,
      );
      return;
    }

    this.micStatus = "blocked";
    this.captureMode = "mediarecorder";
    if (kind === "permission_denied") {
      this.permissionState = "denied";
      this.activeMicLabel = null;
    }
    if (!options.quiet) {
      this.errorMessage =
        kind === "permission_denied"
          ? "Microfone bloqueado. Autorize o site ou use Safe Mode / Reconectar."
          : realError;
    }
    this.render();
  }

  /** Flip to Safe Mode immediately without awaiting another getUserMedia. */
  private async enterSafeModeInstant(message: string | null): Promise<void> {
    if (this.enteringSafeMode) return;
    this.enteringSafeMode = true;
    try {
      this.capture.cancel();
      this.micStatus = "safe";
      this.captureMode = "webspeech";
      // Keep real headset label if we already know it (e.g. Headset M100).
      if (!this.activeMicLabel || this.activeMicLabel.startsWith("Web Speech")) {
        try {
          const inputs = await listAudioInputs();
          const preferred = pickPreferredAudioInput(inputs);
          if (preferred?.label) {
            this.activeMicLabel = preferred.label;
            this.preferredDeviceId = preferred.deviceId;
          } else if (!this.activeMicLabel) {
            this.activeMicLabel = "Web Speech · Safe Mode";
          }
        } catch {
          if (!this.activeMicLabel) {
            this.activeMicLabel = "Web Speech · Safe Mode";
          }
        }
      }
      if (message) {
        this.errorMessage = message;
      }
      this.render();
    } finally {
      this.enteringSafeMode = false;
    }
  }

  private async refreshAudioInspect(): Promise<void> {
    try {
      this.audioInspect = await inspectAudioDevices();
      this.audioContextState = readAudioContextState();
    } catch (err) {
      const name = err instanceof Error ? err.name : "Error";
      const message = err instanceof Error ? err.message : "enumerateDevices falhou.";
      this.diagNote = `enumerateDevices: ${name} — ${message}`;
    }
  }

  private async forceAudioReset(): Promise<void> {
    if (this.diagBusy || this.phase !== "idle") return;
    this.diagBusy = true;
    this.diagNote = null;
    this.render();
    try {
      const result = await resetAudioContext();
      await this.refreshAudioInspect();
      this.audioContextState = result.current;
      const action =
        result.action === "resumed"
          ? "retomado"
          : result.action === "recreated"
            ? "recriado"
            : result.action === "created"
              ? "criado"
              : "indisponível";
      this.diagNote = `AudioContext ${action}: ${result.previous} → ${result.current}. ${this.audioInspect.length} dispositivos de áudio.`;
      const inputs = this.audioInspect.filter((device) => device.kind === "audioinput");
      if (inputs.length) {
        const preferred =
          inputs.find((device) => device.profile === "hfp" && device.label) ??
          inputs.find((device) => device.label);
        if (preferred?.label) {
          this.activeMicLabel = preferred.label;
          this.preferredDeviceId = preferred.deviceId;
        }
      }
    } catch (err) {
      this.diagNote =
        err instanceof Error ? err.message : "Falha ao repor o AudioContext.";
    } finally {
      this.diagBusy = false;
      this.render();
    }
  }

  private noteInputIds(devices: MediaDeviceInfo[]): void {
    this.knownInputIds = new Set(
      devices.map((device) => device.deviceId).filter((id) => id.length > 0),
    );
    this.inputBaselineReady = true;
  }

  private async captureInputBaseline(): Promise<void> {
    try {
      this.noteInputIds(await listAudioInputs());
    } catch {
      this.knownInputIds = new Set();
      this.inputBaselineReady = true;
    }
  }

  /** Agrupa o burst de devicechange do Windows num único reconnect. */
  private scheduleAudioInputReconnect(): void {
    if (this.deviceChangeTimer !== null) {
      window.clearTimeout(this.deviceChangeTimer);
    }
    this.deviceChangeTimer = window.setTimeout(() => {
      this.deviceChangeTimer = null;
      void this.handleAudioInputChange();
    }, 450);
  }

  /**
   * ondevicechange: se surgir um audioinput novo com o HUD em Blocked/Safe Mode,
   * abre o microfone outra vez. M100 Hands-Free passa a Active e regista uma linha.
   */
  private async handleAudioInputChange(): Promise<void> {
    if (!this.inputBaselineReady) return;
    let inputs: MediaDeviceInfo[] = [];
    try {
      inputs = await listAudioInputs();
    } catch {
      return;
    }
    this.devices = inputs;
    await this.refreshAudioInspect();
    const arrived = inputs.filter(
      (device) => device.deviceId.length > 0 && !this.knownInputIds.has(device.deviceId),
    );
    this.knownInputIds = new Set(
      inputs.map((device) => device.deviceId).filter((id) => id.length > 0),
    );
    const m100 = inputs.find((device) => isM100HandsFreeLabel(device.label)) ?? null;
    if (!m100) {
      this.m100ActivatedLogged = false;
    }
    const down = this.micStatus === "blocked" || this.micStatus === "safe";
    const m100Arrival = arrived.find((device) => isM100HandsFreeLabel(device.label)) ?? null;
    const shouldReconnect =
      this.phase === "idle" &&
      !this.reconnectBusy &&
      (Boolean(m100Arrival) || (arrived.length > 0 && down));

    if (!shouldReconnect) {
      if (m100?.label && this.micStatus === "active") {
        this.activeMicLabel = m100.label;
        this.preferredDeviceId = m100.deviceId;
      }
      this.render();
      return;
    }

    const target = m100Arrival ?? m100 ?? arrived[0];
    if (target?.deviceId) {
      this.preferredDeviceId = target.deviceId;
    }
    await this.reconnectMic({ fromDeviceChange: true });
    const activated =
      this.micStatus === "active" &&
      (isM100HandsFreeLabel(this.activeMicLabel) || Boolean(m100Arrival));
    if (activated && !this.m100ActivatedLogged) {
      this.m100ActivatedLogged = true;
      console.info("[aether:audio] M100 detectado e ativado");
    }
  }

  private async refreshDeviceLabel(options: { quiet?: boolean } = {}): Promise<void> {
    try {
      const inputs = await listAudioInputs();
      this.devices = inputs;
      await this.refreshAudioInspect();
      const preferred = pickPreferredAudioInput(inputs);
      if (preferred?.label) {
        this.activeMicLabel = preferred.label;
        this.preferredDeviceId = preferred.deviceId;
        if (this.micStatus === "active" || looksLikeHeadsetLabel(preferred.label)) {
          // Device plugged in while Safe/Blocked — nudge toward Active if permitted.
          if (this.permissionState === "granted" && this.micStatus !== "active") {
            this.micStatus = "active";
            this.captureMode = "mediarecorder";
          }
        }
      }
      if (!options.quiet) this.render();
      else this.render();
    } catch {
      // ignore — empty labels until permission
    }
  }

  private async reconnectMic(options: {
    fromAutoRetry?: boolean;
    fromDeviceChange?: boolean;
    silent?: boolean;
  } = {}): Promise<void> {
    if (this.reconnectBusy || this.phase !== "idle") return;
    this.reconnectBusy = true;
    if (!options.silent && options.fromDeviceChange) {
      this.diagNote = "Nova entrada de áudio — a reabrir o microfone.";
    }
    if (!options.silent) {
      this.errorMessage = options.fromAutoRetry
        ? "A tentar permissão do microfone novamente…"
        : null;
      this.capture.cancel();
      this.speech.cancel();
      this.speechInterim = "";
      this.render();
    }
    try {
      if (options.silent) {
        await this.probeMicStatus({ quiet: true, silent: true });
        return;
      }
      await this.probeMicStatus({ quiet: false });
      if (this.micStatus === "active") {
        this.errorMessage = null;
        if (options.fromDeviceChange) {
          this.diagNote = null;
        }
        this.activeMicLabel =
          this.activeMicLabel ?? "entrada padrão do sistema";
      }
    } finally {
      this.reconnectBusy = false;
      this.render();
    }
  }

  private startHandsFreeWatch(): void {
    window.setInterval(() => {
      void this.retryHandsFreeSilently();
    }, 2000);
  }

  private async retryHandsFreeSilently(): Promise<void> {
    if (this.reconnectBusy || this.phase !== "idle" || this.permissionState === "denied") return;
    let inputs: MediaDeviceInfo[] = [];
    try {
      inputs = await listAudioInputs();
    } catch {
      return;
    }
    const target = selectHandsFreeInput(inputs);
    if (!target) return;
    if (this.micStatus === "active" && this.preferredDeviceId === target.deviceId) return;
    console.info("[aether:audio] reconexão silenciosa a cada 2s", { label: target.label });
    await this.reconnectMic({ silent: true });
  }

  private startHealthPolling(): void {
    if (this.healthTimer !== null) {
      window.clearInterval(this.healthTimer);
    }
    this.healthTimer = window.setInterval(() => {
      void this.refreshHealth({ quiet: true });
    }, this.healthPollMs);
  }

  private setPhase(phase: UiPhase): void {
    this.phase = phase;
    if (phase === "listening" && this.captureMode === "webspeech") {
      this.startSpeechInterimPoll();
    } else {
      this.stopSpeechInterimPoll();
    }
    this.render();
  }

  private startSpeechInterimPoll(): void {
    this.stopSpeechInterimPoll();
    this.speechPollTimer = window.setInterval(() => {
      if (!this.speech.isListening()) return;
      const next = this.speech.getInterim();
      if (next !== this.speechInterim) {
        this.speechInterim = next;
        this.render();
      }
    }, 400);
  }

  private stopSpeechInterimPoll(): void {
    if (this.speechPollTimer !== null) {
      window.clearInterval(this.speechPollTimer);
      this.speechPollTimer = null;
    }
  }

  private async refreshHealth(options: { quiet?: boolean } = {}): Promise<void> {
    try {
      this.health = await voiceApi.health();
      if (!options.quiet) {
        this.errorMessage = null;
      }
    } catch (err) {
      this.health = null;
      if (!options.quiet) {
        this.errorMessage =
          err instanceof VoiceApiError
            ? `${err.message} — ${err.detail}`
            : "Backend indisponível. Inicie o FastAPI em :8001 (use start_app.bat).";
      }
    }
    this.render();
  }

  /** Pull SessionLogs + consolidated metrics for the HUD panels. */
  private async refreshAudit(options: { quiet?: boolean } = {}): Promise<void> {
    this.auditLoading = true;
    if (!options.quiet) {
      this.auditError = null;
    }
    this.render();
    try {
      const [history, metrics] = await Promise.all([
        voiceApi.history({ limit: 40, clientId: HUD_CLIENT_ID }),
        voiceApi.metrics(),
      ]);
      this.historyItems = history.items;
      this.metrics = metrics;
      this.auditError = null;
    } catch (err) {
      if (!options.quiet) {
        this.auditError =
          err instanceof VoiceApiError
            ? `${err.message}${err.detail ? ` — ${err.detail}` : ""}`
            : "Falha ao carregar histórico / métricas.";
      }
    } finally {
      this.auditLoading = false;
      this.render();
    }
  }

  private async refreshDevices(): Promise<void> {
    try {
      const probe = await probeMicrophoneAccess({
        preferredDeviceId: this.preferredDeviceId,
        timeoutMs: 8_000,
      });
      if (!probe.ok) {
        throw probe.error ?? new CaptureError("unknown", "Falha ao listar microfones.");
      }
      this.devices = await listAudioInputs();
      await this.refreshAudioInspect();
      this.noteInputIds(this.devices);
      const m100 = this.devices.find((device) => isM100HandsFreeLabel(device.label));
      const preferred = m100 ?? pickPreferredAudioInput(this.devices);
      if (m100 && !this.m100ActivatedLogged) {
        this.m100ActivatedLogged = true;
        console.info("[aether:audio] M100 detectado e ativado");
      }
      this.micStatus = "active";
      this.captureMode = "mediarecorder";
      this.activeMicLabel = preferred?.label || probe.label;
      this.preferredDeviceId = preferred?.deviceId ?? probe.deviceId;
      this.permissionState = "granted";
      this.errorMessage = null;
    } catch (err) {
      const classified = err instanceof CaptureError ? err : classifySoft(err);
      console.error("[aether:stage] refreshDevices.failed", {
        kind: classified.kind,
        message: classified.message,
      });
      // Permission deny → optional Safe Mode. All other errors stay on MediaRecorder/Gemini.
      if (classified.kind === "permission_denied" && isSpeechRecognitionAvailable()) {
        this.permissionState = "denied";
        await this.enterSafeModeInstant(
          `${classified.message} Clique em Falar (Safe Mode) ou Reconectar.`,
        );
        return;
      }
      this.micStatus = "blocked";
      this.captureMode = "mediarecorder";
      if (classified.kind === "permission_denied") {
        this.permissionState = "denied";
      }
      this.errorMessage = classified.message;
    }
    this.render();
  }

  private async toggleRecord(): Promise<void> {
    // Unlock WebAudio + warm speechSynthesis inside the user gesture (mobile autoplay).
    try {
      await unlockAudioForGesture();
    } catch (err) {
      console.warn("[aether:stage] audio.unlock_failed", err);
    }

    if (this.phase === "listening") {
      await this.finishRecord();
      return;
    }
    if (this.phase !== "idle") {
      return;
    }

    this.errorMessage = null;
    this.speechInterim = "";

    // Phone field path: ALWAYS retry MediaRecorder → relative /api/process-audio → Gemini
    // when the browser can do it — even if HUD previously flipped to Safe Mode.
    // Web Speech only after a true NotAllowedError on this click (or manual Safe Mode
    // when MediaRecorder itself is unavailable).
    if (isMediaRecorderCaptureAvailable()) {
      try {
        await this.capture.start(this.preferredDeviceId);
        this.activeMicLabel = this.capture.getActiveLabel();
        this.micStatus = "active";
        this.captureMode = "mediarecorder";
        this.permissionState = "granted";
        void this.refreshDeviceLabel({ quiet: true });
        this.setPhase("listening");
        return;
      } catch (err) {
        const classified = err instanceof CaptureError ? err : classifySoft(err);
        this.capture.cancel();
        console.error("[aether:stage] capture.start.failed", {
          kind: classified.kind,
          message: classified.message,
          domName: classified.domName,
        });
        // True mic permission deny → Safe Mode. Everything else stays on Gemini path.
        if (classified.kind === "permission_denied") {
          this.permissionState = "denied";
          if (isSpeechRecognitionAvailable()) {
            await this.enterSafeModeInstant(
              `${classified.message} — Safe Mode só por bloqueio de permissão.`,
            );
            // Fall through to start speech in the same click.
          } else {
            this.micStatus = "blocked";
            this.captureMode = "mediarecorder";
            this.errorMessage =
              "Microfone bloqueado. Autorize o site em Definições do browser e Reconectar.";
            this.setPhase("idle");
            return;
          }
        } else {
          this.micStatus = "blocked";
          this.captureMode = "mediarecorder";
          this.errorMessage = classified.message;
          this.setPhase("idle");
          return;
        }
      }
    }

    // Web Speech path — only after true permission deny this click, or manual Safe Mode
    // when MediaRecorder/getUserMedia is unavailable (e.g. plain HTTP).
    if (this.captureMode !== "webspeech") {
      this.errorMessage =
        "MediaRecorder indisponível neste browser. Ative Safe Mode manualmente ou use HTTPS.";
      this.setPhase("idle");
      return;
    }

    try {
      await this.speech.start({ lang: "pt-BR" });
      this.micStatus = "safe";
      this.captureMode = "webspeech";
      if (!this.activeMicLabel || this.activeMicLabel.startsWith("Web Speech")) {
        this.activeMicLabel = this.activeMicLabel || "Web Speech · Safe Mode";
      }
      this.setPhase("listening");
    } catch (err) {
      this.speech.cancel();
      if (err instanceof SpeechCaptureError && err.kind === "blocked") {
        this.micStatus = "blocked";
        this.permissionState = "denied";
      }
      this.errorMessage =
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a captura de voz.";
      console.error("[aether:stage] webspeech.start.failed", err);
      this.setPhase("idle");
    }
  }

  private async finishRecord(): Promise<void> {
    if (this.captureMode === "webspeech" || this.speech.isListening()) {
      await this.finishSpeechSafeMode();
      return;
    }
    this.setPhase("validating");
    try {
      console.log("[aether:stage] capture.stop");
      const captured = await this.capture.stop();
      console.log("[aether:stage] capture.blob", {
        size: captured.blob.size,
        type: captured.mimeType || captured.blob.type || "(empty)",
        durationMs: captured.durationMs,
        trackLabel: captured.trackLabel,
      });
      if (!captured.blob || captured.blob.size < 64) {
        console.error("[aether:stage] capture.blob_empty", {
          size: captured.blob?.size ?? 0,
        });
        this.errorMessage =
          "Captura vazia — nenhum áudio gravado. Segure o botão mais tempo ou use Safe Mode.";
        this.setPhase("idle");
        return;
      }
      // Multipart/form-data via FormData → relative /api/process-audio → Gemini pipeline
      const mimeType = captured.mimeType || captured.blob.type || "audio/webm";
      const result = await voiceApi.processAudio(captured.blob, {
        filename: `headset-${Date.now()}.${extensionForMime(mimeType)}`,
        mimeType,
        locale: "pt-BR",
        clientId: HUD_CLIENT_ID,
      });
      this.lastResult = result;
      const replyText = (
        result.gemini_response ??
        result.response_text ??
        ""
      ).trim();
      if (!replyText) {
        console.error("[aether:stage] process_audio.empty_reply", {
          status: result.status,
          hasAudioUrl: !!result.audio_url,
        });
        this.errorMessage =
          "Pipeline respondeu sem texto. Tente de novo — a captura chegou ao servidor.";
        this.setPhase("idle");
        void this.refreshAudit({ quiet: true });
        return;
      }
      this.pushChatTurn(
        result.transcription ?? result.transcript,
        replyText,
      );
      this.setPhase("responding");
      await this.deliverSpokenReply({
        text: replyText,
        audioUrl: result.audio_url ?? null,
        audioBase64: result.audio_base64,
        mimeType: result.audio_mime_type,
        ttsProvider: result.meta?.tts_provider ?? "",
        usedSafeFallback: !!result.meta?.used_safe_fallback,
      });
      this.setPhase("idle");
      // Refresh Session History + Metrics after each successful M100 / headset turn.
      void this.refreshAudit({ quiet: true });
    } catch (err) {
      // API / network failures must surface — NEVER silent Safe Mode drop.
      console.error("[aether:stage] finishRecord.error", err);
      if (err instanceof Error && err.stack) {
        console.error("[aether:stage] finishRecord.error.stack", err.stack);
      }
      this.capture.cancel();
      this.captureMode = "mediarecorder";
      if (this.micStatus === "safe") {
        this.micStatus = "active";
      }
      if (err instanceof VoiceApiError) {
        const detail = [
          err.message,
          err.detail,
          err.stage ? `stage=${err.stage}` : "",
          err.retryable ? "(pode tentar de novo)" : "",
        ]
          .filter(Boolean)
          .join(" — ");
        this.errorMessage = `API /process-audio: ${detail}`;
        console.error("[aether:stage] finishRecord.api_error", {
          status: err.status,
          message: err.message,
          detail: err.detail,
          stage: err.stage,
          retryable: err.retryable,
        });
      } else {
        const msg = err instanceof Error ? err.message : "Falha ao processar o áudio.";
        this.errorMessage = `Falha no upload/API Gemini: ${msg}`;
      }
      this.setPhase("idle");
    }
  }

  /**
   * Play server TTS when real; always attempt browser speech for words.
   * Mock WAV is only a beep — never treat it as the sole audible reply.
   * If both fail, keep text on HUD and offer «Ouvir resposta» (fresh user gesture).
   */
  private async deliverSpokenReply(options: {
    text: string;
    audioUrl?: string | null;
    audioBase64?: string | null;
    mimeType?: string;
    ttsProvider?: string;
    usedSafeFallback?: boolean;
  }): Promise<void> {
    const spokenText = (options.text || "").trim();
    const hasRealTtsUrl = !!options.audioUrl;
    const ttsProvider = options.ttsProvider ?? "";
    const preferBrowserSpeech =
      !hasRealTtsUrl ||
      ttsProvider === "mock-tts" ||
      !!options.usedSafeFallback;

    console.log("[aether:stage] tts.plan", {
      hasRealTtsUrl,
      ttsProvider,
      preferBrowserSpeech,
      spokenChars: spokenText.length,
    });

    if (!spokenText && !hasRealTtsUrl && !options.audioBase64) {
      this.pendingSpeakText = null;
      this.errorMessage =
        "Sem texto nem áudio TTS para reproduzir. Verifique o backend /process-audio.";
      console.error("[aether:stage] tts.nothing_to_play");
      return;
    }

    let serverOk = false;
    let localOk = false;

    try {
      await ensureAudioContextRunning();
    } catch (err) {
      console.warn("[aether:stage] tts.audiocontext", err);
    }

    if (hasRealTtsUrl || (!preferBrowserSpeech && options.audioBase64)) {
      try {
        await playResponseAudio({
          audioUrl: options.audioUrl ?? null,
          audioBase64: options.audioBase64 ?? null,
          mimeType: options.mimeType ?? "audio/mpeg",
        });
        serverOk = true;
        console.log("[aether:stage] tts.server_playback_ok");
      } catch (playErr) {
        console.error("[aether:stage] tts.playback_failed", playErr);
        if (playErr instanceof Error && playErr.stack) {
          console.error("[aether:stage] tts.playback_failed.stack", playErr.stack);
        }
      }
    }

    // Always try spoken words when mock/fallback or when server audio failed.
    if (preferBrowserSpeech || !serverOk) {
      const spoken = await speakLocally(spokenText, "pt-BR");
      localOk = spoken.ok;
      if (!spoken.ok) {
        console.error("[aether:stage] tts.speak_locally_failed", spoken.reason);
      }
    } else {
      localOk = true;
    }

    if (serverOk || localOk) {
      this.pendingSpeakText = null;
      return;
    }

    // Both paths failed — text stays on HUD; require a fresh tap to speak.
    this.pendingSpeakText = spokenText || null;
    this.errorMessage =
      "Resposta no ecrã, mas o áudio foi bloqueado pelo browser. Toque em «Ouvir resposta».";
    console.error("[aether:stage] tts.both_failed", {
      spokenChars: spokenText.length,
      hasRealTtsUrl,
      ttsProvider,
    });
  }

  private async speakPendingReply(): Promise<void> {
    const text = this.pendingSpeakText;
    if (!text) return;
    try {
      await unlockAudioForGesture();
    } catch {
      // continue — speak may still work inside this click
    }
    const spoken = await speakLocally(text, "pt-BR");
    if (spoken.ok) {
      this.pendingSpeakText = null;
      this.errorMessage = null;
    } else {
      this.errorMessage =
        "Ainda sem áudio neste browser. A resposta permanece no painel «Última resposta».";
    }
    this.render();
  }

  /** Safe Mode: Web Speech transcript → cognitive chat → local TTS. */
  private async finishSpeechSafeMode(): Promise<void> {
    this.setPhase("validating");
    try {
      const heard = await this.speech.stop();
      console.log("[aether:stage] safemode.transcript", {
        chars: heard.transcript.length,
        preview: heard.transcript.slice(0, 120),
      });
      this.speechInterim = "";
      const historyForApi = this.chatHistory.slice();
      console.log("[aether:stage] safemode.cognitive.request", {
        mode: this.geminiMode,
        historyTurns: historyForApi.length,
      });
      const res = await voiceApi.cognitiveChat({
        query: heard.transcript,
        history: historyForApi,
        mode: this.geminiMode,
        locale: "pt-BR",
        client_id: HUD_CLIENT_ID,
      });
      console.log("[aether:stage] safemode.cognitive.response", {
        status: res.status,
        model: res.model,
        chars: (res.gemini_response || "").length,
        fallback: res.used_safe_fallback,
      });
      this.lastChat = res;
      this.lastResult = processAudioFromCognitive(res, heard.transcript);
      this.pushChatTurn(heard.transcript, res.gemini_response);
      this.setPhase("responding");
      await this.deliverSpokenReply({
        text: res.gemini_response || res.response_text,
        audioUrl: res.audio_response_url,
        usedSafeFallback: res.used_safe_fallback || !res.audio_response_url,
        ttsProvider: res.audio_response_url ? "gemini-tts" : "mock-tts",
      });
      this.setPhase("idle");
      void this.refreshAudit({ quiet: true });
    } catch (err) {
      console.error("[aether:stage] safemode.error", err);
      if (err instanceof Error && err.stack) {
        console.error("[aether:stage] safemode.error.stack", err.stack);
      }
      this.speech.cancel();
      if (err instanceof SpeechCaptureError) {
        this.errorMessage = err.message;
        if (err.kind === "blocked") this.micStatus = "blocked";
      } else if (err instanceof VoiceApiError) {
        this.errorMessage = `${err.message}${err.detail ? ` — ${err.detail}` : ""}`;
      } else {
        this.errorMessage = "Falha no Safe Mode (Web Speech).";
      }
      this.setPhase("idle");
    }
  }

  private pushChatTurn(userText: string, modelText: string): void {
    const u = userText.trim();
    const m = modelText.trim();
    if (u) this.chatHistory.push({ role: "user", content: u });
    if (m) this.chatHistory.push({ role: "model", content: m });
    // Keep client history lean for the API
    if (this.chatHistory.length > 24) {
      this.chatHistory = this.chatHistory.slice(-24);
    }
  }

  private async sendCognitiveChat(): Promise<void> {
    const query = this.chatDraft.trim();
    if (!query || this.chatBusy) return;
    this.chatBusy = true;
    this.errorMessage = null;
    this.render();
    try {
      const historyForApi = this.chatHistory.slice();
      const res = await voiceApi.cognitiveChat({
        query,
        history: historyForApi,
        mode: this.geminiMode,
        locale: "pt-BR",
        client_id: HUD_CLIENT_ID,
      });
      this.lastChat = res;
      this.pushChatTurn(query, res.gemini_response);
      this.chatDraft = "";
      void this.refreshAudit({ quiet: true });
    } catch (err) {
      if (err instanceof VoiceApiError) {
        this.errorMessage = `${err.message}${err.detail ? ` — ${err.detail}` : ""}`;
      } else {
        this.errorMessage = "Falha no chat cognitivo Gemini.";
      }
    } finally {
      this.chatBusy = false;
      this.render();
    }
  }

  private bindAuditControls(): void {
    this.root.querySelector<HTMLButtonElement>('[data-action="audit-toggle"]')?.addEventListener(
      "click",
      () => {
        this.auditOpen = !this.auditOpen;
        this.render();
      },
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-audit-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.auditTab;
        if (tab === "history" || tab === "metrics") {
          this.auditTab = tab;
          this.render();
        }
      });
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="audit-refresh"]')?.addEventListener(
      "click",
      () => {
        void this.refreshAudit();
      },
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-gemini-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.geminiMode;
        if (mode === "flash" || mode === "pro") {
          this.geminiMode = mode;
          this.render();
        }
      });
    });
    this.root.querySelector<HTMLTextAreaElement>('[data-field="chat-draft"]')?.addEventListener(
      "input",
      (ev) => {
        this.chatDraft = (ev.target as HTMLTextAreaElement).value;
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="chat-send"]')?.addEventListener(
      "click",
      () => {
        void this.sendCognitiveChat();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="chat-clear"]')?.addEventListener(
      "click",
      () => {
        this.chatHistory = [];
        this.lastChat = null;
        this.chatDraft = "";
        this.render();
      },
    );
  }

  private render(): void {
    const health = this.health;
    const result = this.lastResult;
    const listening = this.phase === "listening";
    const busy = this.phase === "validating" || this.phase === "responding";
    const phaseLabel = PHASE_LABEL[this.phase];
    const radioMissing = isBluetoothRadioMissing(this.audioInspect);

    const historyHtml = renderSessionHistory({
      items: this.historyItems,
      loading: this.auditLoading,
      error: this.auditTab === "history" ? this.auditError : null,
    });
    const metricsHtml = renderMetricsPanel({
      metrics: this.metrics,
      loading: this.auditLoading,
      error: this.auditTab === "metrics" ? this.auditError : null,
    });

    this.root.innerHTML = `
      <main class="shell">
        <header class="brand">
          <h1 class="brand__mark">Aether <span>Vision</span></h1>
          <p class="brand__lede">
            Controle do assistente de voz para headsets Bluetooth genéricos —
            captura, Consenso Alfa e resposta em alta fidelidade.
          </p>
        </header>

        <div class="status-row" aria-live="polite">
          ${apiConnectionBadge(health)}
          ${cognitiveBadge(health)}
          ${geminiKeyBadge(health)}
          <span>áudio ${health?.use_mock_audio === false ? "real" : "mock"}</span>
          <span>STT ${health?.stt_provider ?? "—"}</span>
          <span>TTS ${health?.tts_provider ?? "—"}</span>
          <span>Consenso ${health?.consenso_enabled ? "ativo" : "off"}</span>
          <span>v${health?.version ?? "—"}</span>
        </div>

        ${connectionBanner(health)}
        ${geminiKeyWarning(health)}

        <div
          class="flow-status flow-status--${this.phase}"
          role="status"
          aria-live="assertive"
          data-phase="${this.phase}"
        >
          <span class="flow-status__pulse" aria-hidden="true"></span>
          <strong>${escapeHtml(phaseLabel)}</strong>
          ${micStatusBadge(this.micStatus, this.activeMicLabel)}
          ${
            this.activeMicLabel
              ? `<span class="flow-status__mic" title="Dispositivo de entrada">mic: ${escapeHtml(this.activeMicLabel)}</span>`
              : `<span class="flow-status__mic">mic: à espera de permissão…</span>`
          }
          ${
            this.captureMode === "webspeech"
              ? `<span class="flow-status__mic">via Web Speech</span>`
              : ""
          }
          ${
            listening && this.speechInterim
              ? `<span class="flow-status__mic">“…${escapeHtml(this.speechInterim)}”</span>`
              : ""
          }
          ${toolHudBanner(result, this.phase)}
        </div>

        ${micPermissionBanner(this.micStatus, this.permissionState, isSpeechRecognitionAvailable())}

        <section class="panel" aria-labelledby="capture-title">
          <h2 id="capture-title">Headset Bluetooth</h2>
          <p class="hint">
            Pareie o fone (ex.: <strong>Headset M100</strong>) no SO e defina-o como
            entrada/saída padrão. O HUD pede permissão de mic de forma limpa;
            se o browser negar (<code>NotAllowedError</code>), entra em
            <strong>Safe Mode</strong> na hora — sem freeze nem reload.
          </p>
          <div class="controls">
            <button
              type="button"
              class="btn-primary ${listening ? "is-recording" : ""}"
              data-action="record"
              ${busy ? "disabled" : ""}
            >
              ${
                listening
                  ? this.captureMode === "webspeech"
                    ? "Parar Safe Mode"
                    : "Parar e enviar"
                  : this.phase === "validating"
                    ? "Validando no Consenso Alfa..."
                    : this.phase === "responding"
                      ? "A responder..."
                      : this.micStatus === "safe"
                        ? "Falar (Safe Mode)"
                        : this.micStatus === "blocked"
                          ? "Tentar gravar (Gemini)"
                          : "Gravar com o headset"
              }
            </button>
            <button
              type="button"
              class="btn-ghost"
              data-action="reconnect"
              ${busy || this.reconnectBusy ? "disabled" : ""}
            >
              ${this.reconnectBusy ? "A reconectar..." : "Reconectar / Retry"}
            </button>
            <button
              type="button"
              class="btn-ghost"
              data-action="safe-mode"
              ${busy || !isSpeechRecognitionAvailable() ? "disabled" : ""}
            >
              Ativar Safe Mode
            </button>
            <button type="button" class="btn-ghost" data-action="devices" ${busy ? "disabled" : ""}>
              Listar microfones
            </button>
            <button type="button" class="btn-ghost" data-action="health" ${busy ? "disabled" : ""}>
              Checar API
            </button>
          </div>
          ${this.errorMessage ? `<p class="error">${escapeHtml(this.errorMessage)}</p>` : ""}
          ${
            this.pendingSpeakText
              ? `<button type="button" class="btn-primary" data-action="speak-pending">
                  Ouvir resposta
                </button>`
              : ""
          }
        </section>

        <section class="panel" aria-labelledby="audio-diag-title">
          ${
            radioMissing
              ? `<div class="radio-alert" role="alert">
                  <strong>Rádio Bluetooth ausente (NO_BT_RADIO)</strong>
                  <p>Nenhum endpoint Bluetooth está visível. No diagnóstico isto é <kbd>NO_BT_RADIO</kbd>: o Generic Bluetooth Adapter fica <kbd>CM_PROB_PHANTOM</kbd>.</p>
                  <ol>
                    <li><kbd>Win + X</kbd> → Gerenciador de Dispositivos</li>
                    <li>Exibir → Mostrar dispositivos ocultos</li>
                    <li>Bluetooth → Generic Bluetooth Adapter → Desinstalar dispositivo. Não exclua o driver.</li>
                    <li>Ação → Verificar se há alterações de hardware</li>
                    <li>Desligue o PC, retire a energia da placa e segure o botão de ligar 20 segundos</li>
                  </ol>
                </div>`
              : ""
          }
          ${renderAudioDiagnosticsPanel({
            devices: this.audioInspect,
            contextState: this.audioContextState,
            busy: this.diagBusy,
            disabled: busy,
            note: this.diagNote,
            logs: recentCaptureFailures(),
            activeDeviceId: this.preferredDeviceId,
          })}
        </section>

        <section class="panel" aria-labelledby="result-title">
          <h2 id="result-title">Última resposta</h2>
          ${
            result
              ? `<div class="result-grid">
                  <div class="block">
                    <div class="block__label">Transcrição (STT)</div>
                    <p class="block__body">${escapeHtml(
                      result.transcription ?? result.transcript,
                    )}</p>
                    <div class="block__label" style="margin-top:1rem">
                      Resposta ${
                        (result.meta.cognitive_provider ?? "gemini") === "gemini"
                          ? "Gemini"
                          : "agente"
                      }
                      ${
                        result.status
                          ? ` · <span class="status-pill status-pill--${escapeHtml(result.status)}">${escapeHtml(result.status)}</span>`
                          : ""
                      }
                    </div>
                    <div class="gemini-reply md-frame">
                      ${renderMarkdown(result.gemini_response ?? result.response_text)}
                    </div>
                    ${
                      result.meta.used_safe_fallback || !result.consenso.approved
                        ? `<p class="hint" style="margin-top:0.75rem">
                            Fallback seguro ativo${
                              result.meta.fallback_reason
                                ? ` (${escapeHtml(result.meta.fallback_reason)})`
                                : ""
                            }.
                          </p>`
                        : ""
                    }
                    ${
                      result.audio_response_url || result.audio_url
                        ? `<p class="hint" style="margin-top:0.5rem">
                            Áudio:
                            <a class="audio-link" href="${escapeHtml(
                              result.audio_response_url ?? result.audio_url ?? "",
                            )}" target="_blank" rel="noreferrer">audio_response_url</a>
                          </p>`
                        : ""
                    }
                  </div>
                  <div class="block">
                    <div class="block__label">Consenso Alfa</div>
                    <div class="confidence">
                      <div class="confidence__head">
                        <span>${result.consenso.approved ? "aprovado" : "rejeitado"}</span>
                        <strong>${formatPercent(
                          result.consensus_confidence ?? result.consenso.agreement_ratio,
                        )}</strong>
                      </div>
                      <div class="confidence__track" aria-hidden="true">
                        <span
                          class="confidence__fill"
                          style="width:${Math.max(
                            0,
                            Math.min(
                              100,
                              Math.round(
                                (result.consensus_confidence ??
                                  result.consenso.agreement_ratio) * 100,
                              ),
                            ),
                          )}%"
                        ></span>
                      </div>
                      <small class="hint">${result.consenso.duration_ms} ms · motor ${escapeHtml(
                        result.meta.cognitive_provider ?? "—",
                      )}</small>
                    </div>
                    <p class="block__body" style="margin-top:0.75rem">
                      acordo ${(result.consenso.agreement_ratio * 100).toFixed(0)}% ·
                      ${result.consenso.duration_ms} ms
                    </p>
                    <div class="votes">
                      ${(result.consenso.agent_latencies?.length
                        ? result.consenso.agent_latencies
                        : result.consenso.votes.map((v) => ({
                            agent_id: v.agent_id,
                            agent_role: v.agent_role,
                            duration_ms: v.duration_ms,
                            label: v.agent_role,
                          }))
                      )
                        .map((a) => {
                          const vote = result.consenso.votes.find(
                            (v) => v.agent_id === a.agent_id,
                          );
                          return `<div class="vote">
                            <span><strong>${escapeHtml(a.label || a.agent_role)}</strong><br/>
                            <small>${escapeHtml(vote?.rationale ?? "")}</small></span>
                            <span>${vote?.approved ? "ok" : "no"} · ${a.duration_ms} ms</span>
                          </div>`;
                        })
                        .join("")}
                    </div>
                    <div class="latency" style="margin-top:1rem">
                      <div class="block__label">Latência total ${result.latency.total_ms} ms</div>
                      <div class="latency__bar"><span></span></div>
                      <small style="color:var(--muted)">
                        STT ${result.latency.stt_ms} · agente ${result.latency.agent_ms} ·
                        consenso ${result.latency.consenso_ms} · TTS ${result.latency.tts_ms}
                      </small>
                      <small style="color:var(--muted); display:block; margin-top:0.35rem">
                        Grounding ${result.latency.consenso_grounding_ms ?? 0} ms ·
                        Safety/Tone ${result.latency.consenso_safety_tone_ms ?? 0} ms ·
                        Consistency ${result.latency.consenso_consistency_ms ?? 0} ms
                      </small>
                    </div>
                    ${toolsPanelHtml(result)}
                  </div>
                </div>`
              : `<p class="hint">Nenhuma captura ainda. Grave um teste com o headset.</p>`
          }
        </section>

        <section class="panel cognitive-panel" aria-labelledby="cognitive-title">
          <h2 id="cognitive-title">Chat cognitivo Gemini</h2>
          <p class="hint">
            <code>POST /api/cognitive/chat</code> com
            <code>mode</code> + histórico estruturado → Consenso Alfa → payload unificado.
          </p>
          <div class="mode-selector" role="group" aria-label="Modelo Gemini">
            <button
              type="button"
              class="mode-chip ${this.geminiMode === "flash" ? "is-active" : ""}"
              data-gemini-mode="flash"
              ${this.chatBusy ? "disabled" : ""}
            >
              Flash · gemini-3.8-flash
            </button>
            <button
              type="button"
              class="mode-chip ${this.geminiMode === "pro" ? "is-active" : ""}"
              data-gemini-mode="pro"
              ${this.chatBusy ? "disabled" : ""}
            >
              Pro · gemini-3.8-flash
            </button>
          </div>
          <label class="chat-label" for="chat-draft">Pergunta</label>
          <textarea
            id="chat-draft"
            class="chat-draft"
            data-field="chat-draft"
            rows="3"
            placeholder="Ex.: resume a arquitetura STT → Gemini → Consenso → TTS"
            ${this.chatBusy ? "disabled" : ""}
          >${escapeHtml(this.chatDraft)}</textarea>
          <div class="controls">
            <button
              type="button"
              class="btn-primary"
              data-action="chat-send"
              ${this.chatBusy ? "disabled" : ""}
            >
              ${this.chatBusy ? "A pensar..." : "Enviar chat"}
            </button>
            <button
              type="button"
              class="btn-ghost"
              data-action="chat-clear"
              ${this.chatBusy ? "disabled" : ""}
            >
              Limpar histórico
            </button>
          </div>
          ${renderCognitiveChatResult(this.lastChat, this.chatHistory)}
        </section>

        <section class="panel audit-panel" aria-labelledby="audit-title">
          <div class="audit-panel__head">
            <h2 id="audit-title">Sessão &amp; métricas</h2>
            <div class="controls">
              <button
                type="button"
                class="btn-ghost"
                data-action="audit-toggle"
                aria-expanded="${this.auditOpen ? "true" : "false"}"
              >
                ${this.auditOpen ? "Recolher" : "Expandir"}
              </button>
              <button
                type="button"
                class="btn-ghost"
                data-action="audit-refresh"
                ${busy || this.auditLoading ? "disabled" : ""}
              >
                Atualizar
              </button>
            </div>
          </div>
          <p class="hint">
            Histórico SQLite (<code>GET /api/history</code>) e médias
            (<code>GET /api/metrics</code>. Atualiza automaticamente após cada
            <code>/process-audio</code> bem-sucedido.
          </p>
          ${
            this.auditOpen
              ? `<div class="audit-tabs" role="tablist" aria-label="Painéis de auditoria">
                  <button
                    type="button"
                    role="tab"
                    class="audit-tab ${this.auditTab === "history" ? "is-active" : ""}"
                    data-audit-tab="history"
                    aria-selected="${this.auditTab === "history"}"
                  >Histórico</button>
                  <button
                    type="button"
                    role="tab"
                    class="audit-tab ${this.auditTab === "metrics" ? "is-active" : ""}"
                    data-audit-tab="metrics"
                    aria-selected="${this.auditTab === "metrics"}"
                  >Métricas</button>
                </div>
                <div class="audit-panel__body" role="tabpanel">
                  ${this.auditTab === "history" ? historyHtml : metricsHtml}
                </div>`
              : `<p class="hint">Painel recolhido — clique em Expandir para ver histórico e métricas.</p>`
          }
        </section>
      </main>
    `;

    this.root.querySelector<HTMLButtonElement>('[data-action="record"]')?.addEventListener(
      "click",
      () => {
        void this.toggleRecord();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="speak-pending"]')?.addEventListener(
      "click",
      () => {
        void this.speakPendingReply();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="reconnect"]')?.addEventListener(
      "click",
      () => {
        void this.reconnectMic();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="safe-mode"]')?.addEventListener(
      "click",
      () => {
        void this.enterSafeModeInstant(
          "Safe Mode ativado manualmente — Web Speech sem MediaRecorder.",
        );
      },
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-mic-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.micAction;
        if (action === "retry") void this.reconnectMic();
        if (action === "safe") {
          void this.enterSafeModeInstant(
            "Safe Mode a partir do aviso de permissão.",
          );
        }
      });
    });
    this.root.querySelector<HTMLButtonElement>('[data-action="devices"]')?.addEventListener(
      "click",
      () => {
        void this.refreshDevices();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="audio-reset"]')?.addEventListener(
      "click",
      () => {
        void this.forceAudioReset();
      },
    );
    this.root.querySelector<HTMLButtonElement>('[data-action="health"]')?.addEventListener(
      "click",
      () => {
        void this.refreshHealth();
      },
    );
    this.bindAuditControls();
  }
}

function classifySoft(err: unknown): CaptureError {
  if (err instanceof CaptureError) return err;
  return new CaptureError(
    "unknown",
    err instanceof Error ? err.message : "Falha de microfone.",
    true,
  );
}

function processAudioFromCognitive(
  res: CognitiveChatResponse,
  transcript: string,
): ProcessAudioResponse {
  const raw = res.consenso as Partial<ConsensoResult> | undefined;
  const consenso: ConsensoResult = {
    approved: raw?.approved ?? true,
    agreement_ratio: raw?.agreement_ratio ?? res.consensus_confidence ?? 0,
    final_text: raw?.final_text ?? res.gemini_response,
    votes: raw?.votes ?? [],
    hallucination_flags: raw?.hallucination_flags ?? [],
    duration_ms: raw?.duration_ms ?? 0,
    skipped: raw?.skipped ?? false,
    agent_latencies: raw?.agent_latencies ?? [],
  };
  return {
    transcript,
    transcription: transcript,
    response_text: res.response_text,
    gemini_response: res.gemini_response,
    consenso,
    consensus_confidence: res.consensus_confidence,
    audio_base64: "",
    audio_mime_type: "audio/mpeg",
    audio_url: res.audio_response_url,
    audio_response_url: res.audio_response_url,
    status: res.status,
    latency: {
      stt_ms: 0,
      agent_ms: res.duration_ms,
      consenso_ms: consenso.duration_ms,
      tts_ms: 0,
      total_ms: res.duration_ms,
      consenso_grounding_ms: 0,
      consenso_safety_tone_ms: 0,
      consenso_consistency_ms: 0,
      consenso_agents_ms: {},
    },
    meta: {
      request_id: res.request_id,
      pipeline_mode: "safe-mode-webspeech",
      use_mock_audio: false,
      stt_provider: "web-speech",
      tts_provider: "speechSynthesis",
      consenso_enabled: true,
      used_safe_fallback: res.used_safe_fallback,
      fallback_reason: res.fallback_reason ?? "client_safe_mode_webspeech",
      created_at: new Date().toISOString(),
      depin_attestation: null,
      cognitive_provider: res.cognitive_provider,
    },
  };
}

function micStatusBadge(status: MicStatus, label: string | null): string {
  const tip = label
    ? `Estado: ${MIC_STATUS_LABEL[status]} · ${label}`
    : `Estado do microfone: ${MIC_STATUS_LABEL[status]}`;
  return `<span class="mic-badge mic-badge--${status}" title="${escapeHtml(tip)}">
    <i class="dot dot--${status === "active" ? "ok" : status === "blocked" ? "err" : "warn"}"></i>
    Mic ${escapeHtml(MIC_STATUS_LABEL[status])}
  </span>`;
}

function micPermissionBanner(
  status: MicStatus,
  permission: MicPermissionState,
  speechOk: boolean,
): string {
  if (status === "active") return "";
  if (status === "safe") {
    return `<p class="mic-banner mic-banner--safe" role="status">
      <strong>Safe Mode</strong> — Web Speech ativo (sem MediaRecorder).
      O rótulo do mic acima com o dispositivo real quando o browser permitir.
      ${
        speechOk
          ? `<button type="button" class="mic-banner__btn" data-mic-action="retry">Tentar mic de novo</button>`
          : ""
      }
    </p>`;
  }
  // blocked
  return `<p class="mic-banner mic-banner--blocked" role="alert">
      <strong>Mic Blocked</strong>
      ${
        permission === "denied"
          ? "O browser negou o microfone (<code>NotAllowedError</code>)."
          : "À espera de permissão ou dispositivo."
      }
      ${
        speechOk
          ? `Pode continuar já em Safe Mode.
             <button type="button" class="mic-banner__btn" data-mic-action="safe">Usar Safe Mode</button>
             <button type="button" class="mic-banner__btn" data-mic-action="retry">Reconectar</button>`
          : `<button type="button" class="mic-banner__btn" data-mic-action="retry">Reconectar</button>`
      }
    </p>`;
}

function extensionForMime(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

function apiConnectionBadge(health: HealthResponse | null): string {
  if (health) {
    const port = health.api_port ?? 8001;
    return `<span class="conn-badge conn-badge--online" title="GET /api/health ok (proxy Vite → backend :${port})">
      <i class="dot dot--ok"></i>
      Backend ligado · :${port}
    </span>`;
  }
  return `<span class="conn-badge conn-badge--offline" title="Backend não responde via /api (Vite → :8001)">
    <i class="dot dot--err"></i>
    Backend desligado
  </span>`;
}

function connectionBanner(health: HealthResponse | null): string {
  if (health) {
    return `<p class="conn-banner conn-banner--ok" role="status">
      Ligado via <code>/api</code> → backend <code>:${health.api_port ?? 8001}</code>
      · cognitive <strong>${escapeHtml(health.cognitive_provider ?? "gemini")}</strong>
      · Gemini key ${health.has_valid_gemini_key ? "ok" : "em falta"}
    </p>`;
  }
  return `<p class="conn-banner conn-banner--err" role="status">
      Sem ligação ao FastAPI. No PC: <code>.\\start_dev.ps1</code> ou
      <code>.\\start_mobile_test.ps1</code> (telemóvel / túnel HTTPS).
      A API escuta em <code>:8001</code>; o HUD usa o proxy <code>/api</code>.
    </p>`;
}

function cognitiveBadge(health: HealthResponse | null): string {
  const engine = health?.cognitive_provider ?? "gemini";
  const cls = engine === "gemini" ? "conn-badge--online" : "conn-badge--offline";
  return `<span class="conn-badge ${cls}" title="Motor cognitivo efetivo (Gemini-only)">
    cognitive: ${escapeHtml(engine)}
  </span>`;
}

function geminiKeyBadge(health: HealthResponse | null): string {
  if (!health) {
    return `<span class="conn-badge conn-badge--offline">GEMINI: —</span>`;
  }
  if (health.has_valid_gemini_key) {
    return `<span class="conn-badge conn-badge--online" title="GEMINI_API_KEY válida">
      <i class="dot dot--ok"></i>
      GEMINI: ok
    </span>`;
  }
  return `<span class="conn-badge conn-badge--offline" title="Defina GEMINI_API_KEY em backend/.env">
    <i class="dot dot--err"></i>
    GEMINI: em falta
  </span>`;
}

function geminiKeyWarning(health: HealthResponse | null): string {
  if (!health) {
    return `<p class="warn-banner" role="status">
      Backend desconectado. Execute <code>start_app.bat</code> ou
      <code>start_app.ps1</code> na raiz do repositório.
    </p>`;
  }
  if (health.has_valid_gemini_key === true || health.use_mock_audio === true) {
    return "";
  }
  const envPath = health.env_file?.trim() || "backend/.env";
  return `<p class="warn-banner warn-banner--key" role="status">
      <strong>GEMINI_API_KEY não carregada / inválida.</strong>
      Cole a chave neste ficheiro e reinicie o Uvicorn:<br/>
      <code>${escapeHtml(envPath)}</code><br/>
      Exemplo: <code>GEMINI_API_KEY=…</code> (sem aspas).<br/>
      Confirme com <code>GET /health</code> → <code>has_valid_gemini_key: true</code>.
      Sem chave em modo real, o pipeline usa fallback seguro.
    </p>`;
}

function toolHudBanner(result: ProcessAudioResponse | null, phase: UiPhase): string {
  const tools = result?.tools ?? [];
  if (!tools.length) {
    return "";
  }
  const executed = tools.filter((t) => t.executed).length;
  const blocked = tools.filter((t) => !t.approved).length;
  const names = tools.map((t) => t.name).join(", ");
  const live =
    phase === "validating" || phase === "responding"
      ? `<span class="flow-status__tool">Tool: ${escapeHtml(names)}</span>`
      : `<span class="flow-status__tool">Tools ${executed} ok${
          blocked ? ` · ${blocked} bloqueada(s)` : ""
        }</span>`;
  return live;
}

function toolsPanelHtml(result: ProcessAudioResponse): string {
  const tools = result.tools ?? [];
  if (!tools.length && !result.meta.tools_invoked) {
    return "";
  }
  if (!tools.length) {
    return `<div class="block" style="margin-top:1rem">
      <div class="block__label">Ferramentas</div>
      <p class="hint">Nenhuma tool nesta volta.</p>
    </div>`;
  }
  const rows = tools
    .map((t) => {
      const state = !t.approved
        ? `bloqueada${t.blocked_reason ? ` (${escapeHtml(t.blocked_reason)})` : ""}`
        : t.executed
          ? "executada"
          : "aprovada";
      return `<div class="vote">
        <span><strong>${escapeHtml(t.name)}</strong><br/>
        <small>${escapeHtml(t.result_preview ?? t.blocked_reason ?? "")}</small></span>
        <span>${state} · ${t.duration_ms} ms</span>
      </div>`;
    })
    .join("");
  return `<div class="block" style="margin-top:1rem">
    <div class="block__label">Ferramentas (Consenso-gated)</div>
    <p class="block__body">
      ${result.meta.tools_executed_count ?? tools.filter((t) => t.executed).length}
      executada(s) · ${tools.length} invocação(ões)
    </p>
    <div class="votes">${rows}</div>
  </div>`;
}

function renderCognitiveChatResult(
  last: CognitiveChatResponse | null,
  history: ChatHistoryItem[],
): string {
  const historyBlock =
    history.length === 0
      ? `<p class="hint">Histórico vazio — as voltas de chat e voz entram aqui.</p>`
      : `<div class="chat-history" aria-label="Histórico da conversa">
          ${history
            .map((m) => {
              const who = m.role === "user" ? "Você" : "Aether";
              const body =
                m.role === "user"
                  ? `<p class="block__body">${escapeHtml(m.content)}</p>`
                  : `<div class="gemini-reply md-frame">${renderMarkdown(m.content)}</div>`;
              return `<article class="chat-turn chat-turn--${escapeHtml(m.role)}">
                <div class="block__label">${who}</div>
                ${body}
              </article>`;
            })
            .join("")}
        </div>`;

  if (!last) {
    return `<div class="cognitive-result">${historyBlock}</div>`;
  }

  const ratio = last.consensus_confidence ?? last.consenso?.agreement_ratio ?? 0;
  const approved = last.consenso?.approved ?? false;
  const duration = last.duration_ms ?? last.consenso?.duration_ms ?? 0;

  return `<div class="cognitive-result">
    ${historyBlock}
    <div class="result-grid" style="margin-top:1rem">
      <div class="block">
        <div class="block__label">
          Última resposta Gemini
          <span class="status-pill status-pill--${escapeHtml(last.status)}">${escapeHtml(last.status)}</span>
          · ${escapeHtml(String(last.mode))} · ${escapeHtml(last.model)}
        </div>
        <div class="gemini-reply md-frame">
          ${renderMarkdown(last.gemini_response || last.response_text)}
        </div>
        ${
          last.used_safe_fallback
            ? `<p class="hint" style="margin-top:0.75rem">
                Fallback seguro${
                  last.fallback_reason
                    ? ` (${escapeHtml(last.fallback_reason)})`
                    : ""
                }.
              </p>`
            : ""
        }
      </div>
      <div class="block">
        <div class="block__label">Consenso Alfa · telemetria</div>
        <div class="confidence">
          <div class="confidence__head">
            <span>${approved ? "aprovado" : "rejeitado"}</span>
            <strong>${formatPercent(ratio)}</strong>
          </div>
          <div class="confidence__track" aria-hidden="true">
            <span
              class="confidence__fill"
              style="width:${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%"
            ></span>
          </div>
          <small class="hint">${formatMs(duration)} · motor ${escapeHtml(
            last.cognitive_provider,
          )}</small>
        </div>
        <p class="block__body" style="margin-top:0.75rem">
          acordo ${(ratio * 100).toFixed(0)}% ·
          ${last.consenso?.duration_ms ?? 0} ms consenso ·
          request ${escapeHtml(last.request_id.slice(0, 8))}…
        </p>
      </div>
    </div>
  </div>`;
}
