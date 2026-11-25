"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Loader2, Lock, Shield } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDiagnosis } from "@/src/data/diagnosis";
import type { NarrativeResult } from "@/src/data/archetypes";
import { playRevealChord } from "@/src/utils/soundEffects";
import { EmberCard } from "./EmberCard";
import { SanctuaryBackdrop } from "./CinematicChrome";

type Props = {
  result: NarrativeResult;
  onUnlocked: () => void;
};

type CreateResponse = {
  orderId: string;
  amountLabel?: string;
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
  simulateAllowed?: boolean;
  mock?: boolean;
  error?: string;
};

type StatusResponse = {
  status?: "waiting" | "paid" | "declined" | "canceled";
  error?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const POLL_MS = 3000;

function qrImageSrc(pixCopyPaste: string, qrCodeImageUrl: string | null) {
  if (qrCodeImageUrl) return qrCodeImageUrl;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(pixCopyPaste)}`;
}

export function PaywallScreen({ result, onUnlocked }: Props) {
  const reduce = useReducedMotion();
  const diagnosis = useMemo(() => buildDiagnosis(result), [result]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [simulateAllowed, setSimulateAllowed] = useState(false);
  const [mock, setMock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const unlockedRef = useRef(false);

  function finishUnlock() {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    playRevealChord();
    onUnlocked();
  }

  useEffect(() => {
    let cancelled = false;

    async function createOrder() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pagbank/create", { method: "POST" });
        const data = (await res.json()) as CreateResponse;
        if (!res.ok || !data.orderId || !data.pixCopyPaste) {
          throw new Error(data.error || "Não foi possível gerar o Pix");
        }
        if (cancelled) return;
        setOrderId(data.orderId);
        setPixCopyPaste(data.pixCopyPaste);
        setQrUrl(data.qrCodeImageUrl);
        setSimulateAllowed(Boolean(data.simulateAllowed));
        setMock(Boolean(data.mock));
        setPolling(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao criar Pix");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void createOrder();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!polling || !orderId || unlockedRef.current) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(
          `/api/pagbank/status/${encodeURIComponent(orderId!)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;
        if (data.status === "paid") {
          setPolling(false);
          finishUnlock();
        }
      } catch {
        // keep polling — transient network blips
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // finishUnlock is stable enough via ref; omit from deps on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, orderId]);

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(pixCopyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function simulatePay() {
    if (!orderId || simulating) return;
    setSimulating(true);
    try {
      const res = await fetch("/api/pagbank/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = (await res.json()) as StatusResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Simulate failed");
      if (data.status === "paid") {
        setPolling(false);
        finishUnlock();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao simular");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <section className="cine-sanctuary-band relative mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-12">
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
            <span className="font-semibold" style={{ color: diagnosis.dominant.accent }}>
              {diagnosis.dominant.title}
            </span>{" "}
            <span className="text-[color:var(--cart-dim)]">
              ({diagnosis.dominantPct}%)
            </span>
            <span className="text-[color:var(--cart-muted)]"> · </span>
            <span className="font-semibold" style={{ color: diagnosis.sub.accent }}>
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
            <Lock size={14} className="mt-0.5 shrink-0 text-[color:var(--cart-copper)]" />
            <span>
              Espelho das escolhas, luz, gatilhos de autossabotagem, sombra e 3
              passos de integração — liberados após Pix R$ 3,00. Suas 16
              respostas ficam salvas neste aparelho.
            </span>
          </div>
        </motion.div>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
          className="mx-auto mt-8 max-w-md text-center text-sm leading-relaxed text-[color:var(--cart-muted)]"
        >
          Desbloqueie o dossiê completo por{" "}
          <strong className="font-semibold text-[color:var(--cart-copper-bright)]">
            R$ 3,00
          </strong>{" "}
          via Pix — sem cadastro. A liberação é automática.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          className="mt-6"
        >
          <EmberCard className="p-6 sm:p-8">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-10 text-[color:var(--cart-muted)]">
                <Loader2 className="h-7 w-7 animate-spin text-[color:var(--cart-copper)]" />
                <p className="text-sm">Gerando Pix…</p>
              </div>
            ) : error ? (
              <div className="space-y-4 py-6 text-center">
                <p className="text-sm text-red-300/90">{error}</p>
                <button
                  type="button"
                  className="cart-cta rounded-sm px-5 py-3 text-sm font-semibold"
                  onClick={() => window.location.reload()}
                >
                  Tentar de novo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <p className="cart-display text-[10px] uppercase tracking-[0.28em] text-[color:var(--cart-copper)]">
                  Escaneie o QR Code
                </p>
                <div className="mt-4 rounded-sm border border-[color:var(--cine-border)] bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageSrc(pixCopyPaste, qrUrl)}
                    alt="QR Code Pix R$ 3,00"
                    width={240}
                    height={240}
                    className="h-[220px] w-[220px] sm:h-[240px] sm:w-[240px]"
                  />
                </div>

                <p className="mt-5 text-center text-xs text-[color:var(--cart-dim)]">
                  Ou use Pix Copia e Cola
                </p>
                <button
                  type="button"
                  onClick={() => void copyPix()}
                  className="mt-2 inline-flex w-full max-w-sm items-center justify-center gap-2 border border-[color:var(--cart-border-soft)] px-4 py-3 text-sm text-[color:var(--cart-ink)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)]"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </button>

                <div className="mt-6 flex items-center gap-2 text-xs text-[color:var(--cart-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--cart-copper)]" />
                  Aguardando pagamento…
                </div>

                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[color:var(--cart-dim)]">
                  <Shield size={12} />
                  Confirmação automática a cada 3s
                  {mock ? " · modo mock" : null}
                </p>

                {simulateAllowed ? (
                  <button
                    type="button"
                    disabled={simulating}
                    onClick={() => void simulatePay()}
                    className="mt-6 text-xs uppercase tracking-[0.18em] text-[color:var(--cart-dim)] underline-offset-4 hover:text-[color:var(--cart-copper)] hover:underline disabled:opacity-50"
                  >
                    {simulating ? "Simulando…" : "Simular pagamento (dev)"}
                  </button>
                ) : null}
              </div>
            )}
          </EmberCard>
        </motion.div>
      </div>
    </section>
  );
}
