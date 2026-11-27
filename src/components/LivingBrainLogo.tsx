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

/** Neural mesh nodes inside a side-profile brain (viewBox 0 0 120 100). */
const NODES: Array<{ id: string; x: number; y: number; r?: number }> = [
  { id: "n0", x: 28, y: 42, r: 2.2 },
  { id: "n1", x: 38, y: 28, r: 2 },
  { id: "n2", x: 52, y: 22, r: 2.4 },
  { id: "n3", x: 68, y: 26, r: 2 },
  { id: "n4", x: 82, y: 36, r: 2.2 },
  { id: "n5", x: 90, y: 48, r: 1.8 },
  { id: "n6", x: 84, y: 62, r: 2 },
  { id: "n7", x: 70, y: 70, r: 2.2 },
  { id: "n8", x: 54, y: 74, r: 1.8 },
  { id: "n9", x: 42, y: 62, r: 2 },
  { id: "n10", x: 48, y: 46, r: 2.6 },
  { id: "n11", x: 62, y: 44, r: 2.2 },
  { id: "n12", x: 74, y: 50, r: 1.8 },
  { id: "n13", x: 36, y: 50, r: 1.6 },
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
];

/** Long racing routes for pulse particles (node index chains). */
const PULSE_ROUTES: number[][] = [
  [0, 1, 2, 3, 4, 5],
  [8, 7, 11, 3, 4],
  [9, 13, 10, 11, 12, 6],
  [0, 9, 8, 7, 6, 5],
];

function routePath(route: number[]): string {
  return route
    .map((idx, i) => {
      const n = NODES[idx];
      return `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`;
    })
    .join(" ");
}

/** Side-profile brain silhouette (occipital left → frontal right). */
const BRAIN_OUTLINE =
  "M 22 48 C 20 34 28 18 46 14 C 58 11 70 14 80 22 C 90 30 98 40 96 52 C 95 62 90 70 84 76 C 78 82 70 86 60 86 C 52 86 46 82 42 78 C 38 84 32 88 26 84 C 22 80 24 72 28 68 C 24 62 22 56 22 48 Z";

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
      <path
        d={BRAIN_OUTLINE}
        fill={`url(#${gradId})`}
        opacity={0.14}
      />
      <path
        d={BRAIN_OUTLINE}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.4}
        opacity={0.85}
      />

      <g clipPath={`url(#${clipId})`} filter={`url(#${glowId})`}>
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
                : { strokeDasharray: "18 82", strokeDashoffset: 0, opacity: 0.55 }
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
            fill={
              i < 4 ? "#818cf8" : i < 9 ? "#22d3ee" : "#34d399"
            }
            opacity={0.95}
            style={
              live
                ? { animationDelay: `${(i % 7) * 0.28}s` }
                : undefined
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
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
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
