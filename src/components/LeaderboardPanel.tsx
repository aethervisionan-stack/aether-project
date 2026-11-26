"use client";

import { useMemo, useState } from "react";
import type { LeaderboardEntry, LeaderboardFilter } from "@/src/types/quiz";
import { LEADERBOARD_MODE_LABEL } from "@/src/types/quiz";
import {
  clearLeaderboard,
  getTopLeaderboard,
} from "@/src/lib/leaderboard";
import { ParticipantAvatar } from "@/src/components/ParticipantAvatar";

const FILTERS: { id: LeaderboardFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "figures", label: "Figuras" },
  { id: "questions", label: "Perguntas" },
];

function rankTone(position: number): string {
  if (position === 1) return "border-amber-500/35 bg-amber-500/8";
  if (position === 2) return "border-zinc-400/30 bg-zinc-400/5";
  if (position === 3) return "border-orange-700/35 bg-orange-900/20";
  return "border-zinc-800/80 bg-zinc-950/40";
}

export function LeaderboardPanel({
  refreshKey = 0,
  highlightEntryId = null,
  compact = false,
  onCleared,
}: {
  refreshKey?: number;
  highlightEntryId?: string | null;
  compact?: boolean;
  onCleared?: () => void;
}) {
  const [filter, setFilter] = useState<LeaderboardFilter>("all");
  const [tick, setTick] = useState(0);

  const rows = useMemo(() => {
    void refreshKey;
    void tick;
    return getTopLeaderboard(10, filter, highlightEntryId);
  }, [filter, refreshKey, tick, highlightEntryId]);

  const handleClear = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Apagar o histórico local de ranking neste navegador? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    clearLeaderboard();
    setTick((n) => n + 1);
    onCleared?.();
  };

  return (
    <section
      aria-labelledby="iq-ranking-heading"
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/45 ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="iq-ranking-heading"
            className="text-sm font-semibold text-zinc-100 sm:text-base"
          >
            Ranking
          </h2>
          <p className="max-w-xl text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Classificação local neste navegador — sem pontuações infladas.
            Use um nome real para figurar no ranking com clareza.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-xs text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          Limpar histórico local
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Filtro do ranking"
        className="mb-4 flex flex-wrap gap-2"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-emerald-500/45 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-600">
          Ainda não há resultados neste filtro. Conclua uma avaliação para
          entrar no ranking.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((entry, i) => (
            <LeaderboardRow
              key={entry.id}
              entry={entry}
              position={i + 1}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function LeaderboardRow({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: number;
}) {
  const current = Boolean(entry.isCurrentUser);
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 text-sm ${rankTone(
        position,
      )} ${current ? "ring-1 ring-emerald-500/40" : ""}`}
    >
      <span
        className={`w-8 shrink-0 font-iq-display tabular-nums ${
          position <= 3 ? "text-zinc-100" : "text-zinc-500"
        }`}
      >
        #{position}
      </span>
      <ParticipantAvatar
        name={entry.name}
        avatarUrl={entry.avatarUrl}
        size="sm"
        ring={current}
      />
      <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">
        {entry.name}
        {current ? (
          <span className="ml-2 text-[11px] font-normal text-emerald-400/90">
            você
          </span>
        ) : null}
      </span>
      <span className="font-iq-display tabular-nums text-zinc-50">
        {entry.iqScore}
        <span className="ml-1 text-[11px] font-normal text-zinc-500">
          QI
        </span>
      </span>
      <span className="hidden w-20 text-xs text-zinc-500 sm:inline">
        {LEADERBOARD_MODE_LABEL[entry.mode]}
      </span>
      <span className="w-[7.5rem] text-right text-xs tabular-nums text-zinc-500">
        P{entry.percentile.toFixed(0)} · C{entry.accuracyLevel}
      </span>
    </li>
  );
}

export function UserRankBanner({
  rank,
  total,
  name,
  avatarUrl,
}: {
  rank: number | null;
  total: number;
  name?: string;
  avatarUrl?: string | null;
}) {
  if (rank == null) return null;
  return (
    <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/8 px-4 py-3 text-center">
      <div className="mb-2 flex justify-center">
        <ParticipantAvatar
          name={name || "Você"}
          avatarUrl={avatarUrl}
          size="md"
          ring
        />
      </div>
      <p className="font-iq-display text-lg text-emerald-300 sm:text-xl">
        Você alcançou o #{rank} lugar
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Entre {total} resultado{total === 1 ? "" : "s"} registrados neste
        navegador.
      </p>
    </div>
  );
}
