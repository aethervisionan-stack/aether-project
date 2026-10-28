"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, Loader2, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FALLBACK_SOL_USD,
  HARD_CAP_SOL,
  MIN_SOL,
  PRESALE_TIERS,
  SOFT_CAP_SOL,
  SOLSCAN_ACCOUNT,
  SQUADS_VAULT,
  TIER_SELECT_EVENT,
  VISION_PRICE_USD,
  formatAmount,
  formatUsd,
  visionForUsd,
  visionFromUsd,
} from "@/lib/presale";
import { HoverLift } from "./Reveal";

type TxStatus = "idle" | "pending" | "success" | "cancelled" | "error";

const TREASURY = new PublicKey(SQUADS_VAULT);
const MAX_SOL = 40;
const PRESETS = ["0.5", "1", "2", "5"] as const;

function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
  return Promise.resolve();
}

export function PresaleCheckout() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [solInput, setSolInput] = useState("1");
  const [solUsd, setSolUsd] = useState(FALLBACK_SOL_USD);
  const [priceLive, setPriceLive] = useState(false);
  const [raisedSol, setRaisedSol] = useState(0);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      try {
        const response = await fetch("/api/sol-price", { cache: "no-store" });
        const data = (await response.json()) as { usd?: number; source?: string };
        if (!cancelled && typeof data.usd === "number" && data.usd > 0) {
          setSolUsd(data.usd);
          setPriceLive(data.source !== "fallback");
        }
      } catch {
        if (!cancelled) {
          setSolUsd(FALLBACK_SOL_USD);
          setPriceLive(false);
        }
      }
    }

    async function loadTreasury() {
      try {
        const lamports = await connection.getBalance(TREASURY, "confirmed");
        if (!cancelled) setRaisedSol(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (!cancelled) setRaisedSol(0);
      }
    }

    void loadPrice();
    void loadTreasury();
    const interval = window.setInterval(() => {
      void loadPrice();
      void loadTreasury();
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection]);

  const quote = useMemo(() => {
    const solAmount = Number.parseFloat(solInput.replace(",", "."));
    if (!Number.isFinite(solAmount) || solAmount <= 0) {
      return { solAmount: 0, usd: 0, baseVision: 0, bonusPct: 0, vision: 0 };
    }
    const usd = solAmount * solUsd;
    const selected = PRESALE_TIERS.find((tier) => tier.id === activeTier);
    const matched =
      selected ??
      [...PRESALE_TIERS].reverse().find((tier) => usd + 1 >= tier.usd);
    const bonusPct = matched?.bonusPct ?? 0;
    const baseVision = visionFromUsd(usd);
    return {
      solAmount,
      usd,
      baseVision,
      bonusPct,
      vision: baseVision * (1 + bonusPct / 100),
    };
  }, [solInput, solUsd, activeTier]);

  const rateLabel = useMemo(
    () => formatAmount(visionFromUsd(solUsd), 0),
    [solUsd],
  );

  const sliderValue = useMemo(() => {
    const n = Number.parseFloat(solInput.replace(",", "."));
    if (!Number.isFinite(n)) return 1;
    return Math.min(MAX_SOL, Math.max(MIN_SOL, n));
  }, [solInput]);

  const sliderPct = ((sliderValue - MIN_SOL) / (MAX_SOL - MIN_SOL)) * 100;
  const raisedPct = Math.min(100, (raisedSol / HARD_CAP_SOL) * 100);
  const softPct = (SOFT_CAP_SOL / HARD_CAP_SOL) * 100;

  const selectTier = useCallback(
    (usd: number, id: string) => {
      setActiveTier(id);
      const sol = usd / solUsd;
      setSolInput(sol.toFixed(3));
    },
    [solUsd],
  );

  useEffect(() => {
    function applyTier(id: string | null) {
      if (!id) return;
      const tier = PRESALE_TIERS.find((item) => item.id === id);
      if (!tier) return;
      selectTier(tier.usd, tier.id);
    }

    function fromHash() {
      const hash = window.location.hash;
      const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
      applyTier(new URLSearchParams(query).get("device"));
    }

    function onSelect(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      applyTier(id ?? null);
    }

    fromHash();
    window.addEventListener(TIER_SELECT_EVENT, onSelect);
    window.addEventListener("hashchange", fromHash);
    return () => {
      window.removeEventListener(TIER_SELECT_EVENT, onSelect);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [selectTier]);

  async function handleCopy() {
    try {
      await copyText(SQUADS_VAULT);
    } catch {
      /* clipboard can be blocked in some browsers */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function contribute() {
    setErrorMessage(null);
    setTxHash(null);

    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    if (quote.solAmount < MIN_SOL) {
      setStatus("error");
      setErrorMessage(`Mínimo de ${MIN_SOL} SOL por transação.`);
      return;
    }

    const lamports = Math.round(quote.solAmount * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      setStatus("error");
      setErrorMessage("Quantidade de SOL inválida.");
      return;
    }

    setStatus("pending");
    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY,
          lamports,
        }),
      );

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
      });
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      setTxHash(signature);
      setStatus("success");
      const lamportsNow = await connection.getBalance(TREASURY, "confirmed");
      setRaisedSol(lamportsNow / LAMPORTS_PER_SOL);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na transação.";
      const cancelledByUser =
        /reject|cancel|declin|user/i.test(message) ||
        message.includes("WalletSignTransactionError");
      setStatus(cancelledByUser ? "cancelled" : "error");
      setErrorMessage(
        cancelledByUser ? "Transação cancelada na carteira." : message,
      );
    }
  }

  return (
    <div className="mt-10 space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="glass rounded-[1.75rem] p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cyan">
              <Shield size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan">
                Tesouraria on-chain · Squads
              </p>
              <p className="mt-3 break-all font-mono text-[13px] leading-relaxed tracking-tight text-ink">
                {SQUADS_VAULT}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                Vault transparente para auditoria pública. SOL vai direto para
                esta multisig. Confira o endereço na carteira antes de assinar.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex min-w-[138px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-ink transition duration-300 hover:border-cyan/40 hover:text-cyan"
                >
                  {copied ? (
                    <span className="inline-flex items-center gap-2 text-cyan">
                      <Check size={13} />
                      Copied!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Copy size={13} />
                      Copy Address
                    </span>
                  )}
                </button>
                <a
                  href={SOLSCAN_ACCOUNT}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-xs text-ink transition duration-300 hover:border-cyan/40 hover:text-cyan"
                >
                  <ExternalLink size={13} />
                  Auditar no Solscan
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted">Progresso da fase</span>
              <span className="tabular font-mono text-[13px] text-ink">
                {formatAmount(raisedSol, 2)} / {formatAmount(HARD_CAP_SOL, 0)} SOL
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet to-cyan transition-[width] duration-700 ease-out"
                style={{ width: `${raisedPct}%` }}
              />
              <div
                className="absolute top-0 h-full w-px bg-ink/50"
                style={{ left: `${softPct}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted">
              <span>Soft Cap {SOFT_CAP_SOL} SOL</span>
              <span>Hard Cap {HARD_CAP_SOL} SOL</span>
            </div>
          </div>
        </article>

        <article className="glass rounded-[1.75rem] p-6 md:p-8">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="font-display text-xl tracking-tight">
                Checkout da pré-venda
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                1 $VISION = {formatUsd(VISION_PRICE_USD)}. Taxa ao vivo:{" "}
                <span className="text-cyan">1 SOL ≈ {rateLabel} $VISION</span>
                {priceLive ? " · cotação live" : " · fallback US$ 150"}.
              </p>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Phantom · Backpack
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setActiveTier(null);
                  setSolInput(preset);
                }}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition duration-300 ${
                  solInput === preset
                    ? "border-cyan/50 bg-cyan/10 text-cyan"
                    : "border-white/10 text-muted hover:border-cyan/30 hover:text-ink"
                }`}
              >
                {preset} SOL
              </button>
            ))}
          </div>

          <label
            className="mt-7 block text-[13px] text-muted"
            htmlFor="sol-amount"
          >
            Quantidade em SOL
          </label>
          <input
            id="sol-amount"
            inputMode="decimal"
            value={solInput}
            onChange={(event) => {
              setActiveTier(null);
              setSolInput(event.target.value);
            }}
            placeholder="1"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-onyx/70 px-4 py-3.5 font-mono text-lg tabular text-ink outline-none transition duration-300 focus:border-cyan/40 focus:ring-2 focus:ring-cyan/20"
          />

          <input
            type="range"
            min={MIN_SOL}
            max={MAX_SOL}
            step={0.05}
            value={sliderValue}
            onChange={(event) => {
              setActiveTier(null);
              setSolInput(event.target.value);
            }}
            className="sol-slider mt-5"
            style={{ ["--sol-pct" as string]: `${sliderPct}%` }}
            aria-label="Slider de SOL"
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-onyx/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                USD
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight text-violet tabular">
                {formatUsd(quote.usd)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-onyx/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                Bônus
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight text-ink tabular">
                {quote.bonusPct}%
              </p>
            </div>
            <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                Você recebe
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight text-cyan tabular">
                {formatAmount(quote.vision, 2)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void contribute()}
            disabled={status === "pending"}
            className="glow-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan to-neon px-6 py-3.5 text-sm font-medium text-onyx transition duration-300 hover:brightness-110 disabled:opacity-55"
          >
            {status === "pending" ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Confirmando na carteira…
              </>
            ) : connected ? (
              "Buy with Solana"
            ) : (
              "Conectar Phantom / Backpack"
            )}
          </button>

          <AnimatePresence>
            {status === "success" && txHash ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-sm text-cyan"
                role="status"
              >
                Contribuição confirmada. Recibo:{" "}
                <a
                  href={`https://solscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-xs underline decoration-cyan/40 underline-offset-4"
                >
                  {txHash}
                </a>
              </motion.p>
            ) : null}
            {status === "cancelled" ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-sm text-muted"
                role="status"
              >
                {errorMessage}
              </motion.p>
            ) : null}
            {status === "error" && errorMessage ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-sm text-red-400"
                role="status"
              >
                {errorMessage}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Transferência nativa de SOL para a Squads Multisig. $VISION é
            creditado conforme a taxa desta fase; não é uma oferta de valor
            mobiliário.
          </p>
        </article>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {PRESALE_TIERS.map((tier) => {
          const tokens = visionForUsd(tier.usd, tier.bonusPct);
          const selected = activeTier === tier.id;
          return (
            <HoverLift key={tier.id} className="h-full">
              <article
                className={`flex h-full flex-col rounded-[1.75rem] border p-6 backdrop-blur-xl transition duration-500 ${
                  selected || tier.highlight
                    ? "border-violet/40 bg-surface/70 shadow-[0_0_40px_rgba(139,92,246,0.12)]"
                    : "border-white/10 bg-surface/40 hover:border-cyan/30"
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                  {tier.badge}
                </p>
                <h3 className="mt-2 font-display text-xl tracking-tight">
                  {tier.name}
                </h3>
                <p className="mt-2 font-display text-3xl tracking-tight text-cyan tabular">
                  {formatUsd(tier.usd)}
                </p>
                <p className="mt-2 font-mono text-xs text-cyan/90">
                  {formatAmount(tokens, 0)} $VISION · bônus {tier.bonusPct}%
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm leading-relaxed text-muted">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => selectTier(tier.usd, tier.id)}
                  className={`mt-6 rounded-full px-4 py-2.5 text-sm font-medium transition duration-300 ${
                    tier.highlight
                      ? "bg-violet text-ink hover:brightness-110"
                      : "border border-white/10 text-ink hover:border-cyan/40 hover:text-cyan"
                  }`}
                >
                  Selecionar {tier.name}
                </button>
              </article>
            </HoverLift>
          );
        })}
      </div>
    </div>
  );
}
