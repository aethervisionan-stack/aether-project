import type { HardwareModelId } from "@/lib/hardware";

const FRAMES: Record<
  HardwareModelId,
  { rim: string; lens: string; glow: string }
> = {
  v1: {
    rim: "#9ca3af",
    lens: "rgba(24, 24, 32, 0.85)",
    glow: "rgba(34, 211, 238, 0.12)",
  },
  v2: {
    rim: "#71717a",
    lens: "rgba(18, 28, 36, 0.9)",
    glow: "rgba(34, 211, 238, 0.2)",
  },
  v3: {
    rim: "#cbd5e1",
    lens: "rgba(12, 16, 24, 0.88)",
    glow: "rgba(139, 92, 246, 0.18)",
  },
  v4: {
    rim: "#22d3ee",
    lens: "rgba(6, 24, 32, 0.72)",
    glow: "rgba(34, 211, 238, 0.42)",
  },
};

export function VisionProductVisual({
  model,
  name,
}: {
  model: HardwareModelId;
  name: string;
}) {
  const frame = FRAMES[model];

  return (
    <div className="relative mb-6 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.1),transparent_62%)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ boxShadow: `inset 0 0 80px ${frame.glow}` }}
      />
      <svg
        viewBox="0 0 360 160"
        className="relative mx-auto block h-[148px] w-full sm:h-[168px]"
        role="img"
        aria-label={name}
      >
        <defs>
          <linearGradient id={`${model}-glass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={frame.lens} />
            <stop offset="55%" stopColor="rgba(34,211,238,0.16)" />
            <stop offset="100%" stopColor={frame.lens} />
          </linearGradient>
        </defs>
        <ellipse
          cx="180"
          cy="148"
          rx="108"
          ry="10"
          fill={frame.glow}
          opacity="0.55"
        />
        <path
          d="M42 78c8-22 32-38 78-38 22 0 38 6 50 18 12-12 28-18 50-18 46 0 70 16 78 38 2 6-2 12-8 12H50c-6 0-10-6-8-12Z"
          fill="none"
          stroke={frame.rim}
          strokeWidth={model === "v3" ? 3.2 : 4.4}
          strokeLinejoin="round"
        />
        <rect
          x="48"
          y="52"
          width="112"
          height="46"
          rx={model === "v4" ? 16 : 12}
          fill={`url(#${model}-glass)`}
          stroke={frame.rim}
          strokeWidth="1.4"
        />
        <rect
          x="200"
          y="52"
          width="112"
          height="46"
          rx={model === "v4" ? 16 : 12}
          fill={`url(#${model}-glass)`}
          stroke={frame.rim}
          strokeWidth="1.4"
        />
        <path
          d="M160 74c6 8 14 12 20 12s14-4 20-12"
          fill="none"
          stroke={frame.rim}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {model !== "v1" ? (
          <circle cx="52" cy="62" r={model === "v4" ? 4 : 3} fill="#22d3ee" />
        ) : null}
        {model === "v4" ? (
          <>
            <circle cx="308" cy="62" r="4" fill="#22d3ee" />
            <path
              d="M70 64h70M218 64h70"
              stroke="#22d3ee"
              strokeWidth="1"
              opacity="0.55"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
