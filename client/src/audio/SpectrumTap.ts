/**
 * Shared FFT helpers for HUD orbit / visualizer.
 * Always sampled from rAF — never from ScriptProcessor / PCM callbacks.
 *
 * Voice focus: 100Hz–2000Hz (speech fundamentals + formants).
 */

export interface SpectrumBands {
  /** Overall voice-band energy (100–2000Hz), 0–1. */
  level: number;
  /** Lower voice / chest (~100–400Hz). */
  bass: number;
  /** Mid voice / formants (~400–1200Hz). */
  mid: number;
  /** Upper voice / sibilance (~1200–2000Hz). */
  treble: number;
  /** Alias of level — explicit 100–2000Hz RMS-style average. */
  voiceBand: number;
}

export const EMPTY_SPECTRUM: SpectrumBands = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  voiceBand: 0,
};

/** Preferred FFT size for ~47Hz bins @ 24kHz (voice band resolution). */
export const ORBIT_FFT_SIZE = 512;

export const VOICE_BAND_HZ = { low: 100, high: 2000 } as const;

export function createAnalyser(ctx: AudioContext, fftSize = ORBIT_FFT_SIZE): AnalyserNode {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.62;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -18;
  return analyser;
}

export function sampleAnalyser(
  analyser: AnalyserNode | null,
  freqBuf: Uint8Array | null,
  sampleRate?: number,
): SpectrumBands {
  if (!analyser || !freqBuf || freqBuf.length === 0) {
    return EMPTY_SPECTRUM;
  }
  // DOM lib typings tightened Uint8Array generics; cast keeps AnalyserNode happy.
  analyser.getByteFrequencyData(freqBuf as unknown as Uint8Array<ArrayBuffer>);
  const rate = sampleRate && sampleRate > 0 ? sampleRate : 24_000;
  return voiceBandEnergy(freqBuf, rate, analyser.fftSize);
}

/**
 * Average amplitude in 100–2000Hz with sub-bands for orbit drive.
 * Falls back to fractional bins when sampleRate is unknown.
 */
export function voiceBandEnergy(
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
): SpectrumBands {
  const n = data.length;
  if (!n) {
    return EMPTY_SPECTRUM;
  }
  const binHz = sampleRate / Math.max(1, fftSize);
  let i0 = Math.max(1, Math.floor(VOICE_BAND_HZ.low / binHz));
  let i1 = Math.min(n - 1, Math.ceil(VOICE_BAND_HZ.high / binHz));
  if (i1 <= i0) {
    // Fallback fractional split if rate/fft mismatch.
    i0 = Math.max(1, Math.floor(n * 0.04));
    i1 = Math.min(n - 1, Math.floor(n * 0.42));
  }

  const bEnd = Math.min(i1, Math.max(i0 + 1, Math.floor(400 / binHz)));
  const mEnd = Math.min(i1, Math.max(bEnd + 1, Math.floor(1200 / binHz)));

  let bass = 0;
  let mid = 0;
  let treble = 0;
  let sum = 0;
  let count = 0;
  for (let i = i0; i <= i1; i += 1) {
    const v = data[i] / 255;
    sum += v;
    count += 1;
    if (i < bEnd) bass += v;
    else if (i < mEnd) mid += v;
    else treble += v;
  }

  const bassN = Math.max(1, bEnd - i0);
  const midN = Math.max(1, mEnd - bEnd);
  const trebleN = Math.max(1, i1 - mEnd + 1);
  const voice = count > 0 ? Math.min(1, (sum / count) * 1.45) : 0;

  return {
    level: voice,
    voiceBand: voice,
    bass: Math.min(1, (bass / bassN) * 1.3),
    mid: Math.min(1, (mid / midN) * 1.3),
    treble: Math.min(1, (treble / trebleN) * 1.3),
  };
}

/** @deprecated Prefer voiceBandEnergy — kept for visualizer coarse splits. */
export function bandEnergy(data: Uint8Array): SpectrumBands {
  return voiceBandEnergy(data, 24_000, data.length * 2);
}
