const SESSION_KEY = "archetypeQuizSession_v3";
/** Migrate from previous closed-only session format */
const LEGACY_SESSION_KEY = "archetypeQuizSession_v2";

export const MENTOR_PASS_DAYS = 30;
export const MENTOR_PASS_MS = MENTOR_PASS_DAYS * 24 * 60 * 60 * 1000;

export type MentorProfileSnapshot = {
  dominantId: string;
  dominantTitle: string;
  dominantPct: number;
  subId: string;
  subTitle: string;
  secondaryPct: number;
  confluenceTitle: string;
  confluenceMode: string;
  confluenceText: string;
  tags: { tag: string; label: string; count: number }[];
  customAnswers: string[];
  shadow: string;
  strengths: string;
  weaknesses: string;
  mirror: string;
  integrationSteps: string[];
};

export type MentorChatMessage = {
  role: "user" | "assistant";
  content: string;
  at: number;
};

export type QuizSessionPayload = {
  answers: Record<string, string>;
  /** Free-text answers keyed by question id (5th option) */
  customAnswers: Record<string, string>;
  completed: boolean;
  updatedAt: number;
  /** Mentor Estratégico — Passe 30 dias */
  mentorUnlockedAt?: number | null;
  mentorExpiresAt?: number | null;
  mentorProfile?: MentorProfileSnapshot | null;
  mentorFreeUsed?: boolean;
  mentorHistory?: MentorChatMessage[];
  /** Opaque restore code for "Salvar / Reabrir meu acesso" */
  restoreCode?: string | null;
};

export type MentorRestoreBundle = {
  v: 1;
  mentorUnlockedAt: number;
  mentorExpiresAt: number;
  mentorProfile: MentorProfileSnapshot | null;
  answers?: Record<string, string>;
  customAnswers?: Record<string, string>;
  completed?: boolean;
  restoreCode: string;
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
      mentorUnlockedAt:
        typeof parsed.mentorUnlockedAt === "number"
          ? parsed.mentorUnlockedAt
          : null,
      mentorExpiresAt:
        typeof parsed.mentorExpiresAt === "number"
          ? parsed.mentorExpiresAt
          : null,
      mentorProfile: parsed.mentorProfile ?? null,
      mentorFreeUsed: Boolean(parsed.mentorFreeUsed),
      mentorHistory: Array.isArray(parsed.mentorHistory)
        ? parsed.mentorHistory.filter(
            (m): m is MentorChatMessage =>
              !!m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string",
          )
        : [],
      restoreCode:
        typeof parsed.restoreCode === "string" ? parsed.restoreCode : null,
    };
  } catch {
    return null;
  }
}

function toStored(payload: QuizSessionPayload): QuizSessionPayload {
  return {
    answers: payload.answers,
    customAnswers: payload.customAnswers ?? {},
    completed: payload.completed,
    updatedAt: payload.updatedAt || Date.now(),
    mentorUnlockedAt: payload.mentorUnlockedAt ?? null,
    mentorExpiresAt: payload.mentorExpiresAt ?? null,
    mentorProfile: payload.mentorProfile ?? null,
    mentorFreeUsed: Boolean(payload.mentorFreeUsed),
    mentorHistory: payload.mentorHistory ?? [],
    restoreCode: payload.restoreCode ?? null,
  };
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
      JSON.stringify(toStored(payload)),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function patchQuizSession(
  patch: Partial<QuizSessionPayload>,
): QuizSessionPayload | null {
  const current = readQuizSession() ?? {
    answers: {},
    customAnswers: {},
    completed: false,
    updatedAt: Date.now(),
  };
  const next: QuizSessionPayload = {
    ...current,
    ...patch,
    answers: patch.answers ?? current.answers,
    customAnswers: patch.customAnswers ?? current.customAnswers,
    updatedAt: Date.now(),
  };
  writeQuizSession(next);
  return next;
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

/** Clear quiz answers but keep Mentor Passe / histórico / restore. */
export function clearQuizAnswersKeepMentor(): void {
  const current = readQuizSession();
  if (!current) {
    clearQuizSession();
    return;
  }
  writeQuizSession({
    answers: {},
    customAnswers: {},
    completed: false,
    updatedAt: Date.now(),
    mentorUnlockedAt: current.mentorUnlockedAt,
    mentorExpiresAt: current.mentorExpiresAt,
    mentorProfile: current.mentorProfile,
    mentorFreeUsed: current.mentorFreeUsed,
    mentorHistory: current.mentorHistory,
    restoreCode: current.restoreCode,
  });
}

export function isMentorPassActive(
  session: QuizSessionPayload | null | undefined,
  now = Date.now(),
): boolean {
  if (!session?.mentorExpiresAt || !session.mentorUnlockedAt) return false;
  return session.mentorExpiresAt > now;
}

export function generateRestoreCode(): string {
  const part = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return `ARQ-${part()}-${part()}-${part()}`;
}

function toBase64Url(json: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bin = unescape(encodeURIComponent(json));
    return window
      .btoa(bin)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const full = b64 + pad;
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return decodeURIComponent(escape(window.atob(full)));
  }
  return Buffer.from(full, "base64").toString("utf8");
}

/** Compact restore token (code + expiry + profile + optional answers). */
export function encodeMentorRestoreBundle(
  session: QuizSessionPayload,
): string | null {
  if (!session.mentorUnlockedAt || !session.mentorExpiresAt) return null;
  const code = session.restoreCode || generateRestoreCode();
  const bundle: MentorRestoreBundle = {
    v: 1,
    mentorUnlockedAt: session.mentorUnlockedAt,
    mentorExpiresAt: session.mentorExpiresAt,
    mentorProfile: session.mentorProfile ?? null,
    answers: session.answers,
    customAnswers: session.customAnswers,
    completed: session.completed,
    restoreCode: code,
  };
  return toBase64Url(JSON.stringify(bundle));
}

export function decodeMentorRestoreBundle(
  token: string,
): MentorRestoreBundle | null {
  try {
    const trimmed = token.trim();
    if (!trimmed) return null;
    const json = fromBase64Url(trimmed);
    const parsed = JSON.parse(json) as Partial<MentorRestoreBundle>;
    if (
      parsed.v !== 1 ||
      typeof parsed.mentorUnlockedAt !== "number" ||
      typeof parsed.mentorExpiresAt !== "number" ||
      typeof parsed.restoreCode !== "string"
    ) {
      return null;
    }
    return {
      v: 1,
      mentorUnlockedAt: parsed.mentorUnlockedAt,
      mentorExpiresAt: parsed.mentorExpiresAt,
      mentorProfile: parsed.mentorProfile ?? null,
      answers: parsed.answers,
      customAnswers: parsed.customAnswers,
      completed: parsed.completed,
      restoreCode: parsed.restoreCode,
    };
  } catch {
    return null;
  }
}

export function applyMentorRestore(
  token: string,
): { ok: true; session: QuizSessionPayload } | { ok: false; error: string } {
  const bundle = decodeMentorRestoreBundle(token);
  if (!bundle) {
    return { ok: false, error: "Código inválido ou corrompido." };
  }
  if (bundle.mentorExpiresAt <= Date.now()) {
    return { ok: false, error: "Este Passe do Mentor já expirou." };
  }
  const current = readQuizSession();
  const next: QuizSessionPayload = {
    answers: bundle.answers ?? current?.answers ?? {},
    customAnswers: bundle.customAnswers ?? current?.customAnswers ?? {},
    completed:
      bundle.completed ??
      current?.completed ??
      Boolean(bundle.answers && Object.keys(bundle.answers).length > 0),
    updatedAt: Date.now(),
    mentorUnlockedAt: bundle.mentorUnlockedAt,
    mentorExpiresAt: bundle.mentorExpiresAt,
    mentorProfile: bundle.mentorProfile,
    mentorFreeUsed: true,
    mentorHistory: current?.mentorHistory ?? [],
    restoreCode: bundle.restoreCode,
  };
  writeQuizSession(next);
  return { ok: true, session: next };
}

export function unlockMentorPass(
  profile: MentorProfileSnapshot,
  now = Date.now(),
): QuizSessionPayload {
  const current = readQuizSession() ?? {
    answers: {},
    customAnswers: {},
    completed: true,
    updatedAt: now,
  };
  const code = current.restoreCode || generateRestoreCode();
  const next: QuizSessionPayload = {
    ...current,
    completed: true,
    updatedAt: now,
    mentorUnlockedAt: now,
    mentorExpiresAt: now + MENTOR_PASS_MS,
    mentorProfile: profile,
    mentorFreeUsed: true,
    restoreCode: code,
  };
  writeQuizSession(next);
  return next;
}
