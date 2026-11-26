import { NextResponse } from "next/server";
import {
  answerProfileDoubtLocally,
  buildProfileAssistantSystemPrompt,
  normalizeAssistantContext,
  type ProfileAssistantContext,
  type ProfileChatMessage,
} from "@/src/lib/iqProfileAssistant";
import { isIqSessionUnlocked } from "@/lib/iq-payment/sessionUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  messages?: ProfileChatMessage[];
  context?: ProfileAssistantContext;
  sessionId?: unknown;
};

/** Keep enough turns for fluent follow-ups while staying grounded. */
const MAX_HISTORY = 16;
/** Hard ceiling so hung providers never block the UI forever. */
const PROVIDER_TIMEOUT_MS = 12_000;

function isContext(v: unknown): v is ProfileAssistantContext {
  if (!v || typeof v !== "object") return false;
  const c = v as ProfileAssistantContext;
  return (
    typeof c.participantName === "string" &&
    typeof c.rankTotal === "number" &&
    (c.rank === null || typeof c.rank === "number") &&
    c.result != null &&
    typeof c.result === "object" &&
    typeof (c.result as { iq?: unknown }).iq === "number"
  );
}

function trimHistory(messages: ProfileChatMessage[]): ProfileChatMessage[] {
  const filtered = messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );
  return filtered.slice(-MAX_HISTORY);
}

class ProviderHttpError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderHttpError(
        "Tempo esgotado ao consultar o modelo.",
        504,
        "PROVIDER_TIMEOUT",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function classifyHttpFailure(status: number, message: string): ProviderHttpError {
  if (status === 429) {
    return new ProviderHttpError(
      message || "Limite de requisições atingido. Tente em instantes.",
      429,
      "RATE_LIMIT",
    );
  }
  if (status === 401 || status === 403) {
    return new ProviderHttpError(
      message || "Chave de API rejeitada pelo provedor.",
      status,
      "AUTH_ERROR",
    );
  }
  return new ProviderHttpError(
    message || `Provider failed (${status})`,
    status,
    "PROVIDER_HTTP",
  );
}

async function callGemini(
  system: string,
  history: ProfileChatMessage[],
  apiKey: string,
): Promise<string> {
  const preferred = process.env.GEMINI_MENTOR_MODEL?.trim();
  // Prefer currently available Flash IDs (2.x retired for many new keys).
  const models = [
    preferred,
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let lastError: Error = new Error("Gemini unavailable");
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature: 0.65,
              maxOutputTokens: 900,
            },
          }),
        },
        PROVIDER_TIMEOUT_MS,
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      if (!res.ok) {
        const classified = classifyHttpFailure(
          res.status,
          data.error?.message || `Gemini ${model} failed (${res.status})`,
        );
        // Rate-limit / auth: don't burn remaining models on the same key
        if (classified.code === "RATE_LIMIT" || classified.code === "AUTH_ERROR") {
          throw classified;
        }
        lastError = classified;
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim();
      if (text) return text;
      lastError = new Error(`Gemini ${model} returned empty content`);
    } catch (err) {
      if (err instanceof ProviderHttpError) {
        if (err.code === "RATE_LIMIT" || err.code === "AUTH_ERROR" || err.code === "PROVIDER_TIMEOUT") {
          throw err;
        }
        lastError = err;
        continue;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError;
}

async function callOpenAI(
  system: string,
  history: ProfileChatMessage[],
  apiKey: string,
): Promise<string> {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.65,
        max_tokens: 900,
        messages: [{ role: "system", content: system }, ...history],
      }),
    },
    PROVIDER_TIMEOUT_MS,
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw classifyHttpFailure(
      res.status,
      data.error?.message || `OpenAI failed (${res.status})`,
    );
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty content");
  return text;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId || !(await isIqSessionUnlocked(sessionId))) {
      return NextResponse.json(
        {
          error:
            "Sessão bloqueada. Confirme o pagamento InfinitePay (R$1) para usar o assistente Gemini com o IqResult.",
          code: "LOCKED",
        },
        { status: 402 },
      );
    }

    if (!isContext(body.context)) {
      return NextResponse.json(
        {
          error: "Contexto de perfil inválido ou ausente.",
          code: "BAD_CONTEXT",
        },
        { status: 400 },
      );
    }

    const ctx = normalizeAssistantContext(body.context);
    if (!ctx) {
      return NextResponse.json(
        {
          error: "IqResult esparso demais para o assistente.",
          code: "SPARSE_RESULT",
        },
        { status: 400 },
      );
    }

    const history = trimHistory(body.messages ?? []);
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Envie ao menos uma mensagem.", code: "EMPTY_MESSAGES" },
        { status: 400 },
      );
    }

    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const localFallback = answerProfileDoubtLocally(
      lastUser?.content ?? "",
      ctx,
    );

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    // Keys stay server-side only. Short fallback when missing.
    if (!geminiKey && !openaiKey) {
      return NextResponse.json({
        reply: localFallback,
        provider: "local" as const,
        code: "MISSING_API_KEY",
      });
    }

    try {
      const system = buildProfileAssistantSystemPrompt(ctx);
      let reply: string;
      let provider: "gemini" | "openai";

      if (geminiKey) {
        try {
          reply = await callGemini(system, history, geminiKey);
          provider = "gemini";
        } catch (geminiErr) {
          if (!openaiKey) throw geminiErr;
          reply = await callOpenAI(system, history, openaiKey);
          provider = "openai";
        }
      } else {
        reply = await callOpenAI(system, history, openaiKey!);
        provider = "openai";
      }

      return NextResponse.json({ reply, provider });
    } catch (err) {
      const code =
        err instanceof ProviderHttpError ? err.code : "PROVIDER_FALLBACK";
      // Short contingency only on real API failure — never dump anomaly lists.
      return NextResponse.json({
        reply: localFallback,
        provider: "local" as const,
        code,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assistant failed";
    return NextResponse.json(
      { error: message, code: "PROVIDER_ERROR" },
      { status: 502 },
    );
  }
}
