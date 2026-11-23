"use client";

import { Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

const TARGET_VOL = 0.35;
const FADE_MS = 2000;
const EVENT = "start-medieval-audio";
const MP3 = "/audio/medieval-ambience.mp3";

/** Soft D-minor / Dorian drones for ethereal fallback ambience */
const DORIAN_HZ = [146.83, 174.61, 220.0, 293.66]; // D3 A3 A3 D4-ish cluster

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

export function MedievalAudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(TARGET_VOL);
  const [hoverVol, setHoverVol] = useState(false);
  const [readyHint, setReadyHint] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const oscRef = useRef<OscillatorNode[]>([]);
  const modeRef = useRef<"mp3" | "web" | null>(null);
  const volumeRef = useRef(TARGET_VOL);
  const fadeRafRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

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
    for (const o of oscRef.current) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    oscRef.current = [];
  }, []);

  const ensureWebAmbience = useCallback(async () => {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) throw new Error("Web Audio unavailable");

    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new AC();
      ctxRef.current = ctx;
    }
    if (ctx.state === "suspended") await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterRef.current = master;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 680;
    filter.Q.value = 0.7;
    filter.connect(master);

    stopWeb();
    const oscs: OscillatorNode[] = [];
    DORIAN_HZ.forEach((hz, i) => {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = hz;
      g.gain.value = i === 0 ? 0.22 : 0.09;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      oscs.push(osc);
    });
    oscRef.current = oscs;
    modeRef.current = "web";
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

  const fadeInPlay = useCallback(async () => {
    clearFades();

    const target = volumeRef.current;

    // Prefer MP3 loop when file exists
    try {
      let el = audioRef.current;
      if (!el) {
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
        const timer = window.setTimeout(() => finish(false), 2200);
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
      return;
    } catch {
      /* fall through to Web Audio */
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
  }, [clearFades, ensureWebAmbience]);

  const toggle = useCallback(() => {
    if (playing) fadeOutAndPause();
    else void fadeInPlay();
  }, [playing, fadeOutAndPause, fadeInPlay]);

  useEffect(() => {
    const onStart = () => {
      if (!playing) void fadeInPlay();
    };
    window.addEventListener(EVENT, onStart);
    return () => window.removeEventListener(EVENT, onStart);
  }, [playing, fadeInPlay]);

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
          aria-label={playing ? "Pausar trilha" : "Ativar som"}
        >
          {playing ? (
            <Volume2 size={16} className="text-[color:var(--cine-amber)]" />
          ) : (
            <VolumeX size={16} className="text-[color:var(--cine-muted)]" />
          )}
          <span className="cine-display hidden text-[10px] uppercase tracking-[0.18em] sm:inline">
            {playing || readyHint ? "Trilha Arcana" : "Ativar Som"}
          </span>
        </button>

        {playing && (
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
