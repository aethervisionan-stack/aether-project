/**
 * Gen-1 advanced HUD audio visualizer — Web Audio AnalyserNode + Canvas (~60fps).
 * Mic + AI playback spectrum/wave with neon glow, peak particles, and mode states.
 *
 * Mic: MediaStream → Analyser (silent tap; does not affect capture/WS path).
 * AI: PCM copies → BufferSource → Analyser → mute (analysis only; GaplessPcmPlayer still plays).
 */

export type VisualizerMode = "idle" | "listening" | "processing" | "speaking";

const CYAN = "#00F3FF";
const PURPLE = "#7000FF";
const GREEN = "#00FF66";
const FFT_SIZE = 256;
const PARTICLE_CAP = 48;
const PLAYBACK_RATE = 24_000;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: string;
  size: number;
}

export class AdvancedAudioVisualizer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private running = false;
  private mode: VisualizerMode = "idle";
  private pulse = 0;

  private micCtx: AudioContext | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micSilent: GainNode | null = null;

  private playCtx: AudioContext | null = null;
  private playAnalyser: AnalyserNode | null = null;
  private playSilent: GainNode | null = null;
  private playNextAt = 0;

  private micFreq = new Uint8Array(FFT_SIZE / 2);
  private playFreq = new Uint8Array(FFT_SIZE / 2);
  private micTime = new Uint8Array(FFT_SIZE);
  private playTime = new Uint8Array(FFT_SIZE);
  private particles: Particle[] = [];
  private readonly resizeObserver: ResizeObserver;
  private boundStream: MediaStream | null = null;

  constructor() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    const tick = (t: number) => {
      if (!this.running) {
        return;
      }
      this.pulse = t;
      this.draw();
      this.raf = window.requestAnimationFrame(tick);
    };
    this.raf = window.requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.particles = [];
    this.drawIdleFrame();
  }

  /** Full teardown — cancel rAF, disconnect analysers, close contexts. */
  dispose(): void {
    this.stop();
    this.teardownMicGraph();
    this.teardownPlayGraph();
    if (this.canvas) {
      this.resizeObserver.unobserve(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.boundStream = null;
  }

  setMode(mode: VisualizerMode): void {
    this.mode = mode;
  }

  getMode(): VisualizerMode {
    return this.mode;
  }

  /**
   * Tap live mic MediaStream into a dedicated Analyser (no speaker output).
   * Safe to call again when the stream changes.
   */
  async connectMicStream(stream: MediaStream | null): Promise<void> {
    this.teardownMicGraph();
    this.boundStream = stream;
    if (!stream) {
      if (this.mode === "listening") {
        this.mode = "idle";
      }
      return;
    }

    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.micCtx = new Ctx();
    this.micAnalyser = this.micCtx.createAnalyser();
    this.micAnalyser.fftSize = FFT_SIZE;
    this.micAnalyser.smoothingTimeConstant = 0.72;
    this.micAnalyser.minDecibels = -90;
    this.micAnalyser.maxDecibels = -18;
    this.micSilent = this.micCtx.createGain();
    this.micSilent.gain.value = 0;
    this.micSource = this.micCtx.createMediaStreamSource(stream);
    this.micSource.connect(this.micAnalyser);
    this.micAnalyser.connect(this.micSilent);
    this.micSilent.connect(this.micCtx.destination);
    this.micFreq = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micTime = new Uint8Array(this.micAnalyser.fftSize);

    if (this.micCtx.state === "suspended") {
      await this.micCtx.resume();
    }
    if (this.mode === "idle") {
      this.mode = "listening";
    }
  }

  /** Compatibility: PCM feed still accepted; preferred path is connectMicStream. */
  pushMicPcm(_pcm: ArrayBuffer): void {
    // Analyser reads the live mic graph; PCM push kept for API compat / no-op.
    if (this.mode === "idle" || this.mode === "processing") {
      // stay in processing if awaiting AI; else mark listening when energy arrives via analyser
    }
  }

  /** Feed AI playback PCM into a silent Analyser graph (does not double-play). */
  pushPlayPcm(pcm: ArrayBuffer): void {
    if (!pcm.byteLength) {
      return;
    }
    void this.ensurePlayGraph().then(() => this.enqueuePlayAnalysis(pcm));
    this.mode = "speaking";
  }

  private async ensurePlayGraph(): Promise<void> {
    if (this.playCtx && this.playAnalyser) {
      if (this.playCtx.state === "suspended") {
        await this.playCtx.resume();
      }
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.playCtx = new Ctx({ sampleRate: PLAYBACK_RATE });
    this.playAnalyser = this.playCtx.createAnalyser();
    this.playAnalyser.fftSize = FFT_SIZE;
    this.playAnalyser.smoothingTimeConstant = 0.65;
    this.playAnalyser.minDecibels = -90;
    this.playAnalyser.maxDecibels = -15;
    this.playSilent = this.playCtx.createGain();
    this.playSilent.gain.value = 0;
    this.playAnalyser.connect(this.playSilent);
    this.playSilent.connect(this.playCtx.destination);
    this.playFreq = new Uint8Array(this.playAnalyser.frequencyBinCount);
    this.playTime = new Uint8Array(this.playAnalyser.fftSize);
    this.playNextAt = this.playCtx.currentTime + 0.02;
    if (this.playCtx.state === "suspended") {
      await this.playCtx.resume();
    }
  }

  private enqueuePlayAnalysis(pcm: ArrayBuffer): void {
    const ctx = this.playCtx;
    const analyser = this.playAnalyser;
    if (!ctx || !analyser) {
      return;
    }

    const samples = pcm.byteLength >> 1;
    if (samples < 8) {
      return;
    }
    const view = new DataView(pcm);
    const buffer = ctx.createBuffer(1, samples, PLAYBACK_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples; i += 1) {
      channel[i] = view.getInt16(i * 2, true) / 0x8000;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    const startAt = Math.max(this.playNextAt, ctx.currentTime + 0.004);
    try {
      source.start(startAt);
    } catch {
      return;
    }
    this.playNextAt = startAt + buffer.duration;
  }

  private teardownMicGraph(): void {
    try {
      this.micSource?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.micAnalyser?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.micSilent?.disconnect();
    } catch {
      /* ignore */
    }
    this.micSource = null;
    this.micAnalyser = null;
    this.micSilent = null;
    const ctx = this.micCtx;
    this.micCtx = null;
    if (ctx) {
      void ctx.close().catch(() => undefined);
    }
  }

  private teardownPlayGraph(): void {
    try {
      this.playAnalyser?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.playSilent?.disconnect();
    } catch {
      /* ignore */
    }
    this.playAnalyser = null;
    this.playSilent = null;
    this.playNextAt = 0;
    const ctx = this.playCtx;
    this.playCtx = null;
    if (ctx) {
      void ctx.close().catch(() => undefined);
    }
  }

  private resize(): void {
    if (!this.canvas) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || 640;
    const cssH = this.canvas.clientHeight || 110;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private sampleAnalysers(): { micLevel: number; playLevel: number } {
    let micLevel = 0;
    let playLevel = 0;
    if (this.micAnalyser) {
      this.micAnalyser.getByteFrequencyData(this.micFreq);
      this.micAnalyser.getByteTimeDomainData(this.micTime);
      micLevel = average(this.micFreq) / 255;
    } else {
      this.micFreq.fill(0);
      this.micTime.fill(128);
    }
    if (this.playAnalyser) {
      this.playAnalyser.getByteFrequencyData(this.playFreq);
      this.playAnalyser.getByteTimeDomainData(this.playTime);
      playLevel = average(this.playFreq) / 255;
    } else {
      this.playFreq.fill(0);
      this.playTime.fill(128);
    }

    // Auto mode hints from levels when not explicitly processing.
    if (this.mode !== "processing") {
      if (playLevel > 0.08) {
        this.mode = "speaking";
      } else if (micLevel > 0.05 && this.boundStream) {
        this.mode = "listening";
      } else if (this.mode === "speaking" && playLevel < 0.03) {
        this.mode = this.boundStream ? "listening" : "idle";
      }
    }

    if (micLevel > 0.22 || playLevel > 0.2) {
      this.spawnParticles(micLevel, playLevel);
    }
    return { micLevel, playLevel };
  }

  private spawnParticles(micLevel: number, playLevel: number): void {
    if (!this.canvas || this.particles.length >= PARTICLE_CAP) {
      return;
    }
    const w = this.canvas.clientWidth || 640;
    const h = this.canvas.clientHeight || 110;
    const bursts = Math.min(4, Math.floor((micLevel + playLevel) * 8));
    for (let i = 0; i < bursts; i += 1) {
      const fromMic = Math.random() < micLevel / Math.max(0.001, micLevel + playLevel);
      this.particles.push({
        x: Math.random() * w,
        y: h * (fromMic ? 0.35 : 0.62) + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 1.8,
        vy: -0.6 - Math.random() * 1.4,
        life: 0.55 + Math.random() * 0.45,
        hue: fromMic ? (Math.random() > 0.5 ? CYAN : PURPLE) : GREEN,
        size: 1 + Math.random() * 2.2,
      });
    }
  }

  private draw(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) {
      return;
    }
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 110;
    const { micLevel, playLevel } = this.sampleAnalysers();

    ctx.clearRect(0, 0, w, h);
    this.drawBackdrop(ctx, w, h);
    this.drawSpectrum(ctx, this.micFreq, w, h * 0.48, CYAN, PURPLE, 0.9);
    this.drawWave(ctx, this.micTime, w, h * 0.28, CYAN, 1.15);
    this.drawSpectrum(ctx, this.playFreq, w, h * 0.48, GREEN, PURPLE, 0.55, true);
    this.drawWave(ctx, this.playTime, w, h * 0.72, GREEN, 0.95);

    if (this.mode === "processing") {
      this.drawProcessingPulse(ctx, w, h);
    }

    this.drawParticles(ctx);
    this.drawLegend(ctx, micLevel, playLevel);
  }

  private drawIdleFrame(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) {
      return;
    }
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 110;
    ctx.clearRect(0, 0, w, h);
    this.drawBackdrop(ctx, w, h);
    ctx.fillStyle = "rgba(138, 145, 153, 0.7)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.fillText("AUDIO IDLE", 8, 14);
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "rgba(112, 0, 255, 0.08)");
    grad.addColorStop(0.5, "rgba(0, 243, 255, 0.04)");
    grad.addColorStop(1, "rgba(0, 255, 102, 0.06)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(0, 243, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i += 1) {
      const y = (h / 4) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawSpectrum(
    ctx: CanvasRenderingContext2D,
    data: Uint8Array,
    w: number,
    bandH: number,
    primary: string,
    accent: string,
    alpha: number,
    mirror = false,
  ): void {
    const bins = data.length;
    const barW = w / bins;
    const yBase = mirror ? bandH + 8 : bandH;
    for (let i = 0; i < bins; i += 1) {
      const v = data[i] / 255;
      if (v < 0.02) {
        continue;
      }
      const bh = v * bandH * (mirror ? 0.85 : 1);
      const x = i * barW;
      ctx.save();
      ctx.globalAlpha = alpha * (0.35 + v * 0.65);
      ctx.shadowBlur = 8 + v * 14;
      ctx.shadowColor = i % 3 === 0 ? accent : primary;
      ctx.fillStyle = i % 4 === 0 ? accent : primary;
      if (mirror) {
        ctx.fillRect(x + 0.5, yBase, Math.max(1, barW - 1.2), bh);
      } else {
        ctx.fillRect(x + 0.5, yBase - bh, Math.max(1, barW - 1.2), bh);
      }
      ctx.restore();
    }
  }

  private drawWave(
    ctx: CanvasRenderingContext2D,
    time: Uint8Array,
    w: number,
    midY: number,
    color: string,
    thickness: number,
  ): void {
    ctx.save();
    ctx.beginPath();
    const n = time.length;
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * w;
      const y = midY + ((time[i] - 128) / 128) * (midY * 0.55);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.restore();
  }

  private drawProcessingPulse(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const t = this.pulse / 1000;
    const r = 10 + Math.sin(t * 4.2) * 6 + 4;
    const cx = w / 2;
    const cy = h / 2;
    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = PURPLE;
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowColor = CYAN;
    ctx.strokeStyle = CYAN;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    const next: Particle[] = [];
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.018;
      if (p.life <= 0) {
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.hue;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.hue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      next.push(p);
    }
    this.particles = next;
  }

  private drawLegend(
    ctx: CanvasRenderingContext2D,
    micLevel: number,
    playLevel: number,
  ): void {
    ctx.save();
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.fillStyle = CYAN;
    ctx.shadowBlur = 6;
    ctx.shadowColor = CYAN;
    ctx.fillText("MIC", 8, 12);
    ctx.fillStyle = GREEN;
    ctx.shadowColor = GREEN;
    ctx.fillText("AI", 36, 12);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(200, 210, 220, 0.75)";
    const label =
      this.mode === "listening"
        ? "LISTENING"
        : this.mode === "processing"
          ? "PROCESSING"
          : this.mode === "speaking"
            ? "SPEAKING"
            : "IDLE";
    ctx.fillText(
      `${label}  ·  mic ${(micLevel * 100).toFixed(0)}%  ai ${(playLevel * 100).toFixed(0)}%`,
      62,
      12,
    );
    ctx.restore();
  }
}

function average(data: Uint8Array): number {
  if (!data.length) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    sum += data[i];
  }
  return sum / data.length;
}

/** Back-compat alias used by older imports. */
export { AdvancedAudioVisualizer as AudioVisualizer };
