/**
 * Gen-1 long-term memory API client — prefs / profile via Vite `/api` proxy.
 */

import { loadCloudUserId } from "./CloudSyncService";

export interface LearnedPreferences {
  tone: string;
  style: string;
  language: string | null;
  technical_level: string;
  notes: string;
  frequent_commands: string[];
  updated_at?: number;
}

export interface MemoryInteraction {
  id: string;
  role: "user" | "aether" | string;
  text: string;
  at: number;
}

export interface MemoryProfile {
  profile_id: string;
  preferences: LearnedPreferences;
  history: MemoryInteraction[];
  created_at?: number;
  updated_at?: number;
  preference_summary?: string;
  system_instruction_preview?: string;
}

export type PreferencePatch = Partial<
  Pick<
    LearnedPreferences,
    "tone" | "style" | "language" | "technical_level" | "notes" | "frequent_commands"
  >
>;


const DEFAULT_PROFILE = loadCloudUserId() || "local";

function apiUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchMemoryProfile(
  profileId: string = DEFAULT_PROFILE,
): Promise<MemoryProfile> {
  const q = new URLSearchParams({ profile_id: profileId });
  const res = await fetch(apiUrl(`/memory/profile?${q}`));
  return readJson<MemoryProfile>(res);
}

export async function updateMemoryPreferences(
  patch: PreferencePatch,
  profileId: string = DEFAULT_PROFILE,
): Promise<MemoryProfile> {
  const q = new URLSearchParams({ profile_id: profileId });
  const res = await fetch(apiUrl(`/memory/profile?${q}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await readJson<Partial<MemoryProfile> & { preferences: LearnedPreferences }>(res);
  // Normalize so HUD always has a usable profile shape after save.
  return {
    profile_id: body.profile_id ?? profileId,
    preferences: body.preferences,
    history: Array.isArray(body.history) ? body.history : [],
    created_at: body.created_at,
    updated_at: body.updated_at,
    preference_summary: body.preference_summary,
    system_instruction_preview: body.system_instruction_preview,
  };
}

export async function clearMemoryProfile(
  opts: { historyOnly?: boolean; profileId?: string } = {},
): Promise<MemoryProfile & { cleared?: boolean }> {
  const q = new URLSearchParams({
    profile_id: opts.profileId ?? DEFAULT_PROFILE,
  });
  if (opts.historyOnly) {
    q.set("history_only", "true");
  }
  const res = await fetch(apiUrl(`/memory/profile?${q}`), { method: "DELETE" });
  return readJson(res);
}

export async function extractMemoryNow(
  profileId: string = DEFAULT_PROFILE,
): Promise<MemoryProfile> {
  const q = new URLSearchParams({ profile_id: profileId });
  const res = await fetch(apiUrl(`/memory/extract?${q}`), { method: "POST" });
  return readJson<MemoryProfile>(res);
}
