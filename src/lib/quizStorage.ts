/**
 * Quiz session persistence — local adapter today, swap for remote DB later.
 * Ranking lives in leaderboard.ts; this module never writes ranking keys.
 */
import type { AssessmentMode, QuizPersistedState } from "@/src/types/quiz";
import {
  QUIZ_STORAGE_KEY_LEGACY_V1,
  QUIZ_STORAGE_KEY_LEGACY_V2,
  QUIZ_STORAGE_KEY_LEGACY_V3,
  QUIZ_STORAGE_VERSION,
  QUIZ_TOTAL_QUESTIONS,
  quizStorageKey,
} from "@/src/types/quiz";

/** Pluggable store surface for future HTTP/DB backends. */
export type QuizSessionStore = {
  load(mode: AssessmentMode): QuizPersistedState | null;
  save(state: QuizPersistedState): void;
  clear(mode?: AssessmentMode): void;
};

function readLocal(mode: AssessmentMode): QuizPersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(quizStorageKey(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizPersistedState;
    if (parsed?.version !== QUIZ_STORAGE_VERSION) return null;
    if (parsed.mode !== mode) return null;
    const total = parsed.totalQuestions ?? QUIZ_TOTAL_QUESTIONS;
    if (!Array.isArray(parsed.answers) || parsed.answers.length !== total) {
      return null;
    }
    if (!Array.isArray(parsed.optionSwitches)) {
      parsed.optionSwitches = Array(total).fill(0);
    }
    if (!Array.isArray(parsed.timeSpentMs)) {
      parsed.timeSpentMs = Array(total).fill(0);
    }
    if (typeof parsed.participantName !== "string") {
      parsed.participantName = "";
    }
    if (
      parsed.participantAvatarUrl !== null &&
      typeof parsed.participantAvatarUrl !== "string"
    ) {
      parsed.participantAvatarUrl = null;
    }
    if (parsed.participantAvatarUrl === undefined) {
      parsed.participantAvatarUrl = null;
    }
    if (parsed.leaderboardEntryId === undefined) {
      parsed.leaderboardEntryId = null;
    }
    if (
      parsed.sessionSeed === undefined ||
      (parsed.sessionSeed !== null && typeof parsed.sessionSeed !== "number")
    ) {
      parsed.sessionSeed = null;
    }
    if (typeof parsed.sessionId !== "string") {
      parsed.sessionId = null;
    }
    if (typeof parsed.resultsUnlocked !== "boolean") {
      parsed.resultsUnlocked = false;
    }
    if (typeof parsed.unlockOrderNsu !== "string") {
      parsed.unlockOrderNsu = null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(state: QuizPersistedState): void {
  if (typeof window === "undefined") return;
  if (state.phase === "modeSelect") return;
  try {
    localStorage.setItem(quizStorageKey(state.mode), JSON.stringify(state));
  } catch {
    // quota / private mode — ignore
  }
}

function clearLocal(mode?: AssessmentMode): void {
  if (typeof window === "undefined") return;
  try {
    if (mode) {
      localStorage.removeItem(quizStorageKey(mode));
    } else {
      for (const m of ["figures", "questions", "hybrid"] as AssessmentMode[]) {
        localStorage.removeItem(quizStorageKey(m));
      }
    }
    localStorage.removeItem(QUIZ_STORAGE_KEY_LEGACY_V3);
    localStorage.removeItem(QUIZ_STORAGE_KEY_LEGACY_V2);
    localStorage.removeItem(QUIZ_STORAGE_KEY_LEGACY_V1);
    for (const m of ["figures", "questions", "hybrid"] as AssessmentMode[]) {
      localStorage.removeItem(`professional-iq-test-v3-${m}`);
    }
  } catch {
    // ignore
  }
}

/** Default localStorage adapter — replace in one place when moving to DB. */
export const localQuizSessionStore: QuizSessionStore = {
  load: readLocal,
  save: writeLocal,
  clear: clearLocal,
};

let activeStore: QuizSessionStore = localQuizSessionStore;

/** Inject a remote/DB-backed store without rewriting UI callers. */
export function setQuizSessionStore(store: QuizSessionStore): void {
  activeStore = store;
}

export function loadQuizState(mode: AssessmentMode): QuizPersistedState | null {
  return activeStore.load(mode);
}

export function saveQuizState(state: QuizPersistedState): void {
  activeStore.save(state);
}

export function clearQuizState(mode?: AssessmentMode): void {
  activeStore.clear(mode);
}

export function createInitialState(
  mode: AssessmentMode,
  totalQuestions = QUIZ_TOTAL_QUESTIONS,
  participantName = "",
  participantAvatarUrl: string | null = null,
  sessionSeed: number | null = null,
): QuizPersistedState {
  return {
    version: QUIZ_STORAGE_VERSION,
    mode,
    phase: "onboarding",
    currentIndex: 0,
    answers: Array(totalQuestions).fill(null),
    startedAt: null,
    endsAt: null,
    questionStartedAt: null,
    timeSpentMs: Array(totalQuestions).fill(0),
    optionSwitches: Array(totalQuestions).fill(0),
    finishedAt: null,
    result: null,
    totalQuestions,
    participantName,
    participantAvatarUrl,
    leaderboardEntryId: null,
    sessionSeed,
    sessionId: null,
    resultsUnlocked: false,
    unlockOrderNsu: null,
  };
}

export function createModeSelectState(): QuizPersistedState {
  return {
    version: QUIZ_STORAGE_VERSION,
    mode: "figures",
    phase: "modeSelect",
    currentIndex: 0,
    answers: [],
    startedAt: null,
    endsAt: null,
    questionStartedAt: null,
    timeSpentMs: [],
    optionSwitches: [],
    finishedAt: null,
    result: null,
    totalQuestions: QUIZ_TOTAL_QUESTIONS,
    participantName: "",
    participantAvatarUrl: null,
    leaderboardEntryId: null,
    sessionSeed: null,
    sessionId: null,
    resultsUnlocked: false,
    unlockOrderNsu: null,
  };
}
