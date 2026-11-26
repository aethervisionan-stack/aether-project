/**
 * Local IQ leaderboard — isolated storage ready for a future Supabase/API backend.
 * Swap the private load/save helpers for HTTP without changing ranking UI.
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
  return entry.mode === "questions";
}

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

function writeRawEntries(entries: LeaderboardEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const persisted = entries.map((entry) => {
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
  const entries = readRawEntries()
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
    confidenceMargin: input.result.marginOfError,
    percentile: input.result.percentile,
    mode: assessmentModeToLeaderboardMode(input.result.mode),
    accuracyLevel: input.result.diagnosis.precisionScore,
    durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
    createdAt: input.createdAt ?? Date.now(),
  };
}

/** Append a finished session and mark it as the current user entry. */
export function submitLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry {
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
