"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { buildDiagnosis } from "@/src/data/diagnosis";
import type { NarrativeResult } from "@/src/data/archetypes";
import {
  isResultUnlocked,
  readQuizSession,
  type InfinitePayTier,
} from "@/src/utils/quizSession";
import { SanctuaryBackdrop } from "./CinematicChrome";

type Props = {
  result: NarrativeResult;
  onUnlocked: (tier: InfinitePayTier) => void;
  /** When verifying return from InfinitePay */
  verifying?: boolean;
  verifyError?: string | null;
  onRetryVerify?: () => void;
  onBackFromVerify?: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

type BoxId = "result" | "mentor_upgrade";

const BOXES: {
  id: BoxId;
  title: string;
  priceLabel: string;
  priceCentavos: number;
  badge?: string;
  accent?: boolean;
  persuasive: string;
  bullets: string[];
}[] = [
  {
    id: "result",
    title: "Diagnóstico Completo",
    priceLabel: "R$ 1,00",
    priceCentavos: 100,
    persuasive:
      "Você já respondeu. Agora veja o espelho completo: luz, sombra, gatilhos e os 3 passos de integração — sem deixar o dossiê pela metade.",
    bullets: [
      "Dossiê completo (luz, sombra, integração)",
      "Confluência dominante × subarquétipo",
      "1 mensagem grátis no Mentor",
    ],
  },
  {
    id: "mentor_upgrade",
    title: "Consultoria IA · 30 dias",
    priceLabel: "R$ 5,00",
    priceCentavos: 500,
    badge: "Mentor",
    accent: true,
    persuasive:
      "Conversa ilimitada com o Mentor Estratégico por 30 dias — perguntas práticas, plano de ação e código para reabrir o acesso neste aparelho.",
    bullets: [
      "Mentor Estratégico ilimitado 30 dias",
      "Código Salvar / Reabrir meu acesso",
      "Perfil do diagnóstico embutido nas respostas",
    ],
  },
];

function sessionClientId(): string {
  try {
    const existing = window.localStorage.getItem("arq_client_sid");
    if (existing) return existing;
    const id = `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem("arq_client_sid", id);
    return id;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
}

export function PaywallScreen({
  result,
  onUnlocked: _onUnlocked,
  verifying = false,
  verifyError = null,
  onRetryVerify,
  onBackFromVerify,
}: Props) {
  void _onUnlocked;
  const reduce = useReducedMotion();
  const diagnosis = useMemo(() => buildDiagnosis(result), [result]);
  const alreadyResult = isResultUnlocked(readQuizSession());

  const [selResult, setSelResult] = useState(!alreadyResult);
  const [selMentor, setSelMentor] = useState(alreadyResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCentavos =
    (selResult && !alreadyResult ? 100 : 0) + (selMentor ? 500 : 0);

  const tier: InfinitePayTier | null = (() => {
    const wantResult = selResult && !alreadyResult;
    if (wantResult && selMentor) return "combo";
    if (wantResult) return "result";
    if (selMentor) return "mentor_upgrade";
    return null;
  })();

  const totalLabel =
    totalCentavos > 0
      ? (totalCentavos / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : null;

  function toggleBox(id: BoxId) {
    if (id === "result") {
      if (alreadyResult) return;
      setSelResult((v) => !v);
      return;
    }
    setSelMentor((v) => !v);
  }

  async function checkout() {
    if (!tier || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/infinitepay/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          sessionId: sessionClientId(),
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
      try {
        window.sessionStorage.setItem(
          "infinitepay_pending",
          JSON.stringify({ tier, order_nsu: data.order_nsu ?? null }),
        );
      } catch {
        // ignore
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <section className="cine-sanctuary-band relative mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-16 pt-12">
        <SanctuaryBackdrop opacity={0.28} />
        <div className="relative z-10 flex flex-col items-center py-20 text-center">
          {verifyError ? (
            <>
              <p className="cart-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]">
                Pagamento
              </p>
              <h1 className="cart-display mt-4 text-2xl text-[color:var(--cine-ink)]">
                Não confirmamos ainda
              </h1>
              <p className="mt-3 max-w-sm text-sm text-red-300/90">{verifyError}</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {onRetryVerify ? (
                  <button
                    type="button"
                    className="cart-cta rounded-sm px-5 py-3 text-sm font-semibold"
                    onClick={onRetryVerify}
                  >
                    Tentar de novo
                  </button>
                ) : null}
                {onBackFromVerify ? (
                  <button
                    type="button"
                    className="rounded-sm border border-[color:var(--cart-border-soft)] px-5 py-3 text-sm text-[color:var(--cart-muted)] hover:border-[color:var(--cart-copper)]"
                    onClick={onBackFromVerify}
                  >
                    Voltar
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[color:var(--cart-copper)]" />
              <p className="cart-display mt-6 text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]">
                Confirmando pagamento
              </p>
              <p className="mt-3 text-sm text-[color:var(--cart-muted)]">
                Estamos verificando com a InfinitePay…
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="cine-sanctuary-band relative mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-16 pt-12">
      <SanctuaryBackdrop opacity={0.28} />
      <div className="relative z-10">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="cart-display text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]"
        >
          Prévia do Dossiê
        </motion.p>

        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.04 }}
          className="cart-display mt-4 text-center text-3xl tracking-wide text-[color:var(--cine-ink)] sm:text-4xl"
        >
          Sua confluência está pronta
        </motion.h1>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          className="cart-card mt-8 rounded-sm p-5"
        >
          <p className="cart-display text-[10px] uppercase tracking-[0.24em] text-[color:var(--cart-copper)]">
            Arquétipo Dominante & Subarquétipo
          </p>
          <p className="mt-3 text-lg leading-snug text-[color:var(--cart-ink)]">
            <span
              className="font-semibold"
              style={{ color: diagnosis.dominant.accent }}
            >
              {diagnosis.dominant.title}
            </span>{" "}
            <span className="text-[color:var(--cart-dim)]">
              ({diagnosis.dominantPct}%)
            </span>
            <span className="text-[color:var(--cart-muted)]"> · </span>
            <span
              className="font-semibold"
              style={{ color: diagnosis.sub.accent }}
            >
              {diagnosis.sub.title}
            </span>{" "}
            <span className="text-[color:var(--cart-dim)]">
              ({diagnosis.secondaryPct}%)
            </span>
          </p>
          <p className="mt-2 text-sm text-[color:var(--cart-muted)]">
            {diagnosis.confluenceTitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--cart-muted)]">
            {diagnosis.confluenceText.slice(0, 180)}
            {diagnosis.confluenceText.length > 180 ? "…" : ""}
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-sm border border-[color:var(--cart-border-soft)] bg-black/20 px-3 py-3 text-xs leading-relaxed text-[color:var(--cart-dim)]">
            <Lock
              size={14}
              className="mt-0.5 shrink-0 text-[color:var(--cart-copper)]"
            />
            <span>
              Escolha uma caixinha, as duas, ou o combo — checkout InfinitePay
              (Pix ou cartão). Suas 16 respostas ficam neste aparelho.
            </span>
          </div>
        </motion.div>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
          className="mx-auto mt-8 max-w-md text-center text-sm leading-relaxed text-[color:var(--cart-muted)]"
        >
          {alreadyResult
            ? "Diagnóstico já liberado. Ative a Consultoria IA 30 dias."
            : "Monte sua oferta: só o diagnóstico, só o mentor, ou ambos (R$ 6,00)."}
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          className="mt-6 grid gap-3 sm:grid-cols-2"
        >
          {BOXES.map((box) => {
            const disabled = box.id === "result" && alreadyResult;
            const selected =
              box.id === "result"
                ? alreadyResult
                  ? false
                  : selResult
                : selMentor;
            return (
              <button
                key={box.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => toggleBox(box.id)}
                className={`relative flex flex-col rounded-sm border px-4 py-5 text-left transition ${
                  disabled
                    ? "cursor-not-allowed border-[color:var(--cart-border-soft)] bg-black/15 opacity-55"
                    : selected
                      ? "border-[color:var(--cart-copper)] bg-[rgba(155,44,44,0.14)] shadow-[0_0_0_1px_rgba(201,137,74,0.35)]"
                      : box.accent
                        ? "border-[color:var(--cart-copper)]/45 bg-black/30 hover:border-[color:var(--cart-copper)]"
                        : "border-[color:var(--cart-border-soft)] bg-black/25 hover:border-[color:var(--cart-copper)]/60"
                }`}
              >
                {box.badge ? (
                  <span className="absolute -top-2 right-3 inline-flex items-center gap-1 bg-[color:var(--cart-copper)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1a120c]">
                    <Sparkles size={10} />
                    {box.badge}
                  </span>
                ) : null}
                <p className="cart-display text-[10px] uppercase tracking-[0.22em] text-[color:var(--cart-copper)]">
                  {box.title}
                </p>
                <p className="mt-3 cart-display text-2xl tracking-wide text-[color:var(--cart-ink)]">
                  {box.priceLabel}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[color:var(--cart-muted)]">
                  {disabled
                    ? "Já liberado neste aparelho — escolha o Mentor."
                    : box.persuasive}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-[color:var(--cart-muted)]">
                  {box.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check
                        size={12}
                        className="mt-0.5 shrink-0 text-[color:var(--cart-copper)]"
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <span
                  className={`mt-4 text-center text-[11px] uppercase tracking-[0.16em] ${
                    disabled
                      ? "text-[color:var(--cart-dim)]"
                      : selected
                        ? "text-[color:var(--cart-copper-bright)]"
                        : "text-[color:var(--cart-dim)]"
                  }`}
                >
                  {disabled
                    ? "Já incluso"
                    : selected
                      ? "Selecionado"
                      : "Selecionar"}
                </span>
              </button>
            );
          })}
        </motion.div>

        {!alreadyResult && selResult && selMentor ? (
          <p className="mt-4 text-center text-xs text-[color:var(--cart-copper)]">
            Combo · ambos por R$ 6,00
          </p>
        ) : null}

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={!tier || loading}
            onClick={() => void checkout()}
            className="cart-cta inline-flex min-w-[240px] items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Abrindo checkout…
              </>
            ) : totalLabel ? (
              `Pagar ${totalLabel}`
            ) : (
              "Selecione ao menos uma opção"
            )}
          </button>
          {error ? (
            <p className="text-center text-sm text-red-300/90">{error}</p>
          ) : null}
          <p className="text-center text-[11px] text-[color:var(--cart-dim)]">
            Checkout InfinitePay · redirecionamento seguro
          </p>
        </div>
      </div>
    </section>
  );
}
