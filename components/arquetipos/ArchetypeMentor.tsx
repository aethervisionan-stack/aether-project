"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  ScrollText,
  Send,
  Shield,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NarrativeResult } from "@/src/data/archetypes";
import { buildMentorProfile } from "@/lib/mentor/profile";
import {
  applyMentorRestore,
  encodeMentorRestoreBundle,
  isMentorPassActive,
  MENTOR_PASS_DAYS,
  patchQuizSession,
  readQuizSession,
  unlockMentorPass,
  type MentorChatMessage,
} from "@/src/utils/quizSession";
import { EmberCard } from "./EmberCard";

type Props = {
  result: NarrativeResult;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const CHIPS = [
  "Como usar meu arquétipo no trabalho?",
  "Onde minha sombra me sabota?",
  "Como equilibrar dominante e sub?",
  "Monte um plano de 7 dias para mim",
] as const;

function formatExpiry(ts: number) {
  try {
    return new Date(ts).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function ArchetypeMentor({ result }: Props) {
  const reduce = useReducedMotion();
  const profile = useMemo(() => buildMentorProfile(result), [result]);
  const [mounted, setMounted] = useState(false);
  const [passActive, setPassActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [freeUsed, setFreeUsed] = useState(false);
  const [history, setHistory] = useState<MentorChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const hydrate = useCallback(() => {
    const session = readQuizSession();
    const active = isMentorPassActive(session);
    setPassActive(active);
    setExpiresAt(session?.mentorExpiresAt ?? null);
    setFreeUsed(Boolean(session?.mentorFreeUsed));
    setHistory(session?.mentorHistory ?? []);
    setSavedCode(session?.restoreCode ?? null);
    if (session && !session.mentorProfile) {
      patchQuizSession({ mentorProfile: profile });
    }
  }, [profile]);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [history, sending]);

  function persistHistory(next: MentorChatMessage[], free: boolean) {
    patchQuizSession({
      mentorHistory: next,
      mentorFreeUsed: free,
      mentorProfile: profile,
    });
    setHistory(next);
    setFreeUsed(free);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const needsPass = freeUsed && !passActive;
    if (needsPass) {
      setShowPaywall(true);
      return;
    }

    setError(null);
    setInput("");
    const userMsg: MentorChatMessage = {
      role: "user",
      content: trimmed,
      at: Date.now(),
    };
    const nextHistory = [...history, userMsg];
    const nextFree = true;
    persistHistory(nextHistory, nextFree);
    setSending(true);

    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          profile,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        code?: string;
        adminHint?: string;
      };

      if (!res.ok || !data.reply) {
        const msg =
          data.code === "MISSING_API_KEY"
            ? "O Mentor está em configuração. Peça ao admin para definir GEMINI_API_KEY ou OPENAI_API_KEY."
            : data.error || "Não foi possível obter resposta do Mentor.";
        setError(msg);
        // roll back user message on hard failure so free credit isn't burned silently
        if (!freeUsed) {
          persistHistory(history, false);
        } else {
          persistHistory(history, true);
        }
        return;
      }

      const assistantMsg: MentorChatMessage = {
        role: "assistant",
        content: data.reply,
        at: Date.now(),
      };
      persistHistory([...nextHistory, assistantMsg], nextFree);

      if (!passActive && nextFree) {
        // after first successful free reply, next send opens paywall
      }
    } catch {
      setError("Falha de rede ao falar com o Mentor.");
      if (!freeUsed) persistHistory(history, false);
    } finally {
      setSending(false);
    }
  }

  function handleUnlockedPass() {
    const session = unlockMentorPass(profile);
    setPassActive(true);
    setExpiresAt(session.mentorExpiresAt ?? null);
    setSavedCode(session.restoreCode ?? null);
    setFreeUsed(true);
    setShowPaywall(false);
    setError(null);
  }

  function handleSaveAccess() {
    const session = readQuizSession();
    if (!session || !isMentorPassActive(session)) {
      setRestoreMsg("Ative o Passe 30 dias para gerar o código de restauração.");
      setShowRestore(true);
      return;
    }
    const token = encodeMentorRestoreBundle(session);
    if (!token) {
      setRestoreMsg("Não foi possível gerar o código.");
      setShowRestore(true);
      return;
    }
    setRestoreInput(token);
    setSavedCode(session.restoreCode ?? null);
    setShowRestore(true);
    setRestoreMsg(
      `Código curto: ${session.restoreCode}. Guarde o token completo abaixo ou o link para reabrir neste aparelho.`,
    );
  }

  async function copyRestoreToken() {
    try {
      await navigator.clipboard.writeText(restoreInput.trim());
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(false);
    }
  }

  function handleApplyRestore() {
    const resultRestore = applyMentorRestore(restoreInput);
    if (!resultRestore.ok) {
      setRestoreMsg(resultRestore.error);
      return;
    }
    hydrate();
    setRestoreMsg(
      `Acesso restaurado até ${formatExpiry(resultRestore.session.mentorExpiresAt!)}.`,
    );
  }

  if (!mounted) return null;

  const statusLabel = passActive
    ? `Passe ativo · até ${formatExpiry(expiresAt ?? 0)}`
    : freeUsed
      ? "1 consulta usada · upgrade Mentor R$ 5,90"
      : "1 consulta gratuita disponível";

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.36 }}
      className="cart-card mt-10 overflow-hidden rounded-sm"
      aria-label="Mentor Estratégico de Arquétipos"
    >
      <div className="border-b border-[color:var(--cart-border-soft)] bg-gradient-to-br from-[rgba(155,44,44,0.12)] via-transparent to-[rgba(201,137,74,0.08)] px-5 py-5 sm:px-6">
        <p className="cart-display text-[11px] uppercase tracking-[0.28em] text-[color:var(--cart-copper)]">
          Mentor Estratégico
        </p>
        <h3 className="cart-display mt-2 text-xl tracking-wide text-[color:var(--cart-ink)] sm:text-2xl">
          Conselho por IA · {profile.dominantTitle}
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[color:var(--cart-muted)]">
          Orientações personalizadas com seu dominante, sub, tags, respostas
          livres e sombra. Uma consulta grátis; depois, upgrade do Passe{" "}
          {MENTOR_PASS_DAYS} dias por R$&nbsp;5,90 via Pix (diferença do combo).
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[color:var(--cart-dim)]">
          <Sparkles size={12} className="text-[color:var(--cart-copper)]" />
          {statusLabel}
        </p>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={sending}
              onClick={() => void sendMessage(chip)}
              className="border border-[color:var(--cart-border-soft)] bg-black/25 px-3 py-1.5 text-left text-[11px] leading-snug text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)] disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>

        <div
          ref={listRef}
          className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-sm border border-[color:var(--cart-border-soft)] bg-black/30 p-3 sm:max-h-80"
        >
          {history.length === 0 ? (
            <p className="flex items-start gap-2 px-1 py-6 text-center text-sm text-[color:var(--cart-dim)] sm:justify-center">
              <ScrollText size={16} className="mt-0.5 shrink-0 text-[color:var(--cart-copper)]" />
              Escolha um chip ou escreva sua pergunta ao Mentor.
            </p>
          ) : (
            history.map((m, i) => (
              <div
                key={`${m.at}-${i}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-sm px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "border border-[color:var(--cart-copper)]/35 bg-[rgba(155,44,44,0.22)] text-[color:var(--cart-ink)]"
                      : "border border-[color:var(--cart-border-soft)] bg-[rgba(16,18,24,0.85)] text-[color:var(--cart-muted)]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-xs text-[color:var(--cart-dim)]">
              <Loader2 size={14} className="animate-spin text-[color:var(--cart-copper)]" />
              O Mentor consulta o dossiê…
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-300/90" role="alert">
            {error}
          </p>
        ) : null}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              freeUsed && !passActive
                ? "Desbloqueie o Passe para continuar…"
                : "Pergunte ao Mentor Estratégico…"
            }
            className="min-w-0 flex-1 border border-[color:var(--cart-border-soft)] bg-black/40 px-3 py-3 text-sm text-[color:var(--cart-ink)] outline-none placeholder:text-[color:var(--cart-dim)] focus:border-[color:var(--cart-copper)]"
            disabled={sending}
            maxLength={1200}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="cart-cta inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-sm font-semibold disabled:opacity-50"
            aria-label="Enviar"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : freeUsed && !passActive ? (
              <Lock size={16} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {!passActive ? (
            <button
              type="button"
              onClick={() => setShowPaywall(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-copper)]/40 px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-[color:var(--cart-copper-bright)] transition hover:bg-[rgba(155,44,44,0.12)]"
            >
              <KeyRound size={14} />
              Upgrade Mentor · R$ 5,90
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSaveAccess}
            className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-border-soft)] px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)]"
          >
            <Shield size={14} />
            Salvar / Reabrir meu acesso
          </button>
        </div>
        {savedCode && passActive ? (
          <p className="mt-2 text-center text-[11px] text-[color:var(--cart-dim)]">
            Código local: <span className="tabular text-[color:var(--cart-copper)]">{savedCode}</span>
          </p>
        ) : null}
      </div>

      {showPaywall ? (
        <MentorPassModal
          onClose={() => setShowPaywall(false)}
          onUnlocked={handleUnlockedPass}
        />
      ) : null}

      {showRestore ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className="cart-card w-full max-w-lg rounded-sm p-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-label="Salvar ou reabrir acesso"
          >
            <p className="cart-display text-[11px] uppercase tracking-[0.24em] text-[color:var(--cart-copper)]">
              Restauração do Passe
            </p>
            <p className="mt-2 text-sm text-[color:var(--cart-muted)]">
              Cole o token completo gerado neste aparelho (ou o link) para
              reabrir o Mentor sem novo Pix, enquanto o Passe estiver válido.
            </p>
            {restoreMsg ? (
              <p className="mt-3 text-xs leading-relaxed text-[color:var(--cart-copper-bright)]">
                {restoreMsg}
              </p>
            ) : null}
            <textarea
              value={restoreInput}
              onChange={(e) => setRestoreInput(e.target.value)}
              rows={5}
              className="mt-4 w-full resize-y border border-[color:var(--cart-border-soft)] bg-black/40 px-3 py-2 font-mono text-[11px] text-[color:var(--cart-ink)] outline-none focus:border-[color:var(--cart-copper)]"
              placeholder="Cole o token de restauração…"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void copyRestoreToken()}
                className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-border-soft)] px-4 py-2.5 text-sm text-[color:var(--cart-muted)]"
              >
                {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                {copiedCode ? "Copiado" : "Copiar token"}
              </button>
              <button
                type="button"
                onClick={handleApplyRestore}
                className="cart-cta flex-1 rounded-sm px-4 py-2.5 text-sm font-semibold"
              >
                Reabrir acesso
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowRestore(false)}
              className="mt-3 w-full py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--cart-dim)] hover:text-[color:var(--cart-copper)]"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}

function MentorPassModal({
  onClose,
}: {
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      let sessionId = "mentor";
      try {
        sessionId =
          window.localStorage.getItem("arq_client_sid") ||
          `s_${Date.now().toString(36)}`;
      } catch {
        // ignore
      }
      const res = await fetch("/api/infinitepay/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "mentor_upgrade",
          sessionId,
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        order_nsu?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Não foi possível abrir o checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <div
        className="w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-label="Upgrade Mentor 30 dias"
      >
        <EmberCard className="p-5 sm:p-6">
          <p className="cart-display text-center text-[10px] uppercase tracking-[0.28em] text-[color:var(--cart-copper)]">
            Consultoria IA
          </p>
          <h4 className="cart-display mt-2 text-center text-xl text-[color:var(--cart-ink)]">
            {MENTOR_PASS_DAYS} dias ilimitados · R$ 5,00
          </h4>
          <p className="mt-2 text-center text-xs leading-relaxed text-[color:var(--cart-muted)]">
            Após o checkout InfinitePay, o Mentor responde sem limite por{" "}
            {MENTOR_PASS_DAYS} dias — com código de restauração neste aparelho.
          </p>

          {error ? (
            <p className="mt-4 text-center text-sm text-red-300/90">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={loading}
            onClick={() => void startCheckout()}
            className="cart-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Abrindo checkout…
              </>
            ) : (
              "Pagar R$ 5,00"
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--cart-dim)] hover:text-[color:var(--cart-copper)]"
          >
            Fechar
          </button>
        </EmberCard>
      </div>
    </div>
  );
}
