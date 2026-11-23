"use client";

import { Flame, Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  isMedievalAudioMuted,
  setMedievalAudioMuted,
} from "@/src/utils/soundEffects";

const TARGET_VOL = 0.35;
const FADE_MS = 1500;
const EVENT = "start-medieval-audio";
const MP3 = "/audio/dark-and-darker-lobby.mp3";
const BPM = 63;
const BEAT = 60 / BPM;

/** Gm — Eb — F — Ebmaj7 plucked lute/guitar arpeggio (Hz) */
const PROGRESSION: number[][] = [
  [196.0, 233.08, 293.66, 392.0], // Gm
  [155.56, 196.0, 233.08, 311.13], // Eb
  [174.61, 220.0, 261.63, 349.23], // F
  [155.56, 196.0, 233.08, 293.66], // Ebmaj7
];

function rampGain(
  gain: GainNode,
  ctx: AudioContext,
  to: number,
  ms: number,
) {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(to, now + ms / 1000);
}

function pluck(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  when: number,
  vol = 0.14,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, when);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.985, when + 0.45);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, when);
  filter.frequency.exponentialRampToValueAtTime(900, when + 0.4);
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(vol, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.55);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(when);
  osc.stop(when + 0.6);
}

export function MedievalAudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(TARGET_VOL);
  const [hoverVol, setHoverVol] = useState(false);
  const [readyHint, setReadyHint] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const modeRef = useRef<"mp3" | "web" | null>(null);
  const volumeRef = useRef(TARGET_VOL);
  const playingRef = useRef(false);
  const webActiveRef = useRef(false);
  const nextNoteRef = useRef(0);
  const chordIdxRef = useRef(0);
  const noteIdxRef = useRef(0);
  const scheduleTimerRef = useRef<number | null>(null);
  const fadeRafRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    setMuted(isMedievalAudioMuted());
    const onMute = (e: Event) => {
      const detail = (e as CustomEvent<{ muted: boolean }>).detail;
      if (detail) setMuted(detail.muted);
    };
    window.addEventListener("medieval-audio-mute-change", onMute);
    return () =>
      window.removeEventListener("medieval-audio-mute-change", onMute);
  }, []);

  const clearFades = useCallback(() => {
    if (fadeRafRef.current != null) {
      window.cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
    if (fadeTimeoutRef.current != null) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  }, []);

  const stopWeb = useCallback(() => {
    webActiveRef.current = false;
    if (scheduleTimerRef.current != null) {
      window.clearTimeout(scheduleTimerRef.current);
      scheduleTimerRef.current = null;
    }
  }, []);

  const scheduleArpeggioRef = useRef<() => void>(() => {});

  useEffect(() => {
    scheduleArpeggioRef.current = () => {
      const ctx = ctxRef.current;
      const master = masterRef.current;
      if (!ctx || !master || !webActiveRef.current) return;

      const horizon = ctx.currentTime + 1.25;
      while (nextNoteRef.current < horizon) {
        const chord = PROGRESSION[chordIdxRef.current % PROGRESSION.length];
        const freq = chord[noteIdxRef.current % chord.length];
        const when = nextNoteRef.current;
        pluck(ctx, master, freq, when, 0.13);
        nextNoteRef.current = when + BEAT / 2;
        noteIdxRef.current += 1;
        if (noteIdxRef.current >= chord.length) {
          noteIdxRef.current = 0;
          chordIdxRef.current =
            (chordIdxRef.current + 1) % PROGRESSION.length;
        }
      }

      scheduleTimerRef.current = window.setTimeout(() => {
        scheduleArpeggioRef.current();
      }, 400);
    };
  }, []);

  const ensureWebAmbience = useCallback(async () => {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) throw new Error("Web Audio unavailable");

    let ctx = ctxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AC();
      ctxRef.current = ctx;
    }
    if (ctx.state === "suspended") await ctx.resume();

    stopWeb();

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterRef.current = master;

    modeRef.current = "web";
    webActiveRef.current = true;
    chordIdxRef.current = 0;
    noteIdxRef.current = 0;
    nextNoteRef.current = ctx.currentTime + 0.05;
    scheduleArpeggioRef.current();
    return master;
  }, [stopWeb]);

  const fadeOutAndPause = useCallback(() => {
    clearFades();

    if (modeRef.current === "mp3" && audioRef.current) {
      const el = audioRef.current;
      const start = el.volume;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / FADE_MS);
        el.volume = start * (1 - p);
        if (p < 1) {
          fadeRafRef.current = window.requestAnimationFrame(step);
        } else {
          el.pause();
          setPlaying(false);
        }
      };
      fadeRafRef.current = window.requestAnimationFrame(step);
      return;
    }

    if (modeRef.current === "web" && masterRef.current && ctxRef.current) {
      rampGain(masterRef.current, ctxRef.current, 0, FADE_MS);
      fadeTimeoutRef.current = window.setTimeout(() => {
        stopWeb();
        setPlaying(false);
      }, FADE_MS + 50);
    } else {
      setPlaying(false);
    }
  }, [clearFades, stopWeb]);

  const startMp3 = useCallback(async (target: number) => {
    let el = audioRef.current;
    if (!el || !el.src.includes("dark-and-darker-lobby")) {
      el = new Audio(MP3);
      el.loop = true;
      el.preload = "auto";
      audioRef.current = el;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        el!.removeEventListener("canplaythrough", onOk);
        el!.removeEventListener("error", onErr);
        if (ok) resolve();
        else reject(new Error("mp3 missing"));
      };
      const onOk = () => finish(true);
      const onErr = () => finish(false);
      const timer = window.setTimeout(() => finish(false), 2500);
      if (el!.readyState >= 3) {
        finish(true);
        return;
      }
      el!.addEventListener("canplaythrough", onOk);
      el!.addEventListener("error", onErr);
      el!.load();
    });

    modeRef.current = "mp3";
    el.volume = 0;
    await el.play();
    setPlaying(true);
    setReadyHint(true);
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / FADE_MS);
      el!.volume = target * p;
      if (p < 1) {
        fadeRafRef.current = window.requestAnimationFrame(step);
      }
    };
    fadeRafRef.current = window.requestAnimationFrame(step);
  }, []);

  const fadeInPlay = useCallback(async () => {
    clearFades();
    setMedievalAudioMuted(false);
    setMuted(false);

    const target = volumeRef.current;

    try {
      await startMp3(target);
      return;
    } catch {
      /* missing/corrupt mp3 → gentle Web Audio fallback */
    }

    try {
      const master = await ensureWebAmbience();
      const ctx = ctxRef.current!;
      rampGain(master, ctx, target, FADE_MS);
      setPlaying(true);
      setReadyHint(true);
    } catch {
      setPlaying(false);
    }
  }, [clearFades, ensureWebAmbience, startMp3]);

  const toggle = useCallback(() => {
    if (playing) {
      setMedievalAudioMuted(true);
      setMuted(true);
      fadeOutAndPause();
    } else {
      void fadeInPlay();
    }
  }, [playing, fadeOutAndPause, fadeInPlay]);

  useEffect(() => {
    const onStart = () => {
      if (!playingRef.current) void fadeInPlay();
    };
    window.addEventListener(EVENT, onStart);
    return () => window.removeEventListener(EVENT, onStart);
  }, [fadeInPlay]);

  useEffect(() => {
    return () => {
      clearFades();
      audioRef.current?.pause();
      stopWeb();
      void ctxRef.current?.close();
    };
  }, [clearFades, stopWeb]);

  function onVolume(e: ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setVolume(v);
    volumeRef.current = v;
    if (modeRef.current === "mp3" && audioRef.current && playing) {
      audioRef.current.volume = v;
    }
    if (modeRef.current === "web" && masterRef.current && playing) {
      masterRef.current.gain.setValueAtTime(
        v,
        ctxRef.current?.currentTime ?? 0,
      );
    }
  }

  const active = playing && !muted;
  const label = active
    ? "Taverna Medieval"
    : readyHint
      ? "Taverna Medieval"
      : "Tocar Tema do Lobby";

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6"
      onMouseEnter={() => setHoverVol(true)}
      onMouseLeave={() => setHoverVol(false)}
    >
      <div className="cine-glass flex items-center gap-2.5 rounded-full border border-[color:var(--cine-border-soft)] px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 text-[color:var(--cine-ink)] transition hover:text-[color:var(--cine-amber-soft)]"
          aria-label={active ? "Pausar taverna medieval" : "Tocar tema do lobby"}
        >
          {muted && !playing ? (
            <VolumeX size={16} className="text-[color:var(--cine-muted)]" />
          ) : active ? (
            <Flame size={16} className="text-[color:var(--cine-amber)]" />
          ) : (
            <Volume2 size={16} className="text-[color:var(--cine-muted)]" />
          )}
          <span className="cine-display hidden text-[10px] uppercase tracking-[0.16em] sm:inline">
            {label}
          </span>
        </button>

        {active && (
          <span className="cine-eq flex h-3 items-end gap-[2px]" aria-hidden>
            <i className="cine-eq-bar cine-eq-1" />
            <i className="cine-eq-bar cine-eq-2" />
            <i className="cine-eq-bar cine-eq-3" />
            <i className="cine-eq-bar cine-eq-4" />
          </span>
        )}

        {(hoverVol || playing) && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={onVolume}
              className="cine-vol h-1 w-16 cursor-pointer appearance-none rounded-full bg-[color:var(--cine-border-soft)] accent-[color:var(--cine-amber)]"
            />
          </label>
        )}
      </div>
    </div>
  );
}

/** Dispatch from CTAs to start shared soundtrack without remounting player */
export function dispatchMedievalAudioStart() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}
