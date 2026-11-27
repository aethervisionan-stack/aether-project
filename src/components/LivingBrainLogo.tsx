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
 * Side-profile brain silhouette (occipital left → frontal right).
 * Outer path uses gyri undulations — not a smooth balloon/blob.
 * Includes temporal lobe, cerebellum bulge, and a short brainstem tip.
 * Tuned against media/testlineqi-brain-realistic.jpg.
 */
const BRAIN_OUTLINE =
  "M 54 92 " +
  // brainstem tip → cerebellum (posterior-inferior)
  "C 52 88 50 86 48 84 " +
  "C 44 86 40 87 36 85 " +
  "C 32 83 30 80 28 76 " +
  // occipital lobe with gyri
  "C 24 74 20 70 18 64 " +
  "C 16 58 15 52 16 46 " +
  "C 14 40 16 34 20 30 " +
  "C 18 26 20 22 24 20 " +
  // superior cortex — scalloped gyri left→right
  "C 28 16 32 14 36 13 " +
  "C 38 10 42 9 46 10 " +
  "C 48 7 52 6 56 7 " +
  "C 60 5 64 5 68 7 " +
  "C 72 5 76 6 80 9 " +
  "C 84 8 88 10 92 14 " +
  // frontal pole
  "C 96 16 100 20 102 26 " +
  "C 104 30 105 36 104 42 " +
  "C 106 46 105 52 102 56 " +
  // inferior frontal → temporal lobe bulge
  "C 100 60 98 64 94 66 " +
  "C 96 70 94 74 90 76 " +
  "C 86 80 80 82 74 80 " +
  // Sylvian notch → under temporal toward brainstem
  "C 70 84 66 86 62 86 " +
  "C 60 90 58 92 54 92 Z";

/** Interior cortex fold strokes (sulci/gyri hints) — clipped to outline. */
const GYRI_FOLDS: string[] = [
  // lateral / Sylvian fissure
  "M 34 58 C 44 52 58 50 72 54 C 80 56 88 58 96 52",
  // superior frontal / parietal folds
  "M 28 36 C 40 30 54 28 68 30 C 78 32 88 34 98 38",
  "M 24 48 C 36 42 50 40 64 42 C 76 44 86 46 96 44",
  // occipital / parietal arcs
  "M 22 40 C 28 34 34 28 42 24",
  "M 30 68 C 38 62 48 60 58 62",
  // temporal lobe folds
  "M 70 70 C 78 68 86 66 92 62",
  // cerebellum hint
  "M 36 78 C 42 76 48 78 52 82",
  // central sulcus-ish vertical
  "M 62 18 C 60 30 58 42 60 54",
];

/** Neural mesh nodes inside the brain (viewBox 0 0 120 100). */
const NODES: Array<{ id: string; x: number; y: number; r?: number }> = [
  { id: "n0", x: 30, y: 44, r: 2.2 },
  { id: "n1", x: 38, y: 28, r: 2 },
  { id: "n2", x: 52, y: 20, r: 2.4 },
  { id: "n3", x: 68, y: 24, r: 2 },
  { id: "n4", x: 84, y: 32, r: 2.2 },
  { id: "n5", x: 94, y: 44, r: 1.8 },
  { id: "n6", x: 88, y: 58, r: 2 },
  { id: "n7", x: 76, y: 70, r: 2.2 },
  { id: "n8", x: 58, y: 74, r: 1.8 },
  { id: "n9", x: 42, y: 66, r: 2 },
  { id: "n10", x: 50, y: 46, r: 2.6 },
  { id: "n11", x: 64, y: 44, r: 2.2 },
  { id: "n12", x: 76, y: 50, r: 1.8 },
  { id: "n13", x: 38, y: 52, r: 1.6 },
  { id: "n14", x: 52, y: 84, r: 1.5 },
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
