import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { buildMentorSystemPrompt } from "@/lib/mentor/profile";
import type { MentorProfileSnapshot } from "@/src/utils/quizSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type MentorBody = {
  messages?: ChatMessage[];
  /** Preferred: full mentor profile snapshot */
  profile?: MentorProfileSnapshot;
  /** Alias for profile / dominant archetype payload */
  archetype?: MentorProfileSnapshot | string;
  quizAnswers?: Record<string, string> | string[];
  mentorUnlocked?: boolean;
  mentorExpiresAt?: number | null;
  expiresAt?: number | null;
};

const MAX_HISTORY = 12;
const PLACEHOLDER_KEY = "COLE_AQUI_SUA_GEMINI_API_KEY";
const MODEL = process.env.GEMINI_MENTOR_MODEL?.trim() || "gemini-2.5-flash";

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  const k = key.trim();
  if (!k) return true;
  const upper = k.toUpperCase();
  if (upper === PLACEHOLDER_KEY) return true;
  if (upper.startsWith("COLE_AQUI")) return true;
  if (upper.includes("YOUR_") || upper.includes("REPLACE")) return true;
  return false;
}

function isProfile(v: unknown): v is MentorProfileSnapshot {
  if (!v || typeof v !== "object") return false;
  const p = v as MentorProfileSnapshot;
  return (
    typeof p.dominantTitle === "string" &&
    typeof p.subTitle === "string" &&
    typeof p.shadow === "string"
  );
}

function resolveProfile(body: MentorBody): MentorProfileSnapshot | null {
  if (isProfile(body.profile)) return body.profile;
  if (isProfile(body.archetype)) return body.archetype;
  return null;
}

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const filtered = messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );
  return filtered.slice(-MAX_HISTORY);
}

function appendQuizContext(
  system: string,
  quizAnswers: MentorBody["quizAnswers"],
): string {
  if (!quizAnswers) return system;
  if (Array.isArray(quizAnswers)) {
    const lines = quizAnswers
      .filter((a) => typeof a === "string" && a.trim())
      .map((a, i) => `${i + 1}. ${a.trim().slice(0, 280)}`);
    if (lines.length === 0) return system;
    return `${system}\n\n## Respostas do quiz (payload)\n${lines.join("\n")}`;
  }
  if (typeof quizAnswers === "object") {
    const entries = Object.entries(quizAnswers).filter(
      ([, v]) => typeof v === "string" && v.trim(),
    );
    if (entries.length === 0) return system;
    const lines = entries.map(
      ([k, v]) => `- ${k}: ${String(v).trim().slice(0, 280)}`,
    );
    return `${system}\n\n## Respostas do quiz (payload)\n${lines.join("\n")}`;
  }
  return system;
}

function isMentorAccessValid(body: MentorBody, now = Date.now()): boolean {
  const unlocked = body.mentorUnlocked === true;
  const expires =
    typeof body.mentorExpiresAt === "number"
      ? body.mentorExpiresAt
      : typeof body.expiresAt === "number"
        ? body.expiresAt
        : null;
  if (!unlocked || expires == null) return false;
  return expires > now;
}

async function callGeminiOfficial(
  system: string,
  history: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: system,
        temperature: 0.7,
        maxOutputTokens: 900,
      },
    });

    const text =
      typeof response.text === "string" ? response.text.trim() : "";
    if (text) return text;
    throw new Error("Gemini returned empty content");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (
      lower.includes("quota") ||
      lower.includes("rate") ||
      lower.includes("resource_exhausted") ||
      lower.includes("429")
    ) {
      const quotaErr = new Error(
        "Cota do Gemini esgotada ou limite de taxa. Tente novamente em instantes.",
      );
      (quotaErr as Error & { code?: string }).code = "QUOTA";
      throw quotaErr;
    }
    throw err instanceof Error ? err : new Error(message);
  }
}

export async function POST(req: Request) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (isPlaceholderKey(geminiKey)) {
      return NextResponse.json(
        {
          error:
            "Mentor IA indisponível: defina GEMINI_API_KEY no servidor (.env.local / Vercel).",
          code: "MISSING_API_KEY",
        },
        { status: 500 },
      );
    }

    const body = (await req.json()) as MentorBody;
    const history = trimHistory(body.messages ?? []);
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Envie ao menos uma mensagem.", code: "EMPTY_MESSAGES" },
        { status: 400 },
      );
    }

    if (!isMentorAccessValid(body)) {
      return NextResponse.json(
        {
          error:
            "Mentor bloqueado: ative o passe (R$ 5) ou o combo (R$ 6) para continuar.",
          code: "MENTOR_LOCKED",
        },
        { status: 403 },
      );
    }

    const profile = resolveProfile(body);
    if (!profile) {
      return NextResponse.json(
        {
          error: "Perfil de arquétipo inválido ou ausente.",
          code: "BAD_PROFILE",
        },
        { status: 400 },
      );
    }

    const system = appendQuizContext(
      buildMentorSystemPrompt(profile),
      body.quizAnswers,
    );

    const reply = await callGeminiOfficial(system, history, geminiKey!);
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mentor failed";
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "PROVIDER_ERROR";
    const status = code === "QUOTA" ? 429 : 502;
    return NextResponse.json(
      {
        error: message,
        code: code === "QUOTA" ? "QUOTA" : "PROVIDER_ERROR",
      },
      { status },
    );
  }
}
