import { NextResponse } from "next/server";
import { buildMentorSystemPrompt } from "@/lib/mentor/profile";
import type { MentorProfileSnapshot } from "@/src/utils/quizSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type MentorBody = {
  messages?: ChatMessage[];
  profile?: MentorProfileSnapshot;
};

const MAX_HISTORY = 12;

function isProfile(v: unknown): v is MentorProfileSnapshot {
  if (!v || typeof v !== "object") return false;
  const p = v as MentorProfileSnapshot;
  return (
    typeof p.dominantTitle === "string" &&
    typeof p.subTitle === "string" &&
    typeof p.shadow === "string"
  );
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

async function callGemini(
  system: string,
  history: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const preferred = process.env.GEMINI_MENTOR_MODEL?.trim();
  const models = [
    preferred,
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let lastError = "Gemini unavailable";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 900,
        },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    if (!res.ok) {
      lastError = data.error?.message || `Gemini ${model} failed (${res.status})`;
      continue;
    }
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();
    if (text) return text;
    lastError = `Gemini ${model} returned empty content`;
  }
  throw new Error(lastError);
}

async function callOpenAI(
  system: string,
  history: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 900,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI failed (${res.status})`);
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty content");
  return text;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MentorBody;
    if (!isProfile(body.profile)) {
      return NextResponse.json(
        { error: "Perfil de arquétipo inválido ou ausente.", code: "BAD_PROFILE" },
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

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (!geminiKey && !openaiKey) {
      return NextResponse.json(
        {
          error:
            "Mentor IA indisponível: configure GEMINI_API_KEY e/ou OPENAI_API_KEY no ambiente (Vercel / .env).",
          code: "MISSING_API_KEY",
          adminHint:
            "Defina GEMINI_API_KEY (gemini-2.5-flash) ou OPENAI_API_KEY (gpt-4o-mini). Sem chave a UI permanece estável.",
        },
        { status: 503 },
      );
    }

    const system = buildMentorSystemPrompt(body.profile);
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
    const message = err instanceof Error ? err.message : "Mentor failed";
    return NextResponse.json(
      { error: message, code: "PROVIDER_ERROR" },
      { status: 502 },
    );
  }
}
