import type { QuizPersistedState } from "@/src/types/quiz";
import { QUIZ_STORAGE_KEY } from "@/src/types/quiz";

export function loadQuizState(): QuizPersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizPersistedState;
    if (parsed?.version !== 1) return null;
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
  } catch {
    // ignore
  }
}

export function createInitialState(): QuizPersistedState {
  return {
    version: 1,
    phase: "onboarding",
    currentIndex: 0,
    answers: Array(25).fill(null),
    startedAt: null,
    endsAt: null,
    questionStartedAt: null,
    timeSpentMs: Array(25).fill(0),
    finishedAt: null,
    result: null,
  };
}
