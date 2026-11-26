"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PROFILE_ASSISTANT_DISCLAIMER,
  PROFILE_ASSISTANT_SUGGESTIONS,
  normalizeAssistantContext,
  type ProfileAssistantContext,
  type ProfileChatMessage,
} from "@/src/lib/iqProfileAssistant";
import type { IqResult } from "@/src/types/quiz";

type Props = {
  result: IqResult;
  participantName: string;
  rank: number | null;
  rankTotal: number;
};

type UiMessage = ProfileChatMessage & { at: number; source?: string };

const WELCOME =
  "Pergunte o que quiser sobre este resultado — forças, o que treinar, QI, percentil ou ranking. Eu respondo em português, com base só nos dados desta sessão.";

export function ProfileDoubtAssistant({
  result,
  participantName,
  rank,
  rankTotal,
}: Props) {
  const ctx = useMemo<ProfileAssistantContext | null>(
    () =>
      normalizeAssistantContext({
        result,
        participantName,
        rank,
        rankTotal,
      }),
    [result, participantName, rank, rankTotal],
  );

  const [messages, setMessages] = useState<UiMessage[]>([
    {
      role: "assistant",
      content: WELCOME,
      at: Date.now(),
      source: "local",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || !ctx) return;

    setError(null);
    setInput("");
    const userMsg: UiMessage = {
      role: "user",
      content: trimmed,
      at: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setSending(true);

    const apiMessages: ProfileChatMessage[] = nextHistory
      .filter((m) => m.content !== WELCOME)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/iq-profile-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          context: ctx,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        provider?: string;
        error?: string;
        code?: string;
      };

      if (res.ok && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply!,
            at: Date.now(),
            source: data.provider || "api",
          },
        ]);
        if (data.provider === "local") {
          const soft =
            data.code === "RATE_LIMIT"
              ? "Limite temporário da IA — resposta curta de contingência."
              : data.code === "PROVIDER_TIMEOUT"
                ? "A IA demorou demais — resposta curta de contingência."
                : "Resposta de contingência — a IA conversacional não respondeu.";
          setError(soft);
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Não consegui falar com a IA agora. Tente de novo em instantes — seu perfil continua no painel acima.",
          at: Date.now(),
          source: "local",
        },
      ]);
      if (data.error) {
        setError(
          data.code === "RATE_LIMIT"
            ? "Limite de requisições — tente em alguns segundos."
            : "Assistente temporariamente indisponível.",
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sem rede no momento. Assim que a conexão voltar, pergunte de novo — eu uso Gemini com o IqResult completo desta sessão.",
          at: Date.now(),
          source: "local",
        },
      ]);
      setError("Sem rede — tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (!ctx) {
    return (
      <section
        aria-labelledby="profile-doubt-heading"
        className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5"
      >
        <h2
          id="profile-doubt-heading"
          className="text-sm font-semibold text-zinc-100"
        >
          Dúvidas sobre o perfil
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Resultado incompleto nesta sessão — o chat fica disponível quando o
          IqResult estiver completo.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="profile-doubt-heading"
      className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id="profile-doubt-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            Dúvidas sobre o perfil
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Chat com Gemini grounded no seu IqResult e no histórico desta
            conversa.
          </p>
        </div>
      </div>

      <p
        role="note"
        className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs leading-relaxed text-amber-100/90"
      >
        {PROFILE_ASSISTANT_DISCLAIMER}
      </p>

      <div
        ref={listRef}
        className="mt-4 max-h-72 space-y-2.5 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3"
        aria-live="polite"
      >
        {messages.map((m, i) => (
          <div
            key={`${m.at}-${i}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-cyan-500/15 text-cyan-50"
                  : "bg-zinc-800/70 text-zinc-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending ? (
          <p className="text-xs text-zinc-500">Pensando no seu perfil…</p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PROFILE_ASSISTANT_SUGGESTIONS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={sending}
            onClick={() => void send(chip)}
            className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label className="sr-only" htmlFor="profile-doubt-input">
          Pergunta sobre o perfil cognitivo
        </label>
        <input
          id="profile-doubt-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          placeholder="Ex.: como posso melhorar na próxima vez?"
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-xl bg-cyan-500/90 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enviar
        </button>
      </form>

      {error ? (
        <p className="mt-2 text-xs text-zinc-500" role="status">
          {error}
        </p>
      ) : null}
    </section>
  );
}
