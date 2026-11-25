const SESSION_KEY = "archetypeQuizSession_v3";
/** Migrate from previous closed-only session format */
const LEGACY_SESSION_KEY = "archetypeQuizSession_v2";

export type QuizSessionPayload = {
  answers: Record<string, string>;
  /** Free-text answers keyed by question id (5th option) */
  customAnswers: Record<string, string>;
  completed: boolean;
  updatedAt: number;
};

function parsePayload(raw: string): QuizSessionPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<QuizSessionPayload>;
    if (!parsed || typeof parsed !== "object" || !parsed.answers) return null;
    return {
      answers: parsed.answers ?? {},
      customAnswers:
        parsed.customAnswers && typeof parsed.customAnswers === "object"
          ? parsed.customAnswers
          : {},
      completed: Boolean(parsed.completed),
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function readQuizSession(): QuizSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(SESSION_KEY) ??
      window.localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const payload = parsePayload(raw);
    if (!payload) return null;
    // Promote legacy v2 → v3 so custom answers persist going forward
    if (!window.localStorage.getItem(SESSION_KEY)) {
      writeQuizSession(payload);
    }
    return payload;
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
        customAnswers: payload.customAnswers ?? {},
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
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // ignore
  }
}
