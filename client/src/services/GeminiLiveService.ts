/**
 * Manages the browser WebSocket to the FastAPI Live bridge.
 *
 * Default URL: `ws(s)://<page-host>/api/ws/live`
 * Vite proxies `/api` → `http://127.0.0.1:8000` (path rewritten, `ws: true`).
 *
 * Keeps the Live session stable with:
 *  - client→server ping / pong RTT + timeout
 *  - response to server→client heartbeat pings
 *  - transparent auto-reconnect (HUD: RECONNECTING) after unexpected drops
 *  - mic-fallback hybrid: text chat stays available if capture fails
 */

import type { AdvancedAudioVisualizer, VisualizerMode } from "../audio/AdvancedAudioVisualizer";
import { FifoRetentionBuffer } from "../audio/FifoRetentionBuffer";
import { GaplessPcmPlayer } from "../audio/GaplessPcmPlayer";
import { formatMicError, PcmCapture } from "../audio/PcmCapture";
import { TelemetryMonitor } from "../audio/TelemetryMonitor";
import { buildHudTelemetry } from "../multimodal/HudTelemetry";
import type { CapturedFrame } from "../multimodal/FrameCapture";
import type {
  GeoFixPayload,
  MobilityConfig,
  PlacePointPayload,
  RawNotificationInput,
} from "../types/mobility";
import { DEFAULT_MOBILITY_CONFIG } from "../types/mobility";
import type { LiveServerJsonEvent, WsReadyStateLabel } from "../types/live";
import type { ToolArgumentsByName, ToolName } from "../types/tools";
import { BargeInController } from "../voice/BargeInController";
import { PushToTalk } from "../voice/PushToTalk";
import { VadController } from "../voice/VadController";

export type LiveEventHandler = (event: LiveServerJsonEvent) => void;

export interface GeminiLiveServiceOptions {
  /** Absolute ws URL or path. Default: same-origin `/api/ws/live`. */
  url?: string;
  telemetry?: TelemetryMonitor;
  onEvent?: LiveEventHandler;
  /** Optional advanced HUD visualizer (Analyser taps + silent AI spectrum). */
  visualizer?: AdvancedAudioVisualizer | null;
}

/** RMS threshold (0–1) to treat a mic flush as the start of a voice cycle. */
const VOICE_OUTBOUND_RMS = 0.02;
const VOICE_IDLE_MS = 450;

export interface LiveConnectResult {
  /** True when mic capture started and PCM flush loop is active. */
  micEnabled: boolean;
  micLabel: string | null;
  /** Present when Live stayed connected in text-only / hybrid-without-mic mode. */
  micWarning: string | null;
}

const CLIENT_PING_INTERVAL_MS = 10_000;
const CLIENT_PONG_TIMEOUT_MS = 30_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 8_000;

function resolveDefaultWsUrl(): string {
  const fromEnv = import.meta.env.VITE_LIVE_WS_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ws/live`;
}

function readyStateLabel(ws: WebSocket | null): WsReadyStateLabel {
  if (!ws) {
    return "NONE";
  }
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return "NONE";
  }
}

export class GeminiLiveService {
  readonly telemetry: TelemetryMonitor;
  private readonly url: string;
  private readonly onEvent?: LiveEventHandler;
  private readonly fifo = new FifoRetentionBuffer(1500, 16_000 * 2);
  private readonly capture = new PcmCapture();
  private readonly player: GaplessPcmPlayer;
  private ws: WebSocket | null = null;
  private flushTimer: number | null = null;
  private micLabel: string | null = null;
  private micEnabled = false;
  private micWarning: string | null = null;
  private wantConnected = false;
  private intentionalClose = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private opening: Promise<void> | null = null;
  private visualizer: AdvancedAudioVisualizer | null = null;
  private lastMicEnergyAt = 0;
  private voiceCycleArmed = true;
  private vizMode: VisualizerMode = "idle";
  private telemetryFlushTimer: number | null = null;
  /** Latest streamed token text for HUD consumers (does not block audio). */
  private lastTokenStream = "";
  private mobilityConfig: MobilityConfig = { ...DEFAULT_MOBILITY_CONFIG };
  /** When PTT is enabled, PCM only flushes while gate is open. */
  private pttGateOpen = true;
  private readonly vad: VadController;
  private readonly ptt: PushToTalk;
  private readonly bargeIn: BargeInController;

  constructor(options: GeminiLiveServiceOptions = {}) {
    this.url = options.url ?? resolveDefaultWsUrl();
    this.telemetry = options.telemetry ?? new TelemetryMonitor({ logToConsole: true });
    this.onEvent = options.onEvent;
    this.visualizer = options.visualizer ?? null;
    this.player = new GaplessPcmPlayer({
      onDepth: (depth) => this.telemetry.setPlaybackQueueDepth(depth),
    });
    this.bargeIn = new BargeInController({
      interruptPlayback: () => this.abortPlaybackQueue(),
      clearTokenStream: () => {
        this.lastTokenStream = "";
      },
      notifyServer: () => this.sendJson({ type: "barge_in", client_t: performance.now() }),
      onBargeIn: () => {
        this.telemetry.clearAiCycle();
        this.voiceCycleArmed = true;
        this.setVizMode(this.micEnabled ? "listening" : "idle");
      },
    });
    this.vad = new VadController({
      onSpeechStart: () => {
        this.bargeIn.tryBargeIn();
      },
    });
    this.ptt = new PushToTalk({
      mode: "hold_to_talk",
      onActiveChange: (active) => {
        this.pttGateOpen = !this.mobilityConfig.pttEnabled || active;
        this.sendJson({
          type: "ptt",
          active,
          client_t: performance.now(),
        });
        if (active) {
          this.bargeIn.tryBargeIn();
          this.setVizMode("listening");
        }
      },
    });
  }

  getMobilityConfig(): MobilityConfig {
    return { ...this.mobilityConfig };
  }

  /** Sync HUD mobility / hardware toggles to the Live bridge + local mic gates. */
  applyMobilityConfig(partial: Partial<MobilityConfig>): void {
    this.mobilityConfig = { ...this.mobilityConfig, ...partial };
    const cfg = this.mobilityConfig;
    this.vad.setEnabled(cfg.openMic && !cfg.pttEnabled);
    this.ptt.setEnabled(cfg.pttEnabled);
    this.pttGateOpen = !cfg.pttEnabled;
    this.sendJson({
      type: "mobility_config",
      copilot_mode: cfg.copilotMode,
      audio_profile: cfg.audioProfile,
      interruption_filter: cfg.interruptionFilter,
      open_mic: cfg.openMic,
      ptt_enabled: cfg.pttEnabled,
      client_t: performance.now(),
    });
  }

  pttPress(): void {
    this.ptt.press();
  }

  pttRelease(): void {
    this.ptt.release();
  }

  isPttActive(): boolean {
    return this.ptt.isActive();
  }

  sendGeoFix(fix: GeoFixPayload): void {
    this.sendJson({ type: "geo", ...fix, client_t: performance.now() });
  }

  sendPlace(place: PlacePointPayload): void {
    this.sendJson({ type: "place", ...place, client_t: performance.now() });
  }

  sendRawNotification(input: RawNotificationInput): void {
    this.sendJson({
      type: "notification",
      source: input.source ?? "hud",
      title: input.title ?? "",
      body: input.body ?? "",
      raw: input.raw,
      sender: input.sender,
      client_t: performance.now(),
    });
  }

  confirmNotificationReply(actionId: string, reply?: string | null): void {
    this.sendJson({
      type: "notification_reply",
      id: actionId,
      confirm: true,
      reply: reply ?? null,
      client_t: performance.now(),
    });
  }

  dismissNotification(actionId: string): void {
    this.sendJson({
      type: "notification_reply",
      id: actionId,
      confirm: false,
      client_t: performance.now(),
    });
  }

  sendProductivityCommand(text: string): void {
    this.sendJson({
      type: "productivity",
      text,
      client_t: performance.now(),
    });
  }

  requestNavGuidance(destinationId?: string): void {
    this.sendJson({
      type: "nav_request",
      destination_id: destinationId ?? null,
      client_t: performance.now(),
    });
  }

  /** Instant barge-in: abort PCM playback + clear synth queue (TTFT path untouched). */
  abortPlaybackQueue(): void {
    this.player.clearOutputQueue();
    this.lastTokenStream = "";
  }

  /** Attach / detach the Gen-1 audio HUD visualizer without reconnecting. */
  setVisualizer(visualizer: AdvancedAudioVisualizer | null): void {
    this.visualizer = visualizer;
    if (visualizer && this.micEnabled) {
      void visualizer.connectMicStream(this.capture.getMediaStream());
    }
  }

  getMicLabel(): string | null {
    return this.micLabel;
  }

  isMicEnabled(): boolean {
    return this.micEnabled;
  }

  getMicWarning(): string | null {
    return this.micWarning;
  }

  getWsUrl(): string {
    return this.url;
  }

  async connect(): Promise<LiveConnectResult> {
    this.wantConnected = true;
    this.intentionalClose = false;
    this.clearReconnectTimer();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.connectResult();
    }

    // Playback can still work for Gemini audio replies even if mic capture fails.
    try {
      await this.player.ensureStarted();
    } catch (err) {
      console.warn("[aether] audio playback init failed; continuing for text", err);
    }

    await this.openSocket(/*isReconnect=*/ false);
    await this.ensureMicCapture();
    this.reconnectAttempt = 0;
    return this.connectResult();
  }

  async disconnect(): Promise<void> {
    this.wantConnected = false;
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.telemetry.stopPingLoop();
    this.stopFlushLoop();
    this.capture.stop();
    this.player.stop();
    this.fifo.clear();
    this.micEnabled = false;
    this.micLabel = null;
    this.micWarning = null;
    this.reconnectAttempt = 0;
    this.telemetry.setFifo(this.fifo.stats());
    this.telemetry.setPlaybackQueueDepth(0);
    this.telemetry.clearAiCycle();
    this.voiceCycleArmed = true;
    this.stopTelemetryFlushLoop();
    this.lastTokenStream = "";
    this.ptt.setEnabled(false);
    this.vad.reset();
    this.bargeIn.markAssistantIdle();
    void this.visualizer?.connectMicStream(null);
    this.setVizMode("idle");
    this.detachAndCloseSocket();
    this.telemetry.setWsState("CLOSED");
  }

  sendText(text: string, options?: { forcePlan?: boolean }): void {
    const t = performance.now();
    this.lastTokenStream = "";
    this.telemetry.markOutbound(t);
    this.setVizMode("processing");
    this.sendJson({
      type: "text",
      text,
      client_t: t,
      force_plan: Boolean(options?.forcePlan),
    });
  }

  /** Invoke a registry tool over the Live WebSocket (async result event). */
  callTool<N extends ToolName>(name: N, arguments_: ToolArgumentsByName[N]): void {
    this.sendJson({
      type: "tool_call",
      name,
      arguments: arguments_,
      client_t: performance.now(),
    });
  }

  /** Complete two-step confirm for irreversible OS actions (voice or tap). */
  confirmTool(opts: {
    pendingId?: string | null;
    confirm?: boolean;
    utterance?: string;
  }): void {
    this.sendJson({
      type: "tool_confirm",
      pending_id: opts.pendingId ?? null,
      confirm: opts.confirm ?? null,
      utterance: opts.utterance ?? null,
      client_t: performance.now(),
    });
  }

  /** Poll accessibility notification listener (mock bridge on web/desktop). */
  pollNotificationListener(sinceId?: string | null): void {
    this.sendJson({
      type: "listener_poll",
      since_id: sinceId ?? null,
      client_t: performance.now(),
    });
  }

  /** Push a screen/image frame beside PCM (multimodal sidecar). */
  sendFrame(frame: CapturedFrame): void {
    this.sendJson({
      type: "frame",
      mime: frame.mime,
      data: frame.dataBase64,
      width: frame.width,
      height: frame.height,
      client_t: frame.clientT,
    });
  }

  /** Push HUD telemetry sample (ping/AI/viz) without touching PCM flush. */
  sendHudTelemetry(): void {
    const snap = this.telemetry.snapshot();
    const payload = buildHudTelemetry({ snap, vizMode: this.vizMode });
    this.sendJson({ ...payload });
  }

  getLastTokenStream(): string {
    return this.lastTokenStream;
  }

  getVizMode(): VisualizerMode {
    return this.vizMode;
  }

  private connectResult(): LiveConnectResult {
    return {
      micEnabled: this.micEnabled,
      micLabel: this.micLabel,
      micWarning: this.micWarning,
    };
  }

  private async openSocket(isReconnect: boolean): Promise<void> {
    if (this.opening) {
      return this.opening;
    }

    this.opening = new Promise<void>((resolve, reject) => {
      if (isReconnect) {
        this.telemetry.setWsState("RECONNECTING");
      } else {
        this.telemetry.setWsState("CONNECTING");
      }

      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      let settled = false;

      const settleOk = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      const settleErr = (err: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(err);
      };

      ws.onopen = () => {
        this.telemetry.setWsState("OPEN");
        this.telemetry.startPingLoop((t) => this.sendJson({ type: "ping", t }), {
          intervalMs: CLIENT_PING_INTERVAL_MS,
          timeoutMs: CLIENT_PONG_TIMEOUT_MS,
          onTimeout: () => this.forceReconnect("ping timeout"),
        });
        if (this.micEnabled) {
          this.startFlushLoop();
        }
        this.startTelemetryFlushLoop();
        settleOk();
      };

      ws.onerror = () => {
        this.telemetry.setWsState(readyStateLabel(ws));
        if (!settled) {
          settleErr(new Error(`WebSocket error connecting to ${this.url}`));
        }
      };

      ws.onclose = () => {
        this.telemetry.stopPingLoop();
        this.stopFlushLoop();
        this.stopTelemetryFlushLoop();
        this.telemetry.setWsState("CLOSED");
        if (!settled) {
          settleErr(new Error(`WebSocket closed before open (${this.url})`));
          return;
        }
        if (this.wantConnected && !this.intentionalClose) {
          this.scheduleReconnect();
        }
      };

      ws.onmessage = (event) => {
        void this.handleMessage(event);
      };
    }).finally(() => {
      this.opening = null;
    });

    return this.opening;
  }

  private async ensureMicCapture(): Promise<void> {
    if (this.micEnabled && this.capture.isRunning) {
      this.startFlushLoop();
      return;
    }

    this.micEnabled = false;
    this.micLabel = null;
    this.micWarning = null;

    try {
      const { label } = await this.capture.start((pcm) => {
        // Full-duplex VAD (open mic, no wake word) — barge-in before enqueue when AI speaks.
        this.vad.pushPcm16(pcm);
        // PTT gate: drop uplink PCM when hold-to-talk is idle (still run VAD locally).
        if (this.mobilityConfig.pttEnabled && !this.pttGateOpen) {
          this.telemetry.setFifo(this.fifo.stats());
          return;
        }
        this.fifo.push(pcm);
        this.telemetry.setFifo(this.fifo.stats());
        this.maybeMarkVoiceOutbound(pcm);
      });
      this.micLabel = label;
      this.micEnabled = true;
      this.startFlushLoop();
      try {
        await this.visualizer?.connectMicStream(this.capture.getMediaStream());
        this.setVizMode("listening");
      } catch (vizErr) {
        console.warn("[aether] visualizer mic tap failed", vizErr);
      }
    } catch (err) {
      // Keep the Live WebSocket open for typed text (and any playback).
      this.micWarning = formatMicError(err);
      console.warn("[aether] mic capture unavailable; text chat still active", err);
      this.capture.stop();
      this.stopFlushLoop();
      void this.visualizer?.connectMicStream(null);
    }
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected || this.intentionalClose || this.reconnectTimer != null) {
      return;
    }

    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.telemetry.setWsState("RECONNECTING");
    console.warn(
      `[aether] ws dropped; reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`,
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnectNow();
    }, delay);
  }

  private async reconnectNow(): Promise<void> {
    if (!this.wantConnected || this.intentionalClose) {
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.detachAndCloseSocket();
    this.telemetry.setWsState("RECONNECTING");

    try {
      await this.openSocket(/*isReconnect=*/ true);
      // Mic stream can survive across WS reconnects; only re-acquire if needed.
      if (this.micEnabled && this.capture.isRunning) {
        this.startFlushLoop();
      } else if (!this.micEnabled && this.micWarning) {
        // Stay text-only; do not re-prompt getUserMedia on every drop.
      } else {
        await this.ensureMicCapture();
      }
      this.reconnectAttempt = 0;
      this.onEvent?.({
        type: "info",
        message: "WebSocket reconnected",
      } as LiveServerJsonEvent);
    } catch (err) {
      console.warn("[aether] reconnect failed", err);
      this.scheduleReconnect();
    }
  }

  private forceReconnect(reason: string): void {
    console.warn(`[aether] forcing reconnect: ${reason}`);
    this.telemetry.stopPingLoop();
    this.stopFlushLoop();
    this.stopTelemetryFlushLoop();
    // Closing triggers onclose → scheduleReconnect when wantConnected.
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    } else if (this.wantConnected && !this.intentionalClose) {
      this.scheduleReconnect();
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private detachAndCloseSocket(): void {
    if (!this.ws) {
      return;
    }
    const ws = this.ws;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    // Keep onclose null during intentional teardown so we do not schedule reconnect.
    ws.onclose = null;
    this.ws = null;
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    } catch {
      // ignore
    }
  }

  private startFlushLoop(): void {
    this.stopFlushLoop();
    // Flush FIFO → socket ~ every 20 ms
    this.flushTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      let frame = this.fifo.shift();
      while (frame) {
        this.ws.send(frame);
        this.telemetry.setFifo(this.fifo.stats());
        frame = this.fifo.shift();
      }
    }, 20);
  }

  private maybeMarkVoiceOutbound(pcm: ArrayBuffer): void {
    const now = performance.now();
    const rms = pcmRms(pcm);
    if (rms < VOICE_OUTBOUND_RMS) {
      if (now - this.lastMicEnergyAt > VOICE_IDLE_MS) {
        this.voiceCycleArmed = true;
      }
      return;
    }
    this.lastMicEnergyAt = now;
    if (!this.voiceCycleArmed) {
      return;
    }
    this.voiceCycleArmed = false;
    this.telemetry.markOutbound(now);
    this.setVizMode("processing");
  }

  private stopFlushLoop(): void {
    if (this.flushTimer != null) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** Periodic HUD telemetry → server multimodal buffer (does not touch PCM). */
  private startTelemetryFlushLoop(): void {
    this.stopTelemetryFlushLoop();
    this.telemetryFlushTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      this.sendHudTelemetry();
    }, 2_000);
  }

  private stopTelemetryFlushLoop(): void {
    if (this.telemetryFlushTimer != null) {
      window.clearInterval(this.telemetryFlushTimer);
      this.telemetryFlushTimer = null;
    }
  }

  private setVizMode(mode: VisualizerMode): void {
    this.vizMode = mode;
    try {
      this.visualizer?.setMode(mode);
    } catch {
      // never block WS / audio
    }
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    this.telemetry.markActivity();

    if (event.data instanceof ArrayBuffer) {
      this.telemetry.markAiFirstChunk();
      this.voiceCycleArmed = true;
      this.bargeIn.markAssistantSpeaking();
      try {
        // Expressive synthesis path: visualizer mode tracks AI speech energy.
        this.setVizMode("speaking");
        this.visualizer?.pushPlayPcm(event.data);
      } catch {
        // ignore viz errors — never block playback/WS
      }
      try {
        await this.player.ensureStarted();
        this.player.enqueuePcm16(event.data);
      } catch (err) {
        console.warn("[aether] playback enqueue failed", err);
      }
      return;
    }

    if (typeof event.data !== "string") {
      return;
    }

    let parsed: LiveServerJsonEvent;
    try {
      parsed = JSON.parse(event.data) as LiveServerJsonEvent;
    } catch {
      return;
    }

    if (parsed.type === "ping") {
      // Answer server heartbeat so proxies see bidirectional traffic.
      this.sendJson({
        type: "pong",
        t: (parsed as { t?: number }).t,
        client_t: performance.now(),
      });
      return;
    }

    if (parsed.type === "pong") {
      const echo = typeof (parsed as { t?: unknown }).t === "number"
        ? ((parsed as { t: number }).t)
        : undefined;
      this.telemetry.markPong(echo);
      return;
    }

    if (parsed.type === "token_delta") {
      const chunk = typeof (parsed as { text?: unknown }).text === "string"
        ? (parsed as { text: string }).text
        : "";
      if (chunk) {
        this.lastTokenStream += chunk;
        this.telemetry.markTtft();
        // First token often arrives before audio — paint TTFT without hurting viz.
        if (this.vizMode === "processing") {
          this.setVizMode("speaking");
        }
      }
    }

    if (parsed.type === "token_done") {
      // Keep last stream for HUD; reset on next outbound.
    }

    if (parsed.type === "aether_transcript") {
      this.telemetry.markAiFirstChunk();
      this.telemetry.markTtft();
      this.voiceCycleArmed = true;
      this.bargeIn.markAssistantSpeaking();
      this.setVizMode("speaking");
    }

    if (parsed.type === "interrupted") {
      this.abortPlaybackQueue();
      this.telemetry.clearAiCycle();
      this.voiceCycleArmed = true;
      this.bargeIn.markAssistantIdle();
      this.setVizMode(this.micEnabled ? "listening" : "idle");
      try {
        await this.player.ensureStarted();
      } catch {
        // ignore
      }
    }

    if (parsed.type === "turn_complete") {
      this.voiceCycleArmed = true;
      this.bargeIn.markAssistantIdle();
      this.setVizMode(this.micEnabled ? "listening" : "idle");
    }

    this.onEvent?.(parsed);
  }
}

function pcmRms(pcm: ArrayBuffer): number {
  const n = pcm.byteLength >> 1;
  if (n <= 0) {
    return 0;
  }
  const view = new DataView(pcm);
  let sum = 0;
  // Stride sample for cheap energy estimate.
  const step = Math.max(1, Math.floor(n / 64));
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const s = view.getInt16(i * 2, true) / 0x8000;
    sum += s * s;
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}
