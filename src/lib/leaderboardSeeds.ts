import type { LeaderboardEntry } from "@/src/types/quiz";

/** Stable id prefix — never collide with real UUID / lb_ entries. */
export const LEADERBOARD_SEED_ID_PREFIX = "seed_hof_";

export function isSeedLeaderboardId(id: string): boolean {
  return id.startsWith(LEADERBOARD_SEED_ID_PREFIX);
}

/**
 * Avatar sources (photographic placeholders — NOT AI-generated faces):
 * - https://i.pravatar.cc — real-photo CDN used widely for UI demos
 *   (UI Faces / similar stock portraits; `?img=N` pins a stable photo)
 * Some rows omit avatarUrl → ParticipantAvatar shows initials only
 * (fictional placeholder, no photo).
 */
const AVATAR = {
  ana: "https://i.pravatar.cc/150?img=47",
  lucas: "https://i.pravatar.cc/150?img=12",
  camila: "https://i.pravatar.cc/150?img=5",
  pedro: "https://i.pravatar.cc/150?img=68",
  beatriz: "https://i.pravatar.cc/150?img=20",
} as const;

/**
 * Baseline Hall of Fame rows so ranking never looks empty.
 * Merged at read time only — never written over real paid unlocks.
 *
 * Scores: rank 1–3 = 109 / 104 / 103; remaining mid-low (≈82–98).
 * Names: mix of full names and first-name-only.
 * Avatars: mix of pravatar photos and initials-only placeholders.
 */
export const SEED_LEADERBOARD_ENTRIES: readonly LeaderboardEntry[] = [
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}01`,
    name: "Ana Beatriz Costa",
    iqScore: 109,
    confidenceMargin: 6,
    percentile: 73,
    mode: "hybrid",
    accuracyLevel: 78,
    durationSeconds: 1120,
    createdAt: 1_704_000_000_000,
    avatarUrl: AVATAR.ana,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}02`,
    name: "Lucas",
    iqScore: 104,
    confidenceMargin: 6,
    percentile: 61,
    mode: "geometric",
    accuracyLevel: 74,
    durationSeconds: 980,
    createdAt: 1_704_100_000_000,
    avatarUrl: AVATAR.lucas,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}03`,
    name: "Mariana Oliveira",
    iqScore: 103,
    confidenceMargin: 7,
    percentile: 58,
    mode: "questions",
    accuracyLevel: 72,
    durationSeconds: 1340,
    createdAt: 1_704_200_000_000,
    // initials only — fictional placeholder
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}04`,
    name: "Rafael",
    iqScore: 98,
    confidenceMargin: 7,
    percentile: 45,
    mode: "hybrid",
    accuracyLevel: 70,
    durationSeconds: 1210,
    createdAt: 1_704_300_000_000,
    // initials only
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}05`,
    name: "Camila Rodrigues",
    iqScore: 95,
    confidenceMargin: 7,
    percentile: 37,
    mode: "geometric",
    accuracyLevel: 68,
    durationSeconds: 1450,
    createdAt: 1_704_400_000_000,
    avatarUrl: AVATAR.camila,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}06`,
    name: "Pedro",
    iqScore: 92,
    confidenceMargin: 7,
    percentile: 30,
    mode: "questions",
    accuracyLevel: 66,
    durationSeconds: 1080,
    createdAt: 1_704_500_000_000,
    avatarUrl: AVATAR.pedro,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}07`,
    name: "Juliana Alves",
    iqScore: 89,
    confidenceMargin: 8,
    percentile: 23,
    mode: "hybrid",
    accuracyLevel: 64,
    durationSeconds: 1560,
    createdAt: 1_704_600_000_000,
    // initials only
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}08`,
    name: "Thiago",
    iqScore: 86,
    confidenceMargin: 8,
    percentile: 18,
    mode: "geometric",
    accuracyLevel: 62,
    durationSeconds: 1290,
    createdAt: 1_704_700_000_000,
    // initials only
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}09`,
    name: "Beatriz Nogueira",
    iqScore: 84,
    confidenceMargin: 8,
    percentile: 14,
    mode: "questions",
    accuracyLevel: 60,
    durationSeconds: 1680,
    createdAt: 1_704_800_000_000,
    avatarUrl: AVATAR.beatriz,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}10`,
    name: "Gabriel",
    iqScore: 82,
    confidenceMargin: 8,
    percentile: 12,
    mode: "hybrid",
    accuracyLevel: 58,
    durationSeconds: 1410,
    createdAt: 1_704_900_000_000,
    // initials only
  },
] as const;
