"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";

type Size = "sm" | "md" | "lg" | "hero";

const SIZE_PX: Record<Size, number> = {
  sm: 36,
  md: 48,
  lg: 72,
  hero: 112,
};

/**
 * Side-profile brain silhouette (frontal left → occipital right).
 * Contour traced from media/testlineqi-brain-realistic.jpg (largest blob
 * envelope → Catmull-Rom). Gyri outline + temporal hang + brainstem —
 * not a circle/balloon.
 */
const BRAIN_OUTLINE =
  "M 110.66 52.62 C 110.59 54.29 110.76 54.39 110.37 55.68 C 109.98 56.97 109.37 58.89 108.33 60.34 C 107.29 61.8 105.54 62.81 104.11 64.41 C 102.68 66.01 100.69 68.58 99.74 69.94 C 98.79 71.3 99.21 71.49 98.43 72.56 C 97.65 73.63 96.2 75.33 95.08 76.35 C 93.96 77.37 93.04 78.03 91.73 78.68 C 90.42 79.34 88.77 79.89 87.22 80.28 C 85.67 80.67 84.05 81.01 82.42 81.01 C 80.8 81.01 78.34 78.05 77.47 80.28 C 76.6 82.51 78.05 91.85 77.18 94.4 C 76.31 96.95 73.91 97.31 72.23 95.56 C 70.56 93.81 68.71 87.05 67.13 83.92 C 65.55 80.79 63.96 78.28 62.77 76.78 C 61.58 75.28 60.87 75.67 60 74.89 C 59.13 74.11 58.4 73 57.53 72.13 C 56.66 71.26 55.66 69.89 54.76 69.65 C 53.86 69.41 53.06 70.4 52.14 70.67 C 51.22 70.94 50.22 71.13 49.23 71.25 C 48.23 71.37 47.16 71.45 46.17 71.4 C 45.18 71.35 44.23 71.23 43.26 70.96 C 42.29 70.69 41.27 70.26 40.35 69.8 C 39.43 69.34 38.55 68.81 37.73 68.2 C 36.9 67.59 36.01 66.79 35.4 66.16 C 34.79 65.53 34.45 65.14 34.09 64.41 C 33.73 63.68 34.51 62.69 33.22 61.79 C 31.93 60.89 29.09 59.86 26.37 59.03 C 23.65 58.2 19.26 57.88 16.91 56.84 C 14.56 55.8 13.32 54.32 12.25 52.77 C 11.18 51.22 11.02 49.33 10.51 47.53 C 10 45.73 9.37 43.52 9.2 41.99 C 9.03 40.46 9.15 39.98 9.49 38.35 C 9.83 36.73 10.65 33.79 11.23 32.24 C 11.81 30.69 12.18 30.45 12.98 29.04 C 13.78 27.63 15.02 25.28 16.04 23.8 C 17.06 22.32 17.83 21.42 19.09 20.16 C 20.35 18.9 22.27 17.39 23.61 16.23 C 24.95 15.07 25.72 14.04 27.1 13.17 C 28.48 12.3 30.36 11.77 31.91 10.99 C 33.46 10.21 34.89 9.19 36.42 8.51 C 37.95 7.83 39.24 7.42 41.08 6.91 C 42.92 6.4 45.9 5.8 47.48 5.46 C 49.06 5.12 48.86 5.09 50.54 4.87 C 52.22 4.65 55.88 4.29 57.53 4.15 C 59.18 4.01 58.86 3.81 60.44 4 C 62.02 4.19 65.07 5.12 66.99 5.31 C 68.91 5.5 70.58 5.06 71.94 5.16 C 73.3 5.26 73.59 5.43 75.14 5.89 C 76.69 6.35 79.55 7.32 81.25 7.93 C 82.95 8.54 84.19 8.92 85.33 9.53 C 86.47 10.14 86.66 10.65 88.09 11.57 C 89.52 12.49 92.49 14.07 93.92 15.06 C 95.35 16.05 95.47 16.2 96.68 17.54 C 97.89 18.88 100.03 21.59 101.2 23.07 C 102.37 24.55 102.77 24.94 103.67 26.42 C 104.57 27.9 105.8 30.4 106.58 31.95 C 107.36 33.5 107.77 34.06 108.33 35.73 C 108.89 37.4 109.52 40.34 109.93 41.99 C 110.34 43.64 110.68 43.86 110.8 45.63 C 110.92 47.4 110.73 50.95 110.66 52.62 Z";

/** Interior cortex fold strokes (sulci/gyri hints) — clipped to outline. */
const GYRI_FOLDS: string[] = [
  // Sylvian / lateral fissure
  "M 22 52 C 36 46 54 48 72 56 C 84 60 94 62 104 58",
  // superior cortex arcs
  "M 24 34 C 40 26 58 22 78 26 C 90 28 100 34 108 42",
  "M 20 44 C 38 36 56 34 74 38 C 88 42 98 46 108 48",
  // frontal / parietal
  "M 18 38 C 28 28 40 22 52 18",
  // temporal lobe folds
  "M 40 68 C 50 64 62 66 72 72",
  // occipital
  "M 88 36 C 96 42 102 50 106 58",
  // cerebellum / brainstem region
  "M 62 78 C 68 82 74 88 76 94",
  // central
  "M 58 12 C 56 28 54 44 56 58",
];

/** Neural mesh nodes inside the brain (viewBox 0 0 120 100). */
const NODES: Array<{ id: string; x: number; y: number; r?: number }> = [
  { id: "n0", x: 26, y: 40, r: 2.2 },
  { id: "n1", x: 36, y: 26, r: 2 },
  { id: "n2", x: 52, y: 16, r: 2.4 },
  { id: "n3", x: 70, y: 18, r: 2 },
  { id: "n4", x: 88, y: 28, r: 2.2 },
  { id: "n5", x: 100, y: 42, r: 1.8 },
  { id: "n6", x: 96, y: 58, r: 2 },
  { id: "n7", x: 82, y: 68, r: 2.2 },
  { id: "n8", x: 64, y: 72, r: 1.8 },
  { id: "n9", x: 44, y: 64, r: 2 },
  { id: "n10", x: 52, y: 42, r: 2.6 },
  { id: "n11", x: 68, y: 42, r: 2.2 },
  { id: "n12", x: 82, y: 48, r: 1.8 },
  { id: "n13", x: 38, y: 48, r: 1.6 },
  { id: "n14", x: 74, y: 88, r: 1.5 },
];

const EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 0],
  [0, 13],
  [13, 10],
  [1, 10],
  [2, 10],
  [2, 11],
  [3, 11],
  [4, 12],
  [10, 11],
  [11, 12],
  [12, 6],
  [11, 7],
  [10, 9],
  [13, 9],
  [3, 12],
  [8, 14],
  [9, 14],
];

/** Long racing routes for pulse particles (node index chains). */
const PULSE_ROUTES: number[][] = [
  [0, 1, 2, 3, 4, 5],
  [8, 7, 11, 3, 4],
  [9, 13, 10, 11, 12, 6],
  [0, 9, 8, 7, 6, 5],
  [14, 8, 7, 12, 5],
];

function routePath(route: number[]): string {
  return route
    .map((idx, i) => {
      const n = NODES[idx];
      return `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`;
    })
    .join(" ");
}

export function LivingBrainMark({
  size = "md",
  className = "",
  animate = true,
}: {
  size?: Size;
  className?: string;
  animate?: boolean;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const px = SIZE_PX[size];
  const live = animate && !reduce;

  const gradId = `lb-grad-${uid}`;
  const glowId = `lb-glow-${uid}`;
  const clipId = `lb-clip-${uid}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 100"
      className={`living-brain-mark ${live ? "living-brain-mark--live" : ""} ${className}`}
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="8%" y1="40%" x2="96%" y2="55%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="48%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={clipId}>
          <path d={BRAIN_OUTLINE} />
        </clipPath>
      </defs>

      {/* Soft shell */}
      <path d={BRAIN_OUTLINE} fill={`url(#${gradId})`} opacity={0.14} />
      <path
        d={BRAIN_OUTLINE}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.35}
        strokeLinejoin="round"
        opacity={0.9}
      />

      <g clipPath={`url(#${clipId})`} filter={`url(#${glowId})`}>
        {/* Cortex fold hints */}
        {GYRI_FOLDS.map((d, i) => (
          <path
            key={`gyrus-${i}`}
            d={d}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={0.55}
            strokeLinecap="round"
            opacity={0.28}
          />
        ))}

        {/* Base mesh */}
        {EDGES.map(([a, b], i) => {
          const na = NODES[a];
          const nb = NODES[b];
          return (
            <line
              key={`e-${i}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={`url(#${gradId})`}
              strokeWidth={0.7}
              opacity={0.35}
            />
          );
        })}

        {/* Racing pulse strokes */}
        {PULSE_ROUTES.map((route, i) => (
          <path
            key={`pulse-${i}`}
            className={live ? "living-brain-pulse" : undefined}
            d={routePath(route)}
            fill="none"
            stroke={
              i % 3 === 0 ? "#a5b4fc" : i % 3 === 1 ? "#67e8f9" : "#6ee7b7"
            }
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
            style={
              live
                ? {
                    animationDelay: `${i * 0.55}s`,
                    animationDuration: `${2.4 + i * 0.35}s`,
                  }
                : {
                    strokeDasharray: "18 82",
                    strokeDashoffset: 0,
                    opacity: 0.55,
                  }
            }
          />
        ))}

        {/* Nodes */}
        {NODES.map((n, i) => (
          <circle
            key={n.id}
            className={live ? "living-brain-node" : undefined}
            cx={n.x}
            cy={n.y}
            r={n.r ?? 2}
            fill={i < 4 ? "#818cf8" : i < 9 ? "#22d3ee" : "#34d399"}
            opacity={0.95}
            style={
              live ? { animationDelay: `${(i % 7) * 0.28}s` } : undefined
            }
          />
        ))}
      </g>
    </svg>
  );
}

export function LivingBrainLogo({
  size = "md",
  showWordmark = true,
  className = "",
  href = "/teste-qi",
  animate = true,
}: {
  size?: Size;
  showWordmark?: boolean;
  className?: string;
  href?: string | null;
  animate?: boolean;
}) {
  const mark = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LivingBrainMark size={size} animate={animate} />
      {showWordmark ? (
        <span
          className={`font-iq-display tracking-tight text-zinc-50 ${
            size === "sm"
              ? "text-base sm:text-lg"
              : size === "md"
                ? "text-lg sm:text-xl"
                : size === "lg"
                  ? "text-2xl"
                  : "text-3xl sm:text-4xl"
          }`}
        >
          Test
          <span className="bg-gradient-to-r from-indigo-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            Line
          </span>
          Qi
        </span>
      ) : null}
    </span>
  );

  if (!href) return mark;

  return (
    <a
      href={href}
      className="inline-flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070A]"
      aria-label="TestLineQi"
    >
      {mark}
    </a>
  );
}
