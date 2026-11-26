import type { QuizPersistedState } from "@/src/types/quiz";
import {
  QUIZ_STORAGE_KEY,
  QUIZ_STORAGE_KEY_LEGACY,
  QUIZ_TOTAL_QUESTIONS,
} from "@/src/types/quiz";

export function loadQuizState(): QuizPersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) {
      // Ignore legacy v1 sessions — clean restart without breaking key presence
      return null;
    }
    const parsed = JSON.parse(raw) as QuizPersistedState;
    if (parsed?.version !== 2) return null;
    if (
      !Array.isArray(parsed.answers) ||
      parsed.answers.length !== QUIZ_TOTAL_QUESTIONS
    ) {
      return null;
    }
    if (!Array.isArray(parsed.optionSwitches)) {
      parsed.optionSwitches = Array(QUIZ_TOTAL_QUESTIONS).fill(0);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveQuizState(state: QuizPersistedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode — ignore
  }
}

export function clearQuizState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QUIZ_STORAGE_KEY);
    localStorage.removeItem(QUIZ_STORAGE_KEY_LEGACY);
  } catch {
    // ignore
  }
}

export function createInitialState(): QuizPersistedState {
  return {
    version: 2,
    phase: "onboarding",
    currentIndex: 0,
    answers: Array(QUIZ_TOTAL_QUESTIONS).fill(null),
    startedAt: null,
    endsAt: null,
    questionStartedAt: null,
    timeSpentMs: Array(QUIZ_TOTAL_QUESTIONS).fill(0),
    optionSwitches: Array(QUIZ_TOTAL_QUESTIONS).fill(0),
    finishedAt: null,
    result: null,
  };
}
