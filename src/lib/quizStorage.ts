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

const ASSESSMENT_MODES: AssessmentMode[] = ["figures", "questions", "hybrid"];

/** Activity timestamp for resume ranking (finished > started > endsAt). */
export function quizStateActivityAt(state: QuizPersistedState): number {
  return (
    state.finishedAt ??
    state.startedAt ??
    state.endsAt ??
    state.questionStartedAt ??
    0
  );
}

export function listSavedQuizStates(): QuizPersistedState[] {
  const out: QuizPersistedState[] = [];
  for (const mode of ASSESSMENT_MODES) {
    const saved = loadQuizState(mode);
    if (saved) out.push(saved);
  }
  return out;
}

export function findQuizStateBySessionId(
  sessionId: string,
): QuizPersistedState | null {
  if (!sessionId) return null;
  const matches = listSavedQuizStates().filter((s) => s.sessionId === sessionId);
  if (matches.length === 0) return null;
  matches.sort((a, b) => quizStateActivityAt(b) - quizStateActivityAt(a));
  return matches[0] ?? null;
}

export type ResumableQuizLookup = {
  /** Prefer exact session from payment return / URL. */
  sessionId?: string | null;
  /**
   * When true (payment return / completed sessionId present), only resume
   * finished results/review — never fall back to landing.
   */
  requireCompleted?: boolean;
};

/**
 * Pick the quiz session to restore on /teste-qi mount.
 * Priority: URL sessionId match → newest results/review → newest in-progress.
 */
export function findResumableQuizState(
  opts: ResumableQuizLookup = {},
): QuizPersistedState | null {
  const sessionId =
    typeof opts.sessionId === "string" && opts.sessionId.trim()
      ? opts.sessionId.trim()
      : null;

  if (sessionId) {
    const byId = findQuizStateBySessionId(sessionId);
    if (byId) {
      if (
        opts.requireCompleted &&
        byId.phase !== "results" &&
        byId.phase !== "review"
      ) {
        // Payment return with sessionId but quiz not finished — still restore
        // whatever we have so we never dump the user on a blank landing.
        return byId;
      }
      return byId;
    }
    if (opts.requireCompleted) return null;
  }

  const all = listSavedQuizStates().filter(
    (s) => s.phase !== "modeSelect" && s.phase !== "onboarding",
  );
  if (all.length === 0) return null;

  const completed = all.filter(
    (s) =>
      (s.phase === "results" || s.phase === "review") && s.result != null,
  );
  const pool = opts.requireCompleted
    ? completed
    : completed.length > 0
      ? completed
      : all;
  if (pool.length === 0) return null;

  pool.sort((a, b) => quizStateActivityAt(b) - quizStateActivityAt(a));
  return pool[0] ?? null;
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
