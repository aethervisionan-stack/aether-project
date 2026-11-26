"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { NarrativeResult } from "@/src/data/archetypes";
import { paywallTeaseFor } from "@/src/data/paywallTeases";
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

function pickCheckoutUrl(data: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    data.url,
    data.checkout_url,
    data.payment_url,
    data.link,
    data.checkout_link,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c.trim())) {
      return c.trim();
    }
  }
  return null;
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
  const dominant = result.dominants[0]?.profile ?? null;
  const tease = useMemo(
    () => (dominant ? paywallTeaseFor(dominant.id) : null),
    [dominant],
  );
  const alreadyResult = isResultUnlocked(readQuizSession());

  const [selResult, setSelResult] = useState(!alreadyResult);
  const [selMentor, setSelMentor] = useState(alreadyResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simNotice, setSimNotice] = useState<string | null>(null);

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
    setSimNotice(null);
    try {
      const res = await fetch("/api/infinitepay/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          sessionId: sessionClientId(),
        }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        throw new Error("Resposta inválida do servidor de pagamento");
      }
      const url = pickCheckoutUrl(data);
      const errMsg =
        typeof data.error === "string" ? data.error : null;
      if (!res.ok || !url) {
        throw new Error(errMsg || "Não foi possível abrir o checkout");
      }

      const simulated = data.simulated === true;
      if (simulated) {
        setSimNotice(
          "Modo simulado: InfinitePay ainda usa handle/API placeholder neste ambiente. Vamos liberar localmente após o retorno.",
        );
      }

      try {
        window.sessionStorage.setItem(
          "infinitepay_pending",
          JSON.stringify({
            tier,
            order_nsu:
              typeof data.order_nsu === "string" ? data.order_nsu : null,
          }),
        );
      } catch {
        // ignore
      }

      // Same-tab redirect (prefer assign — not window.open).
      window.location.assign(url);
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
          O espelho já foi forjado
        </motion.h1>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          className="mx-auto mt-8 flex max-w-md flex-col items-center"
        >
          {dominant ? (
            <div
              className="relative aspect-[2/3] w-full max-w-[220px] overflow-hidden rounded-sm border border-[color:var(--cine-border)] sm:max-w-[260px]"
              style={{
                boxShadow: `0 18px 40px rgba(0,0,0,0.45), inset 0 0 0 1px ${dominant.accent}44`,
              }}
            >
              <Image
                src={dominant.image}
                alt="Carta do arquétipo — prévia selada"
                fill
                sizes="(max-width: 640px) 60vw, 260px"
                className="object-cover"
                priority
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `
                    linear-gradient(180deg, transparent 55%, rgba(5,6,8,0.75) 88%, rgba(5,6,8,0.92) 100%),
                    linear-gradient(0deg, transparent 75%, rgba(5,6,8,0.3) 100%)
                  `,
                }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3">
                <Lock
                  size={14}
                  className="text-[color:var(--cart-copper)]"
                  aria-hidden
                />
                <span className="cart-display text-[10px] uppercase tracking-[0.28em] text-[color:var(--cart-copper)]">
                  Brasão selado
                </span>
              </div>
            </div>
          ) : null}

          {tease ? (
            <p className="mt-6 text-center text-sm leading-relaxed text-[color:var(--cart-muted)]">
              {tease}
            </p>
          ) : null}

          <p className="mt-4 text-center text-sm leading-relaxed text-[color:var(--cart-ink)]">
            {alreadyResult
              ? "Diagnóstico já liberado. Com R$ 5,00 você ativa 30 dias de Mentor — ou some o combo quando quiser renovar a jornada."
              : "Um único pagamento destrava o nome e o diagnóstico completo, e ajuda a manter os servidores deste santuário acesos: R$ 1,00 o dossiê · R$ 5,00 o Mentor 30 dias · R$ 6,00 o combo."}
          </p>

          <div className="mt-4 flex max-w-md items-start gap-2 rounded-sm border border-[color:var(--cart-border-soft)] bg-black/20 px-3 py-3 text-xs leading-relaxed text-[color:var(--cart-dim)]">
            <Lock
              size={14}
              className="mt-0.5 shrink-0 text-[color:var(--cart-copper)]"
            />
            <span>
              Nome e diagnóstico só aparecem após o pagamento (Diagnóstico ou
              Combo). Checkout InfinitePay · Pix ou cartão · respostas neste
              aparelho.
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
            <p className="max-w-md text-center text-sm text-red-300/90" role="alert">
              {error}
            </p>
          ) : null}
          {simNotice ? (
            <p className="max-w-md text-center text-xs text-amber-200/90">
              {simNotice}
            </p>
          ) : null}
          <p className="text-center text-[11px] text-[color:var(--cart-dim)]">
            Checkout InfinitePay · redirecionamento seguro
          </p>
        </div>
      </div>
    </section>
  );
}
