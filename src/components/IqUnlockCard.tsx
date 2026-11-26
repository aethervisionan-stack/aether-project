"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Lock } from "lucide-react";
import { createIqCheckout } from "@/src/lib/iqUnlockClient";
import { redirectToCheckout } from "@/src/utils/checkoutRedirect";

type Props = {
  sessionId: string;
  amountLabel: string;
  verifying?: boolean;
  verifyError?: string | null;
  onRetryVerify?: () => void;
};

const UNLOCK_BENEFITS = [
  "Seu QI estimado, explicado com clareza",
  "Entrada no Hall of Fame",
  "Perfil cognitivo completo, em linguagem simples",
  "Revisão das perguntas + cartão para compartilhar",
  "Convite dedicado à IA para tirar dúvidas do seu resultado",
] as const;

export function IqUnlockCard({
  sessionId,
  amountLabel,
  verifying = false,
  verifyError = null,
  onRetryVerify,
}: Props) {
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (loading || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const { url, order_nsu } = await createIqCheckout(sessionId);
      try {
        window.sessionStorage.setItem(
          "iq_infinitepay_pending",
          JSON.stringify({ sessionId, order_nsu }),
        );
      } catch {
        // ignore
      }
      redirectToCheckout(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao iniciar pagamento. Tente de novo — sua sessão permanece salva.",
      );
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg rounded-2xl border border-cyan-500/25 bg-zinc-950/80 p-6 text-center sm:p-8"
        aria-live="polite"
      >
        {verifyError ? (
          <>
            <Lock className="mx-auto h-8 w-8 text-amber-300/90" aria-hidden />
            <h1 className="mt-4 font-iq-display text-2xl text-zinc-50">
              Pagamento ainda não confirmado
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-red-300/90">
              {verifyError}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Sua sessão permanece salva. Você pode tentar de novo sem refazer o
              teste.
            </p>
            {onRetryVerify ? (
              <button
                type="button"
                onClick={onRetryVerify}
                className="mt-6 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 px-6 py-3 text-sm font-semibold text-[#06070A]"
              >
                Tentar confirmar de novo
              </button>
            ) : null}
          </>
        ) : (
          <>
            <Loader2
              className="mx-auto h-8 w-8 animate-spin text-cyan-300"
              aria-hidden
            />
            <h1 className="mt-4 font-iq-display text-2xl text-zinc-50">
              Confirmando pagamento…
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Aguarde um instante — estamos confirmando seu pagamento
              InfinitePay.
            </p>
          </>
        )}
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-lg rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 shadow-[0_0_40px_-18px_rgba(34,211,238,0.35)] sm:p-8"
      aria-labelledby="iq-unlock-heading"
    >
      <div className="flex flex-col items-center text-center">
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_24px_-8px_rgba(52,211,153,0.55)]"
          aria-hidden
        >
          <Check className="h-6 w-6 text-emerald-300" strokeWidth={2.5} />
        </span>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.28em] text-emerald-300/85">
          Selo de conclusão
        </p>
        <h1
          id="iq-unlock-heading"
          className="mt-2 font-iq-display text-3xl tracking-tight text-zinc-50"
        >
          Seu resultado está pronto
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          Você terminou o teste — obrigado pela dedicação. Com {amountLabel}{" "}
          você apoia os servidores e a inteligência artificial deste projeto e
          libera o Hall of Fame, um convite dedicado para conversar com a IA
          sobre o seu perfil, e o restante do seu diagnóstico.
        </p>
      </div>

      <ul className="mt-6 space-y-2 text-left text-sm text-zinc-300">
        {UNLOCK_BENEFITS.map((item) => (
          <li
            key={item}
            className="flex gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2"
          >
            <span className="mt-0.5 text-cyan-400" aria-hidden>
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {(error || null) && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={() => void startCheckout()}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 px-6 py-3.5 text-sm font-semibold text-[#06070A] shadow-[0_0_28px_-6px_rgba(52,211,153,0.45)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Abrindo checkout…
          </>
        ) : (
          `Desbloquear meu resultado por ${amountLabel}`
        )}
      </button>
      <p className="mt-3 text-center text-xs text-zinc-600">
        Pagamento seguro com InfinitePay. A liberação só acontece depois da
        confirmação do pagamento.
      </p>
    </motion.section>
  );
}
