/** Short success beep after confirmed irreversible OS actions. */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

/** Soft 2-tone chirp (~120ms) — does not touch Live PCM playback path. */
export async function playSuccessBeep(): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  gain.connect(ctx.destination);

  const o1 = ctx.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(880, now);
  o1.connect(gain);
  o1.start(now);
  o1.stop(now + 0.07);

  const o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.setValueAtTime(1320, now + 0.06);
  o2.connect(gain);
  o2.start(now + 0.06);
  o2.stop(now + 0.14);
}
