/**
 * Shared FFT helpers for HUD orbit / visualizer.
 * Always sampled from rAF — never from ScriptProcessor / PCM callbacks.
 */

export interface SpectrumBands {
  level: number;
  bass: number;
  mid: number;
  treble: number;
}

export const EMPTY_SPECTRUM: SpectrumBands = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
};

export function createAnalyser(ctx: AudioContext, fftSize = 256): AnalyserNode {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.68;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -18;
  return analyser;
}

export function sampleAnalyser(
  analyser: AnalyserNode | null,
  freqBuf: Uint8Array | null,
): SpectrumBands {
  if (!analyser || !freqBuf || freqBuf.length === 0) {
    return EMPTY_SPECTRUM;
  }
  // DOM lib typings tightened Uint8Array generics; cast keeps AnalyserNode happy.
  analyser.getByteFrequencyData(freqBuf as unknown as Uint8Array<ArrayBuffer>);
  return bandEnergy(freqBuf);
}

export function bandEnergy(data: Uint8Array): SpectrumBands {
  const n = data.length;
  if (!n) {
    return EMPTY_SPECTRUM;
  }
  const bEnd = Math.max(1, Math.floor(n * 0.14));
  const mEnd = Math.max(bEnd + 1, Math.floor(n * 0.48));
  let bass = 0;
  let mid = 0;
  let treble = 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const v = data[i] / 255;
    sum += v;
    if (i < bEnd) bass += v;
    else if (i < mEnd) mid += v;
    else treble += v;
  }
  return {
    level: Math.min(1, (sum / n) * 1.35),
    bass: Math.min(1, (bass / bEnd) * 1.25),
    mid: Math.min(1, (mid / Math.max(1, mEnd - bEnd)) * 1.25),
    treble: Math.min(1, (treble / Math.max(1, n - mEnd)) * 1.25),
  };
}
