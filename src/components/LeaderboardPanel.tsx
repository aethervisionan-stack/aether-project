"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  { id: "hybrid", label: "Híbrido" },
];

function rankTone(position: number): string {
  if (position === 1) return "border-amber-400/35 bg-amber-400/[0.07]";
  if (position === 2) return "border-zinc-300/25 bg-zinc-300/[0.05]";
  if (position === 3) return "border-orange-600/35 bg-orange-900/25";
  return "border-white/[0.06] bg-[#06070A]/45";
}

export function LeaderboardPanel({
  refreshKey = 0,
  highlightEntryId = null,
  compact = false,
  hallOfFame = false,
  onCleared,
}: {
  refreshKey?: number;
  highlightEntryId?: string | null;
  compact?: boolean;
  hallOfFame?: boolean;
  onCleared?: () => void;
}) {
  const [filter, setFilter] = useState<LeaderboardFilter>("all");
  const [tick, setTick] = useState(0);
  const reduce = useReducedMotion();

  const rows = useMemo(() => {
    void refreshKey;
    void tick;
    return getTopLeaderboard(10, filter, highlightEntryId);
  }, [filter, refreshKey, tick, highlightEntryId]);

  const podium = rows.slice(0, 3);
  const rest = hallOfFame ? rows.slice(3) : rows;
  const podiumOrder =
    podium.length >= 3
      ? [podium[1], podium[0], podium[2]]
      : podium;

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
      className={`rounded-3xl border border-white/[0.08] bg-[#0C0E16]/70 backdrop-blur-xl ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-emerald-300/75">
            Hall of Fame
          </p>
          <h2
            id="iq-ranking-heading"
            className="font-iq-display text-xl tracking-tight text-zinc-50 sm:text-2xl"
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
        className="mb-5 flex flex-wrap gap-2"
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
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium tabular-nums transition ${
                active
                  ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-300 shadow-[0_0_20px_-8px_rgba(52,211,153,0.55)]"
                  : "border-white/[0.08] text-zinc-500 hover:border-white/[0.16] hover:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-10 text-center text-sm text-zinc-600">
          Ainda não há resultados neste filtro. Conclua uma avaliação para
          entrar no ranking.
        </p>
      ) : (
        <div className="space-y-5">
          {hallOfFame && podium.length > 0 ? (
            <ol className="grid grid-cols-3 items-end gap-2 sm:gap-3">
              {podiumOrder.map((entry) => {
                if (!entry) return null;
                const position = rows.indexOf(entry) + 1;
                const tall = position === 1;
                return (
                  <motion.li
                    key={entry.id}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduce ? 0 : 0.35 }}
                    className={`flex flex-col items-center rounded-2xl border px-2 py-4 text-center sm:px-3 ${rankTone(
                      position,
                    )} ${tall ? "min-h-[9.5rem] sm:min-h-[10.5rem]" : "min-h-[8rem] sm:min-h-[9rem]"} ${
                      entry.isCurrentUser ? "ring-1 ring-emerald-400/40" : ""
                    }`}
                  >
                    <span className="font-iq-display text-xs tabular-nums text-zinc-500">
                      #{position}
                    </span>
                    <div className="mt-2">
                      <ParticipantAvatar
                        name={entry.name}
                        avatarUrl={entry.avatarUrl}
                        size={tall ? "lg" : "md"}
                        ring={Boolean(entry.isCurrentUser)}
                      />
                    </div>
                    <p className="mt-2 w-full truncate text-xs font-medium text-zinc-200 sm:text-sm">
                      {entry.name}
                    </p>
                    <p className="mt-1 font-iq-display text-lg tabular-nums tracking-tight text-zinc-50 sm:text-xl">
                      {entry.iqScore}
                      <span className="ml-1 text-[10px] font-normal text-zinc-500">
                        QI
                      </span>
                    </p>
                  </motion.li>
                );
              })}
            </ol>
          ) : null}

          <ol className="space-y-2">
            {(hallOfFame ? rest : rows).map((entry, i) => (
              <LeaderboardRow
                key={entry.id}
                entry={entry}
                position={hallOfFame ? i + 4 : i + 1}
              />
            ))}
          </ol>
        </div>
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
      )} ${current ? "ring-1 ring-emerald-400/40" : ""}`}
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
    <div className="rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.08] px-4 py-3 text-center backdrop-blur-md">
      <div className="mb-2 flex justify-center">
        <ParticipantAvatar
          name={name || "Você"}
          avatarUrl={avatarUrl}
          size="md"
          ring
        />
      </div>
      <p className="font-iq-display text-lg tracking-tight text-emerald-300 sm:text-xl">
        Você alcançou o #{rank} lugar
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Entre {total} resultado{total === 1 ? "" : "s"} registrados neste
        navegador.
      </p>
    </div>
  );
}
