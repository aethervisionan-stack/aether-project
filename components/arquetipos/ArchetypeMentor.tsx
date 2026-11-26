"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ScrollText,
  Send,
  Shield,
  Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isValidPixEmv, pickClientPixEmv } from "@/lib/infinitepay/pixEmv";
import { buildMentorProfile } from "@/lib/mentor/profile";
import type { NarrativeResult } from "@/src/data/archetypes";
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
  const [history, setHistory] = useState<MentorChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
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

  function persistHistory(next: MentorChatMessage[]) {
    patchQuizSession({
      mentorHistory: next,
      mentorProfile: profile,
    });
    setHistory(next);
  }

  async function sendMessage(text: string, opts?: { retry?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const session = readQuizSession();
    const active = isMentorPassActive(session);
    setPassActive(active);
    setExpiresAt(session?.mentorExpiresAt ?? null);

    if (!active) {
      setShowPaywall(true);
      setError(null);
      return;
    }

    setError(null);
    setLastFailedText(null);
    if (!opts?.retry) setInput("");

    const baseHistory = opts?.retry
      ? history.filter(
          (m, i, arr) =>
            !(
              i === arr.length - 1 &&
              m.role === "user" &&
              m.content === trimmed
            ),
        )
      : history;

    const userMsg: MentorChatMessage = {
      role: "user",
      content: trimmed,
      at: Date.now(),
    };
    const nextHistory = [...baseHistory, userMsg];
    persistHistory(nextHistory);
    setSending(true);

    try {
      const quizAnswers =
        session?.customAnswers &&
        Object.keys(session.customAnswers).length > 0
          ? session.customAnswers
          : session?.answers ?? {};

      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          archetype: profile,
          profile,
          quizAnswers,
          mentorUnlocked: true,
          mentorExpiresAt: session?.mentorExpiresAt ?? expiresAt,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.reply) {
        const msg =
          data.code === "MISSING_API_KEY"
            ? "O Mentor está em configuração. Peça ao admin para definir GEMINI_API_KEY no servidor."
            : data.code === "QUOTA"
              ? "Cota do Gemini esgotada. Tente novamente em instantes."
              : data.code === "MENTOR_LOCKED"
                ? "Seu passe do Mentor expirou. Renove com R$ 5 ou o combo R$ 6."
                : data.error || "Não foi possível obter resposta do Mentor.";
        setError(msg);
        setLastFailedText(trimmed);
        persistHistory(baseHistory);
        if (data.code === "MENTOR_LOCKED") {
          setPassActive(false);
          setShowPaywall(true);
        }
        return;
      }

      const assistantMsg: MentorChatMessage = {
        role: "assistant",
        content: data.reply,
        at: Date.now(),
      };
      persistHistory([...nextHistory, assistantMsg]);
    } catch {
      setError("Falha de rede ao falar com o Mentor.");
      setLastFailedText(trimmed);
      persistHistory(baseHistory);
    } finally {
      setSending(false);
    }
  }

  function handleUnlockedPass() {
    const session = unlockMentorPass(profile);
    setPassActive(true);
    setExpiresAt(session.mentorExpiresAt ?? null);
    setSavedCode(session.restoreCode ?? null);
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
    : "Mentor bloqueado · R$ 5 passe ou R$ 6 combo";

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
          livres e sombra. Desbloqueie o Passe {MENTOR_PASS_DAYS} dias por
          R$&nbsp;5 ou o combo completo por R$&nbsp;6.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[color:var(--cart-dim)]">
          <Sparkles size={12} className="text-[color:var(--cart-copper)]" />
          {statusLabel}
        </p>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {!passActive ? (
          <div className="mb-4 rounded-sm border border-[color:var(--cart-copper)]/35 bg-[rgba(155,44,44,0.1)] px-4 py-4">
            <p className="text-sm leading-relaxed text-[color:var(--cart-muted)]">
              O chat do Mentor só abre com passe ativo e dentro da validade.
              Escolha R$&nbsp;1 (só Mentor) ou R$&nbsp;2 (combo diagnóstico +
              Mentor).
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowPaywall(true)}
                className="cart-cta inline-flex flex-1 items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold"
              >
                <KeyRound size={14} />
                Mentor · R$ 5
              </button>
              <button
                type="button"
                onClick={() => setShowPaywall(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 border border-[color:var(--cart-copper)]/40 px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-[color:var(--cart-copper-bright)] transition hover:bg-[rgba(155,44,44,0.12)]"
              >
                Combo · R$ 6
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={sending || !passActive}
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
              <ScrollText
                size={16}
                className="mt-0.5 shrink-0 text-[color:var(--cart-copper)]"
              />
              {passActive
                ? "Escolha um chip ou escreva sua pergunta ao Mentor."
                : "Desbloqueie o Mentor para iniciar o conselho."}
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
              <Loader2
                size={14}
                className="animate-spin text-[color:var(--cart-copper)]"
              />
              Mentor analisando seu perfil...
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-red-300/90" role="alert">
              {error}
            </p>
            {lastFailedText ? (
              <button
                type="button"
                disabled={sending || !passActive}
                onClick={() =>
                  void sendMessage(lastFailedText, { retry: true })
                }
                className="inline-flex items-center justify-center gap-1.5 border border-[color:var(--cart-border-soft)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[color:var(--cart-copper-bright)] transition hover:border-[color:var(--cart-copper)] disabled:opacity-50"
              >
                <RefreshCw size={12} />
                Tentar de novo
              </button>
            ) : null}
          </div>
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
              passActive
                ? "Pergunte ao Mentor Estratégico…"
                : "Desbloqueie o Passe para continuar…"
            }
            className="min-w-0 flex-1 border border-[color:var(--cart-border-soft)] bg-black/40 px-3 py-3 text-sm text-[color:var(--cart-ink)] outline-none placeholder:text-[color:var(--cart-dim)] focus:border-[color:var(--cart-copper)]"
            disabled={sending || !passActive}
            maxLength={1200}
          />
          <button
            type="submit"
            disabled={sending || !input.trim() || !passActive}
            className="cart-cta inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-sm font-semibold disabled:opacity-50"
            aria-label="Enviar"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : !passActive ? (
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
              Upgrade Mentor · R$ 5
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
            Código local:{" "}
            <span className="tabular text-[color:var(--cart-copper)]">
              {savedCode}
            </span>
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

const MENTOR_POLL_MS = 3000;
const MENTOR_POLL_MAX_MS = 120_000;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function MentorPassModal({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [loading, setLoading] = useState<"mentor_upgrade" | "combo" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState("R$ 5,00");
  const [orderNsu, setOrderNsu] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollAbortRef = useRef(false);
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  useEffect(() => {
    if (!orderNsu || !pixCode) return;
    pollAbortRef.current = false;
    setPollTimedOut(false);
    const started = Date.now();
    let timer: number | undefined;

    async function pollOnce() {
      if (pollAbortRef.current || !orderNsu) return;
      try {
        const res = await fetch("/api/infinitepay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_nsu: orderNsu }),
        });
        const data = (await res.json()) as { paid?: boolean };
        if (pollAbortRef.current) return;
        if (data.paid) {
          pollAbortRef.current = true;
          onUnlockedRef.current();
          return;
        }
      } catch {
        // keep polling
      }
      if (pollAbortRef.current) return;
      if (Date.now() - started >= MENTOR_POLL_MAX_MS) {
        setPollTimedOut(true);
        return;
      }
      timer = window.setTimeout(() => {
        void pollOnce();
      }, MENTOR_POLL_MS);
    }

    timer = window.setTimeout(() => {
      void pollOnce();
    }, MENTOR_POLL_MS);

    return () => {
      pollAbortRef.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderNsu, pixCode]);

  async function startCheckout(tier: "mentor_upgrade" | "combo") {
    if (loading) return;
    setLoading(tier);
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
          tier,
          sessionId,
        }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        throw new Error("Resposta inválida do servidor de pagamento");
      }
      const nsu =
        typeof data.order_nsu === "string" ? data.order_nsu : null;
      const pixRaw =
        (typeof data.pixCode === "string" && data.pixCode) ||
        pickClientPixEmv(data);
      const emv =
        pixRaw && isValidPixEmv(pixRaw) && !/^https?:\/\//i.test(pixRaw)
          ? pixRaw.trim()
          : null;
      if (!res.ok || !nsu || !emv) {
        throw new Error(
          (typeof data.error === "string" && data.error) ||
            "Não foi possível gerar o Pix (EMV).",
        );
      }
      try {
        window.sessionStorage.setItem(
          "infinitepay_pending",
          JSON.stringify({
            tier,
            order_nsu: nsu,
          }),
        );
      } catch {
        // ignore
      }
      setAmountLabel(
        typeof data.amountLabel === "string" && data.amountLabel
          ? data.amountLabel
          : tier === "combo"
            ? "R$ 6,00"
            : "R$ 5,00",
      );
      setPixCode(emv);
      setOrderNsu(nsu);
      setLoading(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      setLoading(null);
    }
  }

  async function copyPixCode(emv: string) {
    const ok = await writeClipboard(emv);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    pollAbortRef.current = true;
    onClose();
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
            {pixCode
              ? amountLabel
              : `Mentor · R$ 5 · ou combo R$ 6`}
          </h4>
          <p className="mt-2 text-center text-xs leading-relaxed text-[color:var(--cart-muted)]">
            {pixCode
              ? "Escaneie o QR ou cole o código no app do banco e aguarde a liberação automática."
              : `Sem cadastro. R$ 5 libera o Mentor por ${MENTOR_PASS_DAYS} dias; R$ 6 é o combo (diagnóstico + Mentor).`}
          </p>

          {error ? (
            <p className="mt-4 text-center text-sm text-red-300/90" role="alert">
              {error}
            </p>
          ) : null}

          {pixCode ? (
            <>
              <div className="mx-auto mt-5 flex w-fit items-center justify-center rounded-sm bg-white p-3">
                <QRCodeSVG
                  value={pixCode}
                  size={160}
                  level="M"
                  includeMargin
                />
              </div>
              <div className="mt-4 rounded-sm border border-[color:var(--cart-border-soft)] bg-black/30 p-3">
                <p className="break-all font-mono text-[11px] leading-relaxed text-[color:var(--cart-muted)]">
                  {pixCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyPixCode(pixCode)}
                className="cart-cta mt-4 inline-flex w-full items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold"
              >
                <Copy size={16} />
                {copied ? "Código copiado!" : "Copiar código Pix"}
              </button>
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[color:var(--cart-muted)]">
                {!pollTimedOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[color:var(--cart-copper)]" />
                    <span>Aguardando confirmação…</span>
                  </>
                ) : (
                  <span className="text-center text-xs text-amber-200/90">
                    Ainda não confirmamos. Se já pagou, aguarde ou feche e tente
                    de novo.
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void startCheckout("mentor_upgrade")}
                className="cart-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {loading === "mentor_upgrade" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando Pix…
                  </>
                ) : (
                  "Pagar R$ 5 — só Mentor"
                )}
              </button>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void startCheckout("combo")}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-[color:var(--cart-copper)]/40 px-5 py-3 text-sm text-[color:var(--cart-copper-bright)] transition hover:bg-[rgba(155,44,44,0.12)] disabled:opacity-50"
              >
                {loading === "combo" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando Pix…
                  </>
                ) : (
                  "Combo R$ 6 — diagnóstico + Mentor"
                )}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="mt-4 w-full py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--cart-dim)] hover:text-[color:var(--cart-copper)]"
          >
            Fechar
          </button>
        </EmberCard>
      </div>
    </div>
  );
}
