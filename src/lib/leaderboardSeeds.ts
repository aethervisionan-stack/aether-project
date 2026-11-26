import type { LeaderboardEntry } from "@/src/types/quiz";

/** Stable id prefix — never collide with real UUID / lb_ entries. */
export const LEADERBOARD_SEED_ID_PREFIX = "seed_hof_";

export function isSeedLeaderboardId(id: string): boolean {
  return id.startsWith(LEADERBOARD_SEED_ID_PREFIX);
}

/**
 * Baseline Hall of Fame rows so ranking never looks empty.
 * Merged at read time only — never written over real paid unlocks.
 * Avatars omitted → ParticipantAvatar shows initials from names.
 */
export const SEED_LEADERBOARD_ENTRIES: readonly LeaderboardEntry[] = [
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}01`,
    name: "Ana Beatriz Costa",
    iqScore: 132,
    confidenceMargin: 4,
    percentile: 98,
    mode: "hybrid",
    accuracyLevel: 91,
    durationSeconds: 1120,
    createdAt: 1_704_000_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}02`,
    name: "Lucas Ferreira",
    iqScore: 128,
    confidenceMargin: 5,
    percentile: 96,
    mode: "geometric",
    accuracyLevel: 88,
    durationSeconds: 980,
    createdAt: 1_704_100_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}03`,
    name: "Mariana Oliveira",
    iqScore: 124,
    confidenceMargin: 5,
    percentile: 94,
    mode: "questions",
    accuracyLevel: 86,
    durationSeconds: 1340,
    createdAt: 1_704_200_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}04`,
    name: "Rafael Souza",
    iqScore: 119,
    confidenceMargin: 6,
    percentile: 90,
    mode: "hybrid",
    accuracyLevel: 82,
    durationSeconds: 1210,
    createdAt: 1_704_300_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}05`,
    name: "Camila Rodrigues",
    iqScore: 116,
    confidenceMargin: 6,
    percentile: 86,
    mode: "geometric",
    accuracyLevel: 79,
    durationSeconds: 1450,
    createdAt: 1_704_400_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}06`,
    name: "Pedro Henrique Lima",
    iqScore: 113,
    confidenceMargin: 6,
    percentile: 81,
    mode: "questions",
    accuracyLevel: 77,
    durationSeconds: 1080,
    createdAt: 1_704_500_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}07`,
    name: "Juliana Alves",
    iqScore: 109,
    confidenceMargin: 7,
    percentile: 73,
    mode: "hybrid",
    accuracyLevel: 74,
    durationSeconds: 1560,
    createdAt: 1_704_600_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}08`,
    name: "Thiago Mendes",
    iqScore: 105,
    confidenceMargin: 7,
    percentile: 63,
    mode: "geometric",
    accuracyLevel: 71,
    durationSeconds: 1290,
    createdAt: 1_704_700_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}09`,
    name: "Beatriz Nogueira",
    iqScore: 101,
    confidenceMargin: 7,
    percentile: 53,
    mode: "questions",
    accuracyLevel: 68,
    durationSeconds: 1680,
    createdAt: 1_704_800_000_000,
  },
  {
    id: `${LEADERBOARD_SEED_ID_PREFIX}10`,
    name: "Gabriel Martins",
    iqScore: 97,
    confidenceMargin: 8,
    percentile: 42,
    mode: "hybrid",
    accuracyLevel: 65,
    durationSeconds: 1410,
    createdAt: 1_704_900_000_000,
  },
] as const;
