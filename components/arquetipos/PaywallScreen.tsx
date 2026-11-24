"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isValidPixEmv } from "@/lib/pagbank/pixEmv";
import { playRevealChord } from "@/src/utils/soundEffects";
import { EmberCard } from "./EmberCard";

type Props = {
  onUnlocked: () => void;
  /** When true, overlay fades out (parent already cleared lock/blur). */
  visible?: boolean;
};

type CreateResponse = {
  orderId: string;
  amountLabel?: string;
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
  simulateAllowed?: boolean;
  mock?: boolean;
  error?: string;
  code?: string;
  description?: string;
  parameterName?: string;
  bodyPreview?: string;
  httpStatus?: number;
};

type StatusResponse = {
  status?: "waiting" | "paid" | "declined" | "canceled";
  error?: string;
  code?: string;
  description?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const POLL_MS = 3000;
/** Session / QR remaining window shown on the card */
const SESSION_SECONDS = 10 * 60;

/** Only PagBank-hosted PNG when present — never encode invalid/fake EMV via third-party QR. */
function pagbankQrImageSrc(qrCodeImageUrl: string | null): string | null {
  if (!qrCodeImageUrl) return null;
  if (!/^https:\/\//i.test(qrCodeImageUrl)) return null;
  return qrCodeImageUrl;
}

function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Mobile-friendly clipboard with execCommand fallback when Clipboard API is blocked. */
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
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Opção 1 paywall overlay — translucent Pix card over the blurred real result.
 * Reuses POST /api/pagbank/create + GET /api/pagbank/status/[orderId] (+ simulate-dev).
 * Polls ~3s; tolerates transient failures; stops on paid / declined / canceled / session expiry.
 */
export function PaywallScreen({ onUnlocked, visible = true }: Props) {
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [simulateAllowed, setSimulateAllowed] = useState(false);
  const [mock, setMock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
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
      setExpired(false);
      try {
        const res = await fetch("/api/pagbank/create", { method: "POST" });
        const data = (await res.json()) as CreateResponse;
        const hasValidEmv = isValidPixEmv(data.pixCopyPaste);

        // Hard failure when HTTP error and no usable order
        if (!res.ok && !data.orderId) {
          const parts = [
            data.code,
            data.description,
            data.parameterName ? `(campo: ${data.parameterName})` : null,
          ].filter(Boolean);
          let detail =
            parts.length > 0
              ? parts.join(" — ")
              : data.error ||
                data.bodyPreview ||
                `Não foi possível gerar o Pix (HTTP ${res.status})`;
          if (/ACCESS_DENIED|whitelist/i.test(detail)) {
            detail +=
              " — Ação: solicitar ao PagBank liberação (whitelist) da API Orders/PIX em produção para esta conta.";
          }
          throw new Error(detail);
        }

        if (!data.orderId) {
          throw new Error(
            data.error || "Não foi possível gerar o pedido Pix",
          );
        }

        // No forged EMV: refuse to arm copy/QR without valid PagBank text
        if (!hasValidEmv) {
          if (cancelled) return;
          setOrderId(data.orderId);
          setPixCopyPaste("");
          setQrUrl(null);
          setSimulateAllowed(Boolean(data.simulateAllowed));
          setMock(Boolean(data.mock));
          setPolling(Boolean(data.simulateAllowed));
          setSecondsLeft(SESSION_SECONDS);
          setError(
            [
              data.code || "PIX_EMV_MISSING",
              data.description ||
                "Código Pix inválido ou ausente — copy/QR ocultos (bancos rejeitam EMV falso).",
            ].join(" — "),
          );
          return;
        }

        if (cancelled) return;
        setOrderId(data.orderId);
        setPixCopyPaste(data.pixCopyPaste.trim());
        setQrUrl(pagbankQrImageSrc(data.qrCodeImageUrl ?? null));
        setSimulateAllowed(Boolean(data.simulateAllowed));
        setMock(Boolean(data.mock));
        setPolling(true);
        setSecondsLeft(SESSION_SECONDS);
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

  // Countdown — stop polling when session hits 0
  useEffect(() => {
    if (!polling || unlockedRef.current) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setPolling(false);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [polling]);

  // ~3s status poll — tolerate network/5xx; stop on paid / declined / canceled
  useEffect(() => {
    if (!polling || !orderId || unlockedRef.current) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(
          `/api/pagbank/status/${encodeURIComponent(orderId!)}`,
          { cache: "no-store" },
        );
        // Transient HTTP failures — keep waiting
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (cancelled || unlockedRef.current) return;

        if (data.status === "paid") {
          setPolling(false);
          finishUnlock();
          return;
        }
        if (data.status === "declined" || data.status === "canceled") {
          setPolling(false);
          setError(
            data.status === "declined"
              ? "Pagamento recusado. Gere um novo Pix."
              : "Cobrança cancelada ou expirada. Gere um novo Pix.",
          );
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
    if (!isValidPixEmv(pixCopyPaste)) return;
    const ok = await writeClipboard(pixCopyPaste);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2200);
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

  const hasValidEmv = isValidPixEmv(pixCopyPaste);
  const qrSrc = hasValidEmv ? pagbankQrImageSrc(qrUrl) : null;
  /** Fatal = expired or hard error with nothing useful to do (no simulate) */
  const showFatal =
    expired || (Boolean(error) && !simulateAllowed && !hasValidEmv);
  const showEmvUi = hasValidEmv && !expired;
  const showDevOnly =
    !hasValidEmv && !expired && simulateAllowed && Boolean(orderId);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="paywall-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paywall-headline"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, y: 10, transition: { duration: 0.45, ease: EASE } }
          }
          transition={{ duration: 0.35, ease: EASE }}
          className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center px-4 pb-8 pt-14 sm:items-center sm:pt-10"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(5,6,8,0.28)_0%,rgba(5,6,8,0.12)_55%,transparent_78%)]"
            aria-hidden
          />

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
            className="pointer-events-auto relative z-[1] w-full max-w-md"
          >
            <EmberCard className="ember-card-glass p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <p
                  id="paywall-headline"
                  className="cart-display text-left text-lg leading-snug tracking-wide text-[color:var(--cine-ink)] sm:text-xl"
                >
                  🔒 Seu perfil exclusivo já foi gerado!
                </p>
                <span
                  className="shrink-0 tabular rounded-sm border border-[color:var(--cine-border)] bg-black/30 px-2.5 py-1 font-mono text-xs tracking-wider text-[color:var(--cart-copper-bright)]"
                  title="Tempo restante da sessão"
                >
                  {formatCountdown(secondsLeft)}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-[color:var(--cart-muted)]">
                Apenas 7% das pessoas chegam a essa combinação exata. Libere a
                leitura completa agora antes que a sessão expire.
              </p>

              <div className="mt-5 border-t border-[color:var(--cart-border-soft)] pt-5 text-center">
                <p className="cart-display text-sm tracking-wide text-[color:var(--cart-copper-bright)] sm:text-base">
                  Taxa simbólica de liberação: R$ 3,00
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[color:var(--cart-dim)] sm:text-xs">
                  (Menos que um café para manter nossos servidores e a análise
                  individual no ar)
                </p>
              </div>

              {loading ? (
                <div className="flex flex-col items-center gap-3 py-10 text-[color:var(--cart-muted)]">
                  <Loader2 className="h-7 w-7 animate-spin text-[color:var(--cart-copper)]" />
                  <p className="text-sm">Gerando Pix…</p>
                </div>
              ) : showFatal ? (
                <div className="space-y-4 py-6 text-center">
                  <p className="text-sm text-red-300/90">
                    {expired
                      ? "Sessão do Pix expirou. Gere um novo código para liberar."
                      : error}
                  </p>
                  <button
                    type="button"
                    className="cart-cta rounded-sm px-5 py-3 text-sm font-semibold"
                    onClick={() => window.location.reload()}
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : (
                <div className="mt-5 flex flex-col items-center">
                  {/* Copy + QR only when API returned a valid PagBank EMV */}
                  {showEmvUi ? (
                    <>
                      {qrSrc ? (
                        <div className="rounded-sm border border-[color:var(--cine-border)] bg-white p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)] sm:p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrSrc}
                            alt="QR Code Pix R$ 3,00"
                            width={200}
                            height={200}
                            className="h-[160px] w-[160px] sm:h-[200px] sm:w-[200px]"
                          />
                        </div>
                      ) : (
                        <p className="text-center text-xs text-[color:var(--cart-dim)]">
                          Use Pix Copia e Cola abaixo (imagem QR não fornecida
                          pelo PagBank).
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => void copyPix()}
                        className="cart-cta mt-5 inline-flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3.5 text-center text-sm font-semibold leading-snug sm:text-[15px]"
                      >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied
                          ? "✅ Código Pix copiado! Cole no app do seu banco"
                          : "Copiar Código Pix (Liberação em 3 segundos)"}
                      </button>

                      <div className="mt-4 flex items-center gap-2 text-xs text-[color:var(--cart-muted)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--cart-copper)]" />
                        Aguardando confirmação do Pix…
                      </div>
                    </>
                  ) : null}

                  {showDevOnly ? (
                    <div className="w-full space-y-4 text-center">
                      <p className="text-sm text-amber-200/90">
                        {error ||
                          "Sem código Pix real do PagBank — copy/QR ocultos."}
                        {mock ? " (mock)" : null}
                      </p>
                      <button
                        type="button"
                        disabled={simulating}
                        onClick={() => void simulatePay()}
                        className="cart-cta inline-flex w-full items-center justify-center rounded-sm px-4 py-3.5 text-sm font-semibold disabled:opacity-50"
                      >
                        {simulating ? "Simulando…" : "Simular pagamento (dev)"}
                      </button>
                    </div>
                  ) : null}

                  {showEmvUi ? (
                    <>
                      <p className="mt-4 text-center text-[11px] leading-relaxed text-[color:var(--cart-dim)] sm:text-xs">
                        ⚡ Acesso automático: Assim que o Pix for confirmado, o
                        desfoque some na hora nesta mesma tela. Sem assinatura e
                        sem cobranças futuras.
                      </p>

                      {simulateAllowed ? (
                        <button
                          type="button"
                          disabled={simulating}
                          onClick={() => void simulatePay()}
                          className="mt-5 text-xs uppercase tracking-[0.18em] text-[color:var(--cart-dim)] underline-offset-4 hover:text-[color:var(--cart-copper)] hover:underline disabled:opacity-50"
                        >
                          {simulating
                            ? "Simulando…"
                            : "Simular pagamento (dev)"}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </EmberCard>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
