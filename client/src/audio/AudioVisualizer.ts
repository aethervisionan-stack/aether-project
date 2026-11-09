/**
 * Gen-1 cyber HUD audio visualizer — mic (cyan) + AI playback (mint).
 * Lightweight canvas waveform + sparse magnitude bars; feed PCM from the Live pipeline.
 */

const MIC_COLOR = "rgba(0, 240, 255, 0.95)";
const MIC_DIM = "rgba(0, 240, 255, 0.22)";
const PLAY_COLOR = "rgba(93, 255, 176, 0.95)";
const PLAY_DIM = "rgba(93, 255, 176, 0.2)";
const GRID = "rgba(0, 240, 255, 0.08)";
const BARS = 32;
const WAVE_POINTS = 96;

export class AudioVisualizer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private running = false;
  private micWave = new Float32Array(WAVE_POINTS);
  private playWave = new Float32Array(WAVE_POINTS);
  private micBars = new Float32Array(BARS);
  private playBars = new Float32Array(BARS);
  private micWrite = 0;
  private playWrite = 0;
  private readonly resizeObserver: ResizeObserver;

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
    const tick = () => {
      if (!this.running) {
        return;
      }
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
    this.micWave.fill(0);
    this.playWave.fill(0);
    this.micBars.fill(0);
    this.playBars.fill(0);
    this.draw();
  }

  dispose(): void {
    this.stop();
    if (this.canvas) {
      this.resizeObserver.unobserve(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

  /** PCM 16-bit LE mono (mic @ 16 kHz). */
  pushMicPcm(pcm: ArrayBuffer): void {
    this.ingest(pcm, this.micWave, this.micBars, "mic");
  }

  /** PCM 16-bit LE mono (playback @ 24 kHz). */
  pushPlayPcm(pcm: ArrayBuffer): void {
    this.ingest(pcm, this.playWave, this.playBars, "play");
  }

  private ingest(
    pcm: ArrayBuffer,
    wave: Float32Array,
    bars: Float32Array,
    channel: "mic" | "play",
  ): void {
    const samples = pcm.byteLength >> 1;
    if (samples < 8) {
      return;
    }
    const view = new DataView(pcm);
    // Wave: push RMS of successive windows into ring buffer.
    const windows = Math.min(8, Math.max(1, Math.floor(samples / 64)));
    const winSize = Math.floor(samples / windows);
    for (let w = 0; w < windows; w += 1) {
      let sum = 0;
      const start = w * winSize;
      for (let i = 0; i < winSize; i += 1) {
        const s = view.getInt16((start + i) * 2, true) / 0x8000;
        sum += s * s;
      }
      const rms = Math.sqrt(sum / Math.max(1, winSize));
      if (channel === "mic") {
        wave[this.micWrite % WAVE_POINTS] = rms;
        this.micWrite += 1;
      } else {
        wave[this.playWrite % WAVE_POINTS] = rms;
        this.playWrite += 1;
      }
    }

    // Sparse magnitude bars — fold abs samples into BARS bins (no heavy FFT).
    bars.fill(0);
    for (let i = 0; i < samples; i += 1) {
      const s = Math.abs(view.getInt16(i * 2, true) / 0x8000);
      const bin = Math.min(BARS - 1, Math.floor((i / samples) * BARS));
      bars[bin] += s;
    }
    const per = samples / BARS;
    for (let b = 0; b < BARS; b += 1) {
      bars[b] = Math.min(1, (bars[b] / per) * 2.4);
    }
  }

  private resize(): void {
    if (!this.canvas) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || 640;
    const cssH = this.canvas.clientHeight || 96;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private draw(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) {
      return;
    }
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 96;
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i += 1) {
      const y = (h / 4) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    const mid = h * 0.42;
    const barTop = h * 0.58;
    const barH = h * 0.38;

    this.drawWave(ctx, this.micWave, this.micWrite, w, mid, MIC_COLOR, MIC_DIM);
    this.drawWave(ctx, this.playWave, this.playWrite, w, mid, PLAY_COLOR, PLAY_DIM);
    this.drawBars(ctx, this.micBars, w, barTop, barH, MIC_COLOR, 0);
    this.drawBars(ctx, this.playBars, w, barTop, barH, PLAY_COLOR, 1);

    ctx.fillStyle = "rgba(138, 145, 153, 0.85)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.fillText("MIC", 6, 12);
    ctx.fillStyle = "rgba(93, 255, 176, 0.75)";
    ctx.fillText("AI", 34, 12);
  }

  private drawWave(
    ctx: CanvasRenderingContext2D,
    wave: Float32Array,
    write: number,
    w: number,
    mid: number,
    stroke: string,
    fill: string,
  ): void {
    const amp = mid * 0.85;
    ctx.beginPath();
    for (let i = 0; i < WAVE_POINTS; i += 1) {
      const idx = (write + i) % WAVE_POINTS;
      const x = (i / (WAVE_POINTS - 1)) * w;
      const y = mid - wave[idx] * amp;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Mirror ghost under midline for tactical look
    ctx.beginPath();
    for (let i = 0; i < WAVE_POINTS; i += 1) {
      const idx = (write + i) % WAVE_POINTS;
      const x = (i / (WAVE_POINTS - 1)) * w;
      const y = mid + wave[idx] * amp * 0.45;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawBars(
    ctx: CanvasRenderingContext2D,
    bars: Float32Array,
    w: number,
    top: number,
    height: number,
    color: string,
    lane: 0 | 1,
  ): void {
    const gap = 2;
    const laneH = (height - gap) / 2;
    const y0 = top + lane * (laneH + gap);
    const bw = w / BARS;
    ctx.fillStyle = color;
    for (let i = 0; i < BARS; i += 1) {
      const bh = Math.max(1, bars[i] * laneH);
      const x = i * bw + 1;
      ctx.globalAlpha = 0.35 + bars[i] * 0.65;
      ctx.fillRect(x, y0 + laneH - bh, Math.max(1, bw - 2), bh);
    }
    ctx.globalAlpha = 1;
  }
}
