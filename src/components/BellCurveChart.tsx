"use client";

import { useMemo, useId } from "react";
import { motion } from "framer-motion";
import { normalCdf, pdfNormal } from "@/src/lib/iqCalculator";

export interface BellCurveChartProps {
  iq: number;
  percentile: number;
  width?: number;
  height?: number;
  className?: string;
}

export function BellCurveChart({
  iq,
  percentile,
  width = 560,
  height = 220,
  className = "",
}: BellCurveChartProps) {
  const uid = useId().replace(/:/g, "");
  const mean = 100;
  const sd = 15;
  const minX = 55;
  const maxX = 145;
  const padL = 28;
  const padR = 28;
  const padT = 24;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const { pathD, areaD, markerX, markerY, ticks } = useMemo(() => {
    const samples = 120;
    const points: { x: number; y: number; iq: number }[] = [];
    let peak = 0;
    for (let i = 0; i <= samples; i++) {
      const v = minX + ((maxX - minX) * i) / samples;
      const y = pdfNormal(v, mean, sd);
      peak = Math.max(peak, y);
      points.push({ x: v, y, iq: v });
    }

    const toX = (v: number) => padL + ((v - minX) / (maxX - minX)) * plotW;
    const toY = (p: number) => padT + plotH - (p / peak) * plotH * 0.92;

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.x).toFixed(2)} ${toY(p.y).toFixed(2)}`)
      .join(" ");

    const clampedIq = Math.min(maxX, Math.max(minX, iq));
    const fillPts = points.filter((p) => p.x <= clampedIq);
    const areaD =
      fillPts.length > 0
        ? [
            `M ${toX(fillPts[0].x).toFixed(2)} ${toY(0).toFixed(2)}`,
            ...fillPts.map(
              (p) => `L ${toX(p.x).toFixed(2)} ${toY(p.y).toFixed(2)}`,
            ),
            `L ${toX(fillPts[fillPts.length - 1].x).toFixed(2)} ${toY(0).toFixed(2)}`,
            "Z",
          ].join(" ")
        : "";

    const markerX = toX(clampedIq);
    const markerY = toY(pdfNormal(clampedIq, mean, sd));

    const ticks = [70, 85, 100, 115, 130].map((v) => ({
      v,
      x: toX(v),
      label: String(v),
    }));

    return { pathD, areaD, markerX, markerY, ticks };
  }, [iq, plotW, plotH]);

  const cdf = normalCdf((iq - mean) / sd);

  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Curva normal com QI estimado ${iq}, percentil ${percentile}`}
      >
        <defs>
          <linearGradient id={`bell-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id={`bell-stroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="#27272A"
          strokeWidth={1}
        />

        {ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={t.x}
              y1={padT + 8}
              x2={t.x}
              y2={padT + plotH}
              stroke="#27272A"
              strokeDasharray="3 4"
            />
            <text
              x={t.x}
              y={padT + plotH + 18}
              textAnchor="middle"
              fill="#71717A"
              fontSize={11}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {t.label}
            </text>
          </g>
        ))}

        <motion.path
          d={areaD}
          fill={`url(#bell-fill-${uid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        <motion.path
          d={pathD}
          fill="none"
          stroke={`url(#bell-stroke-${uid})`}
          strokeWidth={2.2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        />

        <motion.g
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <line
            x1={markerX}
            y1={markerY}
            x2={markerX}
            y2={padT + plotH}
            stroke="#A5B4FC"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <circle
            cx={markerX}
            cy={markerY}
            r={6}
            fill="#09090B"
            stroke="#34D399"
            strokeWidth={2}
          />
          <text
            x={Math.min(width - 60, Math.max(padL + 40, markerX))}
            y={Math.max(padT + 14, markerY - 14)}
            textAnchor="middle"
            fill="#E4E4E7"
            fontSize={12}
            fontWeight={600}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            QI {iq}
          </text>
        </motion.g>
      </svg>
      <p className="mt-1 text-center text-sm text-zinc-400">
        Percentil estimado:{" "}
        <span className="font-medium text-emerald-400 tabular-nums">
          {percentile.toFixed(1)}%
        </span>
        <span className="text-zinc-600"> · CDF {cdf.toFixed(3)}</span>
      </p>
    </div>
  );
}
