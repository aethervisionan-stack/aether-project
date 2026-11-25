const SESSION_KEY = "archetypeQuizSession_v2";

export type QuizSessionPayload = {
  answers: Record<string, string>;
  completed: boolean;
  updatedAt: number;
};

export function readQuizSession(): QuizSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizSessionPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.answers) return null;
    return {
      answers: parsed.answers ?? {},
      completed: Boolean(parsed.completed),
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeQuizSession(payload: QuizSessionPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        answers: payload.answers,
        completed: payload.completed,
        updatedAt: payload.updatedAt || Date.now(),
      } satisfies QuizSessionPayload),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearQuizSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
