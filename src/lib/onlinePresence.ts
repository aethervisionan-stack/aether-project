"use client";

import { useEffect, useState } from "react";

/** Decorative social-proof range — never gates unlock or scoring. */
export const ONLINE_COUNT_MIN = 230;
export const ONLINE_COUNT_MAX = 250;

function clampOnline(n: number): number {
  return Math.min(ONLINE_COUNT_MAX, Math.max(ONLINE_COUNT_MIN, n));
}

function initialOnlineCount(): number {
  // Bias toward mid band so first paint feels busy without maxing out.
  const mid = (ONLINE_COUNT_MIN + ONLINE_COUNT_MAX) / 2;
  const jitter = Math.round((Math.random() - 0.5) * 8);
  return clampOnline(Math.round(mid + jitter));
}

/**
 * Plausible fluctuating "people online" counter for landing / unlock UI.
 * Client-only decoration — does not touch payment, unlock, or leaderboard writes.
 * Light jitter (±1, rarely ±2) inside 230–250.
 */
export function useOnlineQuizCount(): number {
  const [count, setCount] = useState(initialOnlineCount);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      setCount((prev) => {
        const step = Math.random() < 0.55 ? 1 : -1;
        const magnitude = Math.random() < 0.2 ? 2 : 1;
        return clampOnline(prev + step * magnitude);
      });
      const delay = 3500 + Math.floor(Math.random() * 4500);
      timeoutId = setTimeout(tick, delay);
    };

    timeoutId = setTimeout(tick, 2800 + Math.floor(Math.random() * 2200));
    return () => clearTimeout(timeoutId);
  }, []);

  return count;
}
