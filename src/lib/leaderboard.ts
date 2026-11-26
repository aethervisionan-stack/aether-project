/**
 * Local IQ leaderboard — isolated from quiz session storage (quizStorage.ts).
 * Ready for a future Supabase/API backend: swap readRawEntries/writeRawEntries
 * without changing ranking UI or session resume.
 */

import type {
  AssessmentMode,
  IqResult,
  LeaderboardEntry,
  LeaderboardFilter,
  LeaderboardMode,
} from "@/src/types/quiz";
import {
  ANONYMOUS_PARTICIPANT_NAME,
  LEADERBOARD_CURRENT_ID_KEY,
  LEADERBOARD_STORAGE_KEY,
} from "@/src/types/quiz";
import { isDataUrlAvatar } from "@/src/lib/avatarImage";
import {
  isSeedLeaderboardId,
  SEED_LEADERBOARD_ENTRIES,
} from "@/src/lib/leaderboardSeeds";

export type { LeaderboardEntry, LeaderboardFilter, LeaderboardMode };

/** Accept local data URLs or future remote http(s) avatar URLs. */
function normalizeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  if (isDataUrlAvatar(value)) return value;
  if (/^https?:\/\//i.test(value) && value.length < 2048) return value;
  return undefined;
}

export function assessmentModeToLeaderboardMode(
  mode: AssessmentMode,
): LeaderboardMode {
  if (mode === "figures") return "geometric";
  return mode;
}

export function normalizeParticipantName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return ANONYMOUS_PARTICIPANT_NAME;
  return trimmed.slice(0, 40);
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.iqScore !== a.iqScore) return b.iqScore - a.iqScore;
  if (b.accuracyLevel !== a.accuracyLevel) {
    return b.accuracyLevel - a.accuracyLevel;
  }
  if (a.durationSeconds !== b.durationSeconds) {
    return a.durationSeconds - b.durationSeconds;
  }
  return b.createdAt - a.createdAt;
}

function matchesFilter(
  entry: LeaderboardEntry,
  filter: LeaderboardFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "figures") return entry.mode === "geometric";
  if (filter === "questions") return entry.mode === "questions";
  return entry.mode === "hybrid";
}

/** Real local entries only — strip any seed ids that may have leaked into storage. */
function readRawEntries(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e) =>
          e &&
          typeof e.id === "string" &&
          !isSeedLeaderboardId(e.id) &&
          typeof e.name === "string" &&
          typeof e.iqScore === "number" &&
          typeof e.mode === "string",
      )
      .map((e) => {
        const avatarUrl = normalizeAvatarUrl(e.avatarUrl);
        return avatarUrl ? { ...e, avatarUrl } : { ...e, avatarUrl: undefined };
      });
  } catch {
    return [];
  }
}

/**
 * Baseline seeds + real local rows. Seeds never persist and never replace a
 * real entry (paid unlock / local finish). Real users sort by the same rules.
 */
function mergeWithSeeds(real: LeaderboardEntry[]): LeaderboardEntry[] {
  const realIds = new Set(real.map((e) => e.id));
  const seeds = SEED_LEADERBOARD_ENTRIES.filter((s) => !realIds.has(s.id)).map(
    (s) => ({ ...s }),
  );
  return [...real, ...seeds];
}

function writeRawEntries(entries: LeaderboardEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    // Never persist seed baseline — paid/local unlocks stay authoritative.
    const persisted = entries
      .filter((entry) => !isSeedLeaderboardId(entry.id))
      .map((entry) => {
        const { isCurrentUser: _ignored, ...rest } = entry;
        void _ignored;
        // Keep avatarUrl when present; omit when absent so payload stays remote-ready.
        if (!rest.avatarUrl) {
          const { avatarUrl: _noAvatar, ...withoutAvatar } = rest;
          void _noAvatar;
          return withoutAvatar;
        }
        return rest;
      });
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // quota / private mode
  }
}

export function getCurrentLeaderboardEntryId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LEADERBOARD_CURRENT_ID_KEY);
  } catch {
    return null;
  }
}

export function setCurrentLeaderboardEntryId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(LEADERBOARD_CURRENT_ID_KEY, id);
    else localStorage.removeItem(LEADERBOARD_CURRENT_ID_KEY);
  } catch {
    // ignore
  }
}

/** Sorted ranking with isCurrentUser flags. Ready for remote sync later. */
export function listLeaderboard(
  filter: LeaderboardFilter = "all",
  currentEntryId: string | null = getCurrentLeaderboardEntryId(),
): LeaderboardEntry[] {
  const entries = mergeWithSeeds(readRawEntries())
    .filter((e) => matchesFilter(e, filter))
    .map((e) => ({
      ...e,
      isCurrentUser: currentEntryId != null && e.id === currentEntryId,
    }));
  entries.sort(compareEntries);
  return entries;
}

export function getTopLeaderboard(
  limit = 10,
  filter: LeaderboardFilter = "all",
  currentEntryId: string | null = getCurrentLeaderboardEntryId(),
): LeaderboardEntry[] {
  return listLeaderboard(filter, currentEntryId).slice(0, limit);
}

export function getLeaderboardRank(
  entryId: string,
  filter: LeaderboardFilter = "all",
): number | null {
  const ranked = listLeaderboard(filter, entryId);
  const idx = ranked.findIndex((e) => e.id === entryId);
  return idx >= 0 ? idx + 1 : null;
}

export function buildLeaderboardEntry(input: {
  name: string;
  result: IqResult;
  durationSeconds: number;
  createdAt?: number;
  avatarUrl?: string | null;
}): LeaderboardEntry {
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl ?? undefined);
  return {
    id: createId(),
    name: normalizeParticipantName(input.name),
    ...(avatarUrl ? { avatarUrl } : {}),
    iqScore: input.result.iq,
    confidenceMargin:
      input.result.confidenceMargin ?? input.result.marginOfError,
    percentile: input.result.percentile,
    mode: assessmentModeToLeaderboardMode(input.result.mode),
    accuracyLevel:
      input.result.consistencyScore ??
      input.result.diagnosis.consistencyScore,
    durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
    createdAt: input.createdAt ?? Date.now(),
  };
}

/** Append a finished session and mark it as the current user entry. */
export function submitLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry {
  // Guard: never let a seed-shaped id overwrite or masquerade as a paid unlock.
  if (isSeedLeaderboardId(entry.id)) {
    return { ...entry, isCurrentUser: true };
  }
  const entries = readRawEntries();
  entries.push(entry);
  writeRawEntries(entries);
  setCurrentLeaderboardEntryId(entry.id);
  return { ...entry, isCurrentUser: true };
}

export function clearLeaderboard(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEADERBOARD_STORAGE_KEY);
    localStorage.removeItem(LEADERBOARD_CURRENT_ID_KEY);
  } catch {
    // ignore
  }
}

export function durationSecondsFromSession(
  startedAt: number | null,
  finishedAt: number | null,
  timeSpentMs: number[],
): number {
  if (startedAt && finishedAt && finishedAt >= startedAt) {
    return Math.round((finishedAt - startedAt) / 1000);
  }
  const sum = timeSpentMs.reduce((a, b) => a + (b || 0), 0);
  return Math.round(sum / 1000);
}
