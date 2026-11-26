"use client";

import type { CellContent, FillKind, Glyph, ShapeKind } from "@/src/types/quiz";

const STROKE = "#E4E4E7";
const ACCENT = "#34D399";

function hatchId(uid: string) {
  return `hatch-${uid}`;
}
function dotsId(uid: string) {
  return `dots-${uid}`;
}

function fillPaint(fill: FillKind | undefined, uid: string): string {
  switch (fill) {
    case "solid":
      return STROKE;
    case "hatched":
      return `url(#${hatchId(uid)})`;
    case "dotted":
      return `url(#${dotsId(uid)})`;
    default:
      return "none";
  }
}

function shapePath(shape: ShapeKind, r: number): string | null {
  switch (shape) {
    case "square": {
      const s = r * 0.85;
      return `M ${-s} ${-s} L ${s} ${-s} L ${s} ${s} L ${-s} ${s} Z`;
    }
    case "diamond": {
      const s = r;
      return `M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z`;
    }
    case "triangle": {
      const s = r;
      return `M 0 ${-s} L ${s * 0.9} ${s * 0.75} L ${-s * 0.9} ${s * 0.75} Z`;
    }
    case "hexagon": {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push(`${Math.cos(a) * r},${Math.sin(a) * r}`);
      }
      return `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z`;
    }
    case "cross": {
      const a = r * 0.25;
      const b = r;
      return `M ${-a} ${-b} L ${a} ${-b} L ${a} ${-a} L ${b} ${-a} L ${b} ${a} L ${a} ${a} L ${a} ${b} L ${-a} ${b} L ${-a} ${a} L ${-b} ${a} L ${-b} ${-a} L ${-a} ${-a} Z`;
    }
    default:
      return null;
  }
}

function GlyphNode({
  glyph,
  cx,
  cy,
  cellR,
  uid,
}: {
  glyph: Glyph;
  cx: number;
  cy: number;
  cellR: number;
  uid: string;
}) {
  const scale = glyph.scale ?? 1;
  const r = cellR * 0.72 * scale;
  const ox = (glyph.ox ?? 0) * cellR;
  const oy = (glyph.oy ?? 0) * cellR;
  const x = cx + ox;
  const y = cy + oy;
  const rot = glyph.rotation ?? 0;
  const sw = glyph.strokeWidth ?? Math.max(1.5, cellR * 0.06);
  const fill = fillPaint(glyph.fill, uid);
  const transform = `translate(${x} ${y}) rotate(${rot})`;

  if (glyph.shape === "circle") {
    return (
      <circle
        cx={0}
        cy={0}
        r={r * 0.85}
        fill={fill}
        stroke={STROKE}
        strokeWidth={sw}
        transform={transform}
      />
    );
  }

  if (glyph.shape === "dot") {
    return (
      <circle
        cx={0}
        cy={0}
        r={r * 0.55}
        fill={glyph.fill === "empty" ? "none" : STROKE}
        stroke={STROKE}
        strokeWidth={sw * 0.7}
        transform={transform}
      />
    );
  }

  if (glyph.shape === "line") {
    const len = r * 1.1;
    return (
      <line
        x1={-len}
        y1={0}
        x2={len}
        y2={0}
        stroke={STROKE}
        strokeWidth={sw * 1.2}
        strokeLinecap="round"
        transform={transform}
      />
    );
  }

  if (glyph.shape === "arc") {
    const rad = r * 0.85;
    const sweep = glyph.param ?? 180;
    const start = (-sweep / 2) * (Math.PI / 180);
    const end = (sweep / 2) * (Math.PI / 180);
    const x1 = Math.cos(start) * rad;
    const y1 = Math.sin(start) * rad;
    const x2 = Math.cos(end) * rad;
    const y2 = Math.sin(end) * rad;
    const large = sweep > 180 ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${rad} ${rad} 0 ${large} 1 ${x2} ${y2}`}
        fill="none"
        stroke={STROKE}
        strokeWidth={sw}
        transform={transform}
      />
    );
  }

  const d = shapePath(glyph.shape, r);
  if (!d) return null;
  return (
    <path
      d={d}
      fill={fill}
      stroke={STROKE}
      strokeWidth={sw}
      strokeLinejoin="round"
      transform={transform}
    />
  );
}

function CellSvg({
  content,
  size,
  showQuestion,
  uid,
}: {
  content: CellContent | null;
  size: number;
  showQuestion?: boolean;
  uid: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const cellR = size * 0.42;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      className="block h-full w-full"
      aria-hidden={!showQuestion}
    >
      <defs>
        <pattern
          id={hatchId(uid)}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke={STROKE}
            strokeWidth="1.5"
          />
        </pattern>
        <pattern
          id={dotsId(uid)}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1.2" fill={STROKE} />
        </pattern>
      </defs>
      {showQuestion || content === null ? (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ACCENT}
          fontSize={size * 0.38}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontWeight={600}
        >
          ?
        </text>
      ) : (
        content.glyphs.map((glyph, i) => (
          <GlyphNode
            key={i}
            glyph={glyph}
            cx={cx}
            cy={cy}
            cellR={cellR}
            uid={`${uid}-${i}`}
          />
        ))
      )}
    </svg>
  );
}

export interface MatrixRendererProps {
  cells: (CellContent | null)[];
  /** Render a single option cell instead of 3×3 */
  option?: CellContent;
  size?: number;
  className?: string;
  highlight?: boolean;
  muted?: boolean;
  label?: string;
}

export function MatrixRenderer({
  cells,
  option,
  size = 320,
  className = "",
  highlight = false,
  muted = false,
  label,
}: MatrixRendererProps) {
  if (option) {
    const s = size;
    return (
      <div
        className={`relative flex items-center justify-center rounded-lg border bg-zinc-950 ${
          highlight
            ? "border-emerald-400/70 ring-1 ring-emerald-400/40"
            : muted
              ? "border-zinc-800 opacity-60"
              : "border-zinc-700"
        } ${className}`}
        style={{ width: s, height: s }}
      >
        <CellSvg content={option} size={s * 0.92} uid={`opt-${label ?? "x"}`} />
        {label ? (
          <span className="absolute left-1.5 top-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  const gap = Math.max(4, size * 0.02);
  const cellSize = (size - gap * 2) / 3;
  const grid = cells.length >= 9 ? cells.slice(0, 9) : [...cells, ...Array(9 - cells.length).fill(null)];

  return (
    <div
      className={`inline-grid aspect-square w-full max-w-full grid-cols-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-1.5 ${className}`}
      style={{
        width: size,
        maxWidth: "100%",
        gap,
      }}
      role="img"
      aria-label="Matriz 3 por 3 de raciocínio"
    >
      {grid.map((c, i) => (
        <div
          key={i}
          className="relative flex aspect-square items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/60"
        >
          <div className="absolute inset-[4%]">
            <CellSvg
              content={c}
              size={cellSize * 0.92}
              showQuestion={i === 8 || c === null}
              uid={`m-${i}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OptionGrid({
  options,
  selectedIndex,
  onSelect,
  revealedCorrect,
  disabled,
  cellSize = 96,
}: {
  options: CellContent[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  revealedCorrect?: number | null;
  disabled?: boolean;
  cellSize?: number;
}) {
  const labels = ["A", "B", "C", "D", "E", "F"];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
      {options.map((opt, i) => {
        const isSelected = selectedIndex === i;
        const isCorrect = revealedCorrect === i;
        const isWrong = revealedCorrect != null && isSelected && !isCorrect;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={`group relative flex flex-col items-center gap-1 rounded-xl border p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
              isCorrect
                ? "border-emerald-400 bg-emerald-400/10"
                : isWrong
                  ? "border-red-400/70 bg-red-400/5"
                  : isSelected
                    ? "border-indigo-400 bg-indigo-400/10"
                    : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
            }`}
            aria-label={`Opção ${labels[i]}`}
            aria-pressed={isSelected}
          >
            <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-300">
              {labels[i]}
              <span className="ml-1 hidden text-zinc-600 sm:inline">
                ({i + 1})
              </span>
            </span>
            <MatrixRenderer
              cells={[]}
              option={opt}
              size={cellSize}
              label={undefined}
              highlight={isSelected || isCorrect}
            />
          </button>
        );
      })}
    </div>
  );
}
