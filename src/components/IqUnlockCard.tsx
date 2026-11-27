"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Loader2, Lock, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  createIqPixPayment,
  fetchIqUnlockStatus,
  type IqPixCreateResult,
  type IqUnlockItemType,
} from "@/src/lib/iqUnlockClient";
import { OnlinePresenceBadge } from "@/src/components/OnlinePresenceBadge";

type Props = {
  sessionId: string;
  amountLabel: string;
  /** Stage-1 result unlock (default) or stage-2 AI upsell. */
  itemType?: IqUnlockItemType;
  onUnlocked?: (paymentId: string | null) => void;
  onAmountLabel?: (label: string) => void;
  compact?: boolean;
};

const RESULT_BENEFITS = [
  "Seu QI estimado, explicado com clareza",
  "Entrada no Hall of Fame",
  "Perfil cognitivo completo, em linguagem simples",
  "Revisão das perguntas + cartão para compartilhar",
] as const;

const AI_BENEFITS = [
  "Assistente Gemini focado só no seu IqResult",
  "Perguntas sobre forças, fraquezas e próximos passos",
  "Conversas em português, com base nesta sessão",
] as const;

const POLL_MS = 2500;

export function IqUnlockCard({
  sessionId,
  amountLabel,
  itemType = "result",
  onUnlocked,
  onAmountLabel,
  compact = false,
}: Props) {
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pix, setPix] = useState<IqPixCreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [canSimApprove, setCanSimApprove] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockedRef = useRef(false);
  const isAi = itemType === "ai_upsell";

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleUnlocked = useCallback(
    (paymentId: string | null) => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      stopPoll();
      setAwaiting(false);
      onUnlocked?.(paymentId);
    },
    [onUnlocked, stopPoll],
  );

  const isStatusUnlocked = useCallback(
    (status: { unlocked: boolean; resultUnlocked: boolean; aiUnlocked: boolean }) =>
      isAi ? status.aiUnlocked : status.resultUnlocked || status.unlocked,
    [isAi],
  );

  const pollOnce = useCallback(async () => {
    if (!sessionId || unlockedRef.current) return;
    try {
      const status = await fetchIqUnlockStatus(sessionId, { itemType });
      if (status.amountLabel) onAmountLabel?.(status.amountLabel);
      setCanSimApprove(Boolean(status.canSimApprove));
      if (isStatusUnlocked(status)) {
        handleUnlocked(status.paymentId);
      }
    } catch {
      // keep polling — transient network blips
    }
  }, [handleUnlocked, isStatusUnlocked, itemType, onAmountLabel, sessionId]);

  const startPoll = useCallback(() => {
    stopPoll();
    setAwaiting(true);
    void pollOnce();
    pollRef.current = setInterval(() => {
      void pollOnce();
    }, POLL_MS);
  }, [pollOnce, stopPoll]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  async function startPix() {
    if (loading || !sessionId) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    unlockedRef.current = false;
    try {
      const created = await createIqPixPayment(sessionId, { itemType });
      if (created.alreadyUnlocked) {
        handleUnlocked(created.paymentId);
        return;
      }
      setPix(created);
      if (created.amountLabel) onAmountLabel?.(created.amountLabel);
      if (
        created.notice &&
        (created.simulated ||
          (typeof created.code === "string" &&
            created.code.startsWith("SIMULATED")))
      ) {
        setError(created.notice);
      } else {
        setError(null);
      }
      try {
        window.sessionStorage.setItem(
          "iq_pix_pending",
          JSON.stringify({
            sessionId,
            paymentId: created.paymentId,
            itemType,
          }),
        );
      } catch {
        // ignore
      }
      setCanSimApprove(Boolean(created.canSimApprove ?? created.simulated));
      startPoll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao gerar Pix. Tente de novo — sua sessão permanece salva.",
      );
      setPix(null);
      stopPoll();
      setAwaiting(false);
    } finally {
      setLoading(false);
    }
  }

  async function copyPixCode() {
    if (!pix?.qrCode || !pix.qrCode.startsWith("000201")) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(
        "Não foi possível copiar automaticamente. Selecione o código e copie manualmente.",
      );
    }
  }

  function openCheckout() {
    const url = pix?.checkoutUrl;
    if (!url || !/^https?:\/\//i.test(url)) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function simApprove() {
    if (!sessionId || simBusy || unlockedRef.current) return;
    setSimBusy(true);
    setError(null);
    try {
      const status = await fetchIqUnlockStatus(sessionId, {
        simApprove: true,
        itemType,
      });
      if (isStatusUnlocked(status)) {
        handleUnlocked(status.paymentId);
      } else {
        setError(
          status.error ||
            "Simulação não disponível neste host. Use localhost em desenvolvimento.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao simular pagamento local.",
      );
    } finally {
      setSimBusy(false);
    }
  }

  const hasRealEmv = Boolean(pix?.qrCode?.startsWith("000201"));
  const qrSrc =
    hasRealEmv &&
    pix?.qrCodeBase64 &&
    !pix.qrCodeBase64.startsWith("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB")
      ? `data:image/png;base64,${pix.qrCodeBase64}`
      : null;
  const checkoutUrl =
    pix?.checkoutUrl && /^https?:\/\//i.test(pix.checkoutUrl)
      ? pix.checkoutUrl
      : null;
  const isSim = Boolean(pix?.simulated);
  const benefits = isAi ? AI_BENEFITS : RESULT_BENEFITS;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full rounded-2xl border bg-gradient-to-b from-zinc-900/90 to-zinc-950 shadow-[0_0_40px_-18px_rgba(34,211,238,0.35)] ${
        isAi
          ? "border-cyan-500/35 p-5 sm:p-6"
          : "border-zinc-700/80 p-6 sm:p-8"
      } ${compact ? "p-5 sm:p-5" : ""}`}
      aria-labelledby={isAi ? "iq-ai-upsell-heading" : "iq-unlock-heading"}
    >
      <div className="flex flex-col items-center text-center">
        <span
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full border ${
            isAi
              ? "border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_24px_-8px_rgba(34,211,238,0.55)]"
              : "border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_24px_-8px_rgba(52,211,153,0.55)]"
          }`}
          aria-hidden
        >
          {isAi ? (
            <Sparkles className="h-6 w-6 text-cyan-300" strokeWidth={2.5} />
          ) : pix ? (
            <Lock className="h-6 w-6 text-emerald-300" strokeWidth={2.5} />
          ) : (
            <Check className="h-6 w-6 text-emerald-300" strokeWidth={2.5} />
          )}
        </span>
        <p
          className={`mt-4 text-[11px] font-medium uppercase tracking-[0.28em] ${
            isAi ? "text-cyan-300/85" : "text-emerald-300/85"
          }`}
        >
          {isAi ? "Complemento · Assistente IA" : "Selo de conclusão"}
        </p>
        {!isAi ? (
          <OnlinePresenceBadge className="mt-3 justify-center" compact />
        ) : null}
        <h1
          id={isAi ? "iq-ai-upsell-heading" : "iq-unlock-heading"}
          className={`mt-2 font-iq-display tracking-tight text-zinc-50 ${
            compact || isAi ? "text-2xl" : "text-3xl"
          }`}
        >
          {isAi
            ? "Quer conversar com a IA sobre o seu resultado?"
            : "Seu resultado está pronto"}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          {isAi ? (
            <>
              Seu perfil já está liberado. Por mais {amountLabel} via Pix você
              abre o assistente Gemini especializado no seu IqResult — forças,
              o que treinar e dúvidas desta sessão.
            </>
          ) : (
            <>
              Você terminou o teste — obrigado pela dedicação. Com {amountLabel}{" "}
              via Pix você apoia os servidores deste projeto e libera o Hall of
              Fame, a revisão e o restante do seu diagnóstico.
            </>
          )}
        </p>
      </div>

      {!pix ? (
        <>
          <ul className="mt-6 space-y-2 text-left text-sm text-zinc-300">
            {benefits.map((item) => (
              <li
                key={item}
                className="flex gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2"
              >
                <span
                  className={`mt-0.5 ${isAi ? "text-cyan-400" : "text-cyan-400"}`}
                  aria-hidden
                >
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
            onClick={() => void startPix()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 px-6 py-3.5 text-sm font-semibold text-[#06070A] shadow-[0_0_28px_-6px_rgba(52,211,153,0.45)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Gerando Pix…
              </>
            ) : isAi ? (
              `Liberar assistente por +${amountLabel}`
            ) : (
              `Desbloquear meu resultado por ${amountLabel}`
            )}
          </button>
          <p className="mt-3 text-center text-xs text-zinc-600">
            Pagamento Pix via InfinitePay. A liberação só acontece depois da
            confirmação do pagamento
            {isAi ? " (somente em localhost/dev a simulação está disponível)." : "."}
          </p>
        </>
      ) : (
        <div className="mt-6 space-y-4">
          {hasRealEmv ? (
            <>
              <div className="mx-auto flex w-fit flex-col items-center rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrSrc}
                    alt="QR Code Pix"
                    width={240}
                    height={240}
                    className="h-60 w-60"
                  />
                ) : (
                  <QRCodeSVG
                    value={pix.qrCode}
                    size={240}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    aria-label="QR Code Pix"
                  />
                )}
              </div>

              <p className="text-center text-sm text-zinc-300">
                Escaneie o QR Code ou copie o código Pix abaixo.
              </p>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2">
                <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-400">
                  {pix.qrCode}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void copyPixCode()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-300" aria-hidden />
                    Código Pix copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden />
                    Copiar código Pix
                  </>
                )}
              </button>
            </>
          ) : null}

          {!hasRealEmv && checkoutUrl && !isSim ? (
            <div className="space-y-3">
              <p className="text-center text-sm leading-relaxed text-zinc-300">
                Abra a InfinitePay para pagar com Pix. Depois volte aqui — a
                liberação acontece assim que o pagamento confirmar.
              </p>
              <button
                type="button"
                onClick={openCheckout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 px-6 py-3.5 text-sm font-semibold text-[#06070A] shadow-[0_0_28px_-6px_rgba(52,211,153,0.45)] transition hover:brightness-110"
              >
                Abrir InfinitePay para pagar Pix
              </button>
            </div>
          ) : null}

          {(error || null) && (
            <p
              role="alert"
              className={`rounded-xl px-3 py-2 text-sm ${
                isSim
                  ? "border border-amber-500/35 bg-amber-500/10 text-amber-100"
                  : "border border-red-500/35 bg-red-500/10 text-red-200"
              }`}
            >
              {error}
            </p>
          )}

          {awaiting ? (
            <p
              className="flex items-center justify-center gap-2 text-center text-sm text-zinc-400"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" aria-hidden />
              Aguardando confirmação do pagamento…
            </p>
          ) : null}

          {canSimApprove ? (
            <button
              type="button"
              disabled={simBusy}
              onClick={() => void simApprove()}
              className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-100/90 disabled:opacity-50"
            >
              {simBusy
                ? "Simulando…"
                : "Simular pagamento (somente localhost / dev)"}
            </button>
          ) : null}

          <button
            type="button"
            disabled={loading}
            onClick={() => void startPix()}
            className="w-full text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            {hasRealEmv ? "Gerar novo QR Pix" : "Gerar novo pagamento"}
          </button>
        </div>
      )}
    </motion.section>
  );
}
