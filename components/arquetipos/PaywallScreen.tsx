"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  FIXED_PIX_EMV,
  FIXED_PIX_QR_SRC,
  FIXED_PIX_UNLOCK_ENABLE_MS,
} from "@/lib/pagbank/fixedPixUnlock";
import { playRevealChord } from "@/src/utils/soundEffects";
import { EmberCard } from "./EmberCard";

type Props = {
  onUnlocked: () => void;
  /** When true, overlay fades out (parent already cleared lock/blur). */
  visible?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;
/** Session urgency window shown on the card (Opção 1 feel). */
const SESSION_SECONDS = 10 * 60;

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
 * Opção 1 paywall — fixed official PagBank QR + EMV (no /api/pagbank/create).
 * User copies Pix, pays in bank app, then confirms → isUnlocked + localStorage.
 */
export function PaywallScreen({ onUnlocked, visible = true }: Props) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const unlockedRef = useRef(false);

  function finishUnlock() {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    playRevealChord();
    onUnlocked();
  }

  // Enable confirm after a short delay (still clickable once armed).
  useEffect(() => {
    const t = window.setTimeout(
      () => setConfirmEnabled(true),
      FIXED_PIX_UNLOCK_ENABLE_MS,
    );
    return () => window.clearTimeout(t);
  }, []);

  // Session countdown (urgency only — does not block unlock).
  useEffect(() => {
    if (unlockedRef.current) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  async function copyPix() {
    const ok = await writeClipboard(FIXED_PIX_EMV);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2200);
  }

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

              <div className="mt-5 flex flex-col items-center">
                <div className="mx-auto flex w-full justify-center rounded-sm border border-[color:var(--cine-border)] bg-white p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)] sm:p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={FIXED_PIX_QR_SRC}
                    alt="QR Code Pix oficial PagBank R$ 3,00"
                    width={220}
                    height={204}
                    className="mx-auto h-auto w-[168px] max-w-full object-contain sm:w-[220px]"
                    decoding="async"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void copyPix()}
                  className="cart-cta mt-5 inline-flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3.5 text-center text-sm font-semibold leading-snug sm:text-[15px]"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied
                    ? "✅ Código Pix copiado! Cole no app do seu banco"
                    : "Copiar código Pix (Copia e Cola)"}
                </button>

                <button
                  type="button"
                  disabled={!confirmEnabled}
                  onClick={() => finishUnlock()}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-sm border border-[color:var(--cine-border)] bg-black/35 px-4 py-3.5 text-center text-sm font-semibold leading-snug text-[color:var(--cine-ink)] transition enabled:hover:border-[color:var(--cart-copper)] enabled:hover:text-[color:var(--cart-copper-bright)] disabled:cursor-not-allowed disabled:opacity-45 sm:text-[15px]"
                >
                  {confirmEnabled
                    ? "Já realizei o pagamento (Liberar resultado)"
                    : "Aguarde alguns segundos…"}
                </button>

                <p className="mt-4 text-center text-[11px] leading-relaxed text-[color:var(--cart-dim)] sm:text-xs">
                  Após pagar no app do banco, toque em liberar — o desfoque some
                  nesta mesma tela. Sem assinatura e sem cobranças futuras.
                </p>
              </div>
            </EmberCard>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
