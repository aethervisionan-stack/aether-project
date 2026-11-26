"use client";

import { useOnlineQuizCount } from "@/src/lib/onlinePresence";

/**
 * Decorative “pessoas online” badge. Purely visual social proof —
 * never blocks unlock, payment, or scoring.
 */
export function OnlinePresenceBadge({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const count = useOnlineQuizCount();

  return (
    <p
      className={`inline-flex items-center gap-2 text-zinc-400 ${
        compact ? "text-[11px]" : "text-xs sm:text-sm"
      } ${className}`}
      title="Indicador estimativo de atividade no quiz"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400/90" />
      </span>
      <span className="tabular-nums">
        <span className="font-medium text-zinc-200">{count}</span>
        {" "}
        pessoas online no quiz
      </span>
    </p>
  );
}
