/**
 * Subtle medieval SFX via Web Audio.
 * Respects localStorage key `medieval_audio_muted` (shared with MedievalAudioPlayer).
 */

export const MEDIEVAL_MUTE_KEY = "medieval_audio_muted";

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

export function isMedievalAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MEDIEVAL_MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setMedievalAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEDIEVAL_MUTE_KEY, muted ? "true" : "false");
    window.dispatchEvent(
      new CustomEvent("medieval-audio-mute-change", { detail: { muted } }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

async function withCtx(
  fn: (ctx: AudioContext, now: number) => void,
): Promise<void> {
  if (isMedievalAudioMuted()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    fn(ctx, ctx.currentTime);
  } catch {
    /* non-fatal */
  }
}

function tone(
  ctx: AudioContext,
  now: number,
  opts: {
    freq: number;
    type?: OscillatorType;
    vol: number;
    attack: number;
    decay: number;
    delay?: number;
    sweepTo?: number;
    lp?: number;
  },
) {
  const t0 = now + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.sweepTo != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.sweepTo),
      t0 + opts.attack + opts.decay,
    );
  }

  let node: AudioNode = osc;
  if (opts.lp != null) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(opts.lp, t0);
    osc.connect(lp);
    node = lp;
  }

  node.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(opts.vol, t0 + opts.attack);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    t0 + opts.attack + opts.decay,
  );
  osc.start(t0);
  osc.stop(t0 + opts.attack + opts.decay + 0.05);
}

/**
 * Parchment click — dry page tap.
 * Spec: triangle 240→110 Hz, attack 0.003s, decay 0.08s, peak 0.06, lp 1400.
 * Plus brief noise dust at 0.04 peak through lp 2200.
 */
export function playParchmentClick(): void {
  void withCtx((ctx, now) => {
    tone(ctx, now, {
      freq: 240,
      sweepTo: 110,
      type: "triangle",
      vol: 0.06,
      attack: 0.003,
      decay: 0.08,
      lp: 1400,
    });

    const dur = 0.05;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.04, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.02);
  });
}

/**
 * Stage chime — soft Dorian bells (stage / journey cues).
 * Spec: sine D5 587.33 @ t+0 (vol 0.10, attack 0.012, decay 0.55);
 *       sine A5 880.00 @ t+0.14 (vol 0.08, attack 0.012, decay 0.7).
 */
export function playStageChime(): void {
  void withCtx((ctx, now) => {
    tone(ctx, now, {
      freq: 587.33,
      vol: 0.1,
      attack: 0.012,
      decay: 0.55,
    });
    tone(ctx, now, {
      freq: 880.0,
      vol: 0.08,
      attack: 0.012,
      decay: 0.7,
      delay: 0.14,
    });
  });
}

/**
 * Reveal chord — D minor (matches Trilha Arcana Dorian bed).
 * Spec: simultaneous sines D3 146.83, F3 174.61, A3 220.00, D4 293.66;
 *       each vol 0.09, attack 0.02s, decay 1.4s; soft lp 2400 on stack via individual.
 */
export function playRevealChord(): void {
  void withCtx((ctx, now) => {
    const freqs = [146.83, 174.61, 220.0, 293.66];
    for (const freq of freqs) {
      tone(ctx, now, {
        freq,
        type: "sine",
        vol: 0.09,
        attack: 0.02,
        decay: 1.4,
        lp: 2400,
      });
    }
  });
}
