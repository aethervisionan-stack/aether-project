/**
 * Gemini Live client — mic PCM uplink + gapless 24 kHz playback + barge-in.
 *
 * Connects to FastAPI ``/ws/live`` via Vite ``/api`` proxy (ws: true).
 * Standalone service (HUD toggle optional / not required for Step 2).
 */

import { sanitizeApiBaseUrl } from "../api/client";
import {
  buildHeadsetAudioConstraints,
  classifyMediaError,
  resolveHandsFreeDeviceId,
} from "./capture";

type AudioContextConstructor = typeof AudioContext;

function audioContextCtor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const extra = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? extra.webkitAudioContext ?? null;
}

async function resumeContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // autoplay / gesture gates — caller may retry on user gesture
    }
  }
}

export type LiveServiceState =
  | "idle"
  | "connecting"
  | "ready"
  | "streaming"
  | "error"
  | "closed";

export interface GeminiLiveReadyInfo {
  model: string;
  inputRate: number;
  outputRate: number;
  responseModality: string;
}

export interface GeminiLiveServiceOptions {
  /** Override WS URL. Empty → same-origin `/api/ws/live`. */
  wsUrl?: string;
  preferredDeviceId?: string | null;
  /** RMS threshold (0–1) for barge-in while model audio is playing. */
  bargeInRmsThreshold?: number;
  onState?: (state: LiveServiceState) => void;
  onReady?: (info: GeminiLiveReadyInfo) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onError?: (message: string, code?: string) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
}

const INPUT_RATE = 16_000;
const OUTPUT_RATE = 24_000;
const SCRIPT_BUFFER_SIZE = 4096;
const DEFAULT_BARGE_RMS = 0.035;

/** Resolve Live WebSocket URL (mirrors VoiceApiClient `/api` proxy rules). */
export function resolveLiveWsUrl(override?: string): string {
  const trimmed = (override ?? "").trim();
  if (trimmed) return trimmed;

  const base = sanitizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (base) {
    const wsBase = base.replace(/^http/i, "ws");
    return `${wsBase.replace(/\/$/, "")}/ws/live`;
  }

  const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof location !== "undefined" ? location.host : "127.0.0.1:5173";
  return `${proto}//${host}/api/ws/live`;
}

function floatTo16BitPcm(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out.buffer;
}

function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === INPUT_RATE) return input;
  if (inputRate <= 0) return input;
  const ratio = inputRate / INPUT_RATE;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const start = Math.floor(i * ratio);
    out[i] = input[start] ?? 0;
  }
  return out;
}

function rmsEnergy(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

export class GeminiLiveService {
  private state: LiveServiceState = "idle";
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private muteGain: GainNode | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private playing = false;
  private bargeInArmed = false;
  private readonly bargeThreshold: number;
  private readonly options: GeminiLiveServiceOptions;

  constructor(options: GeminiLiveServiceOptions = {}) {
    this.options = options;
    this.bargeThreshold = options.bargeInRmsThreshold ?? DEFAULT_BARGE_RMS;
  }

  getState(): LiveServiceState {
    return this.state;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  async start(): Promise<void> {
    if (this.state === "connecting" || this.state === "ready" || this.state === "streaming") {
      return;
    }
    this.setState("connecting");
    try {
      await this.openMicrophone();
      await this.openWebSocket();
    } catch (err) {
      this.teardown();
      const message = err instanceof Error ? err.message : String(err);
      this.setState("error");
      this.options.onError?.(message);
      throw err;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "audio_stream_end" }));
        this.ws.send(JSON.stringify({ type: "close" }));
      }
    } catch {
      // ignore
    }
    this.teardown();
    this.setState("closed");
  }

  /** Clear local playback and notify backend/Gemini (barge-in). */
  interruptPlayback(): void {
    this.clearPlaybackQueue();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "interrupt" }));
      } catch {
        // ignore
      }
    }
    this.options.onInterrupted?.();
  }

  private setState(next: LiveServiceState): void {
    this.state = next;
    this.options.onState?.(next);
  }

  private async openMicrophone(): Promise<void> {
    const deviceId = await resolveHandsFreeDeviceId(this.options.preferredDeviceId ?? null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: buildHeadsetAudioConstraints(deviceId),
        video: false,
      });
    } catch (err) {
      throw classifyMediaError(err);
    }
    this.mediaStream = stream;

    const Ctx = audioContextCtor();
    if (!Ctx) {
      throw new Error("AudioContext indisponível neste browser");
    }
    // Prefer 16 kHz capture context; browser may ignore and use hardware rate.
    this.captureCtx = new Ctx({ sampleRate: INPUT_RATE });
    await resumeContext(this.captureCtx);

    this.sourceNode = this.captureCtx.createMediaStreamSource(stream);
    this.processor = this.captureCtx.createScriptProcessor(SCRIPT_BUFFER_SIZE, 1, 1);
    this.muteGain = this.captureCtx.createGain();
    this.muteGain.gain.value = 0;

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const rate = this.captureCtx?.sampleRate ?? INPUT_RATE;
      const mono = downsampleTo16k(input, rate);
      const energy = rmsEnergy(mono);

      if (this.playing && energy >= this.bargeThreshold) {
        if (!this.bargeInArmed) {
          this.bargeInArmed = true;
          this.interruptPlayback();
        }
      } else if (!this.playing) {
        this.bargeInArmed = false;
      }

      const pcm = floatTo16BitPcm(mono);
      try {
        this.ws.send(pcm);
        if (this.state === "ready") this.setState("streaming");
      } catch (err) {
        console.warn("[aether:live] uplink send failed", err);
      }
    };

    this.sourceNode.connect(this.processor);
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.captureCtx.destination);
  }

  private async openWebSocket(): Promise<void> {
    const url = resolveLiveWsUrl(this.options.wsUrl);
    console.log("[aether:live] connecting", url);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      const onFail = (reason: string) => {
        cleanup();
        reject(new Error(reason));
      };

      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        ws.removeEventListener("message", onFirstMessage);
      };

      const onOpen = () => {
        // wait for server "ready"
      };

      const onError = () => onFail("WebSocket connection failed");

      const onFirstMessage = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          if (payload.type === "error") {
            onFail(String(payload.message || payload.code || "Live error"));
            return;
          }
          if (payload.type === "ready") {
            cleanup();
            ws.addEventListener("message", (ev) => void this.onWsMessage(ev));
            ws.addEventListener("close", () => {
              this.teardown();
              if (this.state !== "closed") this.setState("closed");
            });
            const info: GeminiLiveReadyInfo = {
              model: String(payload.model ?? "gemini-2.5-flash"),
              inputRate: Number(payload.input_rate ?? INPUT_RATE),
              outputRate: Number(payload.output_rate ?? OUTPUT_RATE),
              responseModality: String(payload.response_modality ?? "AUDIO"),
            };
            this.setState("ready");
            this.options.onReady?.(info);
            resolve();
          }
        } catch (err) {
          onFail(err instanceof Error ? err.message : "Invalid ready frame");
        }
      };

      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      ws.addEventListener("message", onFirstMessage);
    });
  }

  private async onWsMessage(event: MessageEvent): Promise<void> {
    if (typeof event.data !== "string") {
      const buf =
        event.data instanceof ArrayBuffer
          ? event.data
          : event.data instanceof Blob
            ? await event.data.arrayBuffer()
            : null;
      if (buf) this.enqueuePlayback(buf);
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(event.data) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = String(payload.type || "");
    if (type === "interrupted") {
      this.clearPlaybackQueue();
      this.options.onInterrupted?.();
      return;
    }
    if (type === "turn_complete") {
      this.options.onTurnComplete?.();
      return;
    }
    if (type === "error") {
      const message = String(payload.message || "Live error");
      if (payload.code != null && String(payload.code)) {
        this.options.onError?.(message, String(payload.code));
      } else {
        this.options.onError?.(message);
      }
      return;
    }
    if (type === "input_transcript" && typeof payload.text === "string") {
      this.options.onInputTranscript?.(payload.text);
      return;
    }
    if (type === "output_transcript" && typeof payload.text === "string") {
      this.options.onOutputTranscript?.(payload.text);
    }
  }

  private async ensurePlaybackCtx(): Promise<AudioContext> {
    if (this.playbackCtx && this.playbackCtx.state !== "closed") {
      await resumeContext(this.playbackCtx);
      return this.playbackCtx;
    }
    const Ctx = audioContextCtor();
    if (!Ctx) {
      throw new Error("AudioContext indisponível neste browser");
    }
    this.playbackCtx = new Ctx({ sampleRate: OUTPUT_RATE });
    await resumeContext(this.playbackCtx);
    this.nextPlayTime = this.playbackCtx.currentTime;
    return this.playbackCtx;
  }

  private async enqueuePlayback(pcm: ArrayBuffer): Promise<void> {
    if (pcm.byteLength < 2) return;
    const ctx = await this.ensurePlaybackCtx();
    const samples = new Int16Array(pcm);
    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      floats[i] = (samples[i] ?? 0) / 0x8000;
    }
    const rate = ctx.sampleRate || OUTPUT_RATE;
    const buffer = ctx.createBuffer(1, floats.length, rate);
    buffer.copyToChannel(floats, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(this.nextPlayTime, ctx.currentTime);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
    this.playing = true;
    this.activeSources.push(source);
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
      if (this.activeSources.length === 0) {
        this.playing = false;
        this.bargeInArmed = false;
      }
    };
  }

  private clearPlaybackQueue(): void {
    for (const source of this.activeSources) {
      try {
        source.stop(0);
      } catch {
        // already stopped
      }
    }
    this.activeSources = [];
    this.playing = false;
    if (this.playbackCtx && this.playbackCtx.state !== "closed") {
      this.nextPlayTime = this.playbackCtx.currentTime;
    } else {
      this.nextPlayTime = 0;
    }
  }

  private teardown(): void {
    this.clearPlaybackQueue();
    try {
      this.processor?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.sourceNode?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.muteGain?.disconnect();
    } catch {
      // ignore
    }
    this.processor = null;
    this.sourceNode = null;
    this.muteGain = null;

    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;

    void this.captureCtx?.close().catch(() => undefined);
    void this.playbackCtx?.close().catch(() => undefined);
    this.captureCtx = null;
    this.playbackCtx = null;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
  }
}
