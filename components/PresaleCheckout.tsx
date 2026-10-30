"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, Loader2, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckoutReceipt } from "@/components/CheckoutReceipt";
import { TrustBadges } from "@/components/TrustBadges";
import { VisionDeliveryNotice } from "@/components/VisionDeliveryNotice";
import { useAetherCheckout } from "@/hooks/useAetherCheckout";
import { translateError, useI18n } from "@/lib/i18n";
import {
  HARD_CAP_SOL,
  MIN_SOL,
  PRESALE_TIERS,
  SOFT_CAP_SOL,
  SOLSCAN_ACCOUNT,
  SOL_TREASURY,
  TIER_SELECT_EVENT,
  VISION_PRICE_USD,
  formatAmount,
  formatUsd,
  visionForUsd,
  visionFromUsd,
} from "@/lib/presale";
import { rpcWithFallback } from "@/lib/solana";
import { HoverLift } from "./Reveal";

const TREASURY = new PublicKey(SOL_TREASURY);
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

type SolPaidPayload = {
  txHash?: string | null;
  error?: string | null;
  detail?: string | null;
  order?: { fulfillError?: string | null; splSignature?: string | null };
};

async function notifySolPaid(
  orderId: string,
  signature: string,
): Promise<SolPaidPayload> {
  let last: SolPaidPayload = {};
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const paid = await fetch(`/api/orders/${orderId}/sol-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      last = (await paid.json()) as SolPaidPayload;
      if (last.txHash || last.order?.splSignature) return last;
      if (paid.status < 500 && paid.status !== 503) return last;
    } catch {
      last = { error: "sol_paid_unreachable" };
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  return last;
}

export function PresaleCheckout() {
  const { t, locale } = useI18n();
  const { connection } = useConnection();
  const {
    loading,
    txHash,
    error,
    errorDetail,
    status,
    tierName,
    handlePurchase,
    connectWallet,
    reset,
    connected,
    publicKey,
    solUsd,
  } = useAetherCheckout();

  const [solInput, setSolInput] = useState("1");
  const [priceLive, setPriceLive] = useState(false);
  const [raisedSol, setRaisedSol] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeTier, setActiveTier] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"sol" | "pix">("sol");
  const [destPubkey, setDestPubkey] = useState("");
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [fulfillNote, setFulfillNote] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!pixCopied) return;
    const timer = window.setTimeout(() => setPixCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [pixCopied]);

  useEffect(() => {
    if (publicKey && !destPubkey) {
      setDestPubkey(publicKey.toBase58());
    }
  }, [publicKey, destPubkey]);

  useEffect(() => {
    if (!pixOrderId) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${pixOrderId}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          order?: {
            status?: string;
            splSignature?: string | null;
            fulfillError?: string | null;
          };
        };
        if (cancelled || !data.order) return;
        if (data.order.status === "fulfilled") {
          setFulfillNote(t.checkout.fulfillOk);
        } else if (data.order.status === "paid") {
          setFulfillNote(
            data.order.fulfillError
              ? t.checkout.fulfillWaitWallet
              : t.checkout.fulfillPending,
          );
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pixOrderId, t.checkout.fulfillOk, t.checkout.fulfillPending, t.checkout.fulfillWaitWallet]);

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      try {
        const response = await fetch("/api/sol-price", { cache: "no-store" });
        const data = (await response.json()) as { usd?: number; source?: string };
        if (!cancelled) {
          setPriceLive(data.source !== "fallback");
        }
      } catch {
        if (!cancelled) setPriceLive(false);
      }
    }

    async function loadTreasury() {
      try {
        const { value: lamports } = await rpcWithFallback(connection, (rpc) =>
          rpc.getBalance(TREASURY, "confirmed"),
        );
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
    () => formatAmount(visionFromUsd(solUsd), 0, locale),
    [solUsd, locale],
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
      await copyText(SOL_TREASURY);
    } catch {
      /* clipboard can be blocked in some browsers */
    }
    setCopied(true);
  }

  async function createPresaleOrder(method: "sol" | "pix") {
    const dest = destPubkey.trim() || publicKey?.toBase58() || "";
    const name =
      PRESALE_TIERS.find((tier) => tier.id === activeTier)?.name ??
      t.checkout.contribution;
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        destPubkey: dest,
        usd: quote.usd,
        solLamports: Math.floor(quote.solAmount * LAMPORTS_PER_SOL),
        tierId: activeTier,
        tierName: name,
      }),
    });
    const data = (await response.json()) as {
      order?: {
        id: string;
        pixCopyPaste?: string | null;
      };
      error?: string;
    };
    if (!response.ok || !data.order) {
      throw new Error(data.error ?? "order_failed");
    }
    return { ...data.order, tierName: name };
  }

  async function contribute() {
    setOrderError(null);
    setFulfillNote(null);
    setOrderBusy(true);
    try {
      const order = await createPresaleOrder("sol");
      const signature = await handlePurchase(
        order.tierName,
        quote.solAmount,
        order.id,
      );
      if (!signature) return;
      const payload = await notifySolPaid(order.id, signature);
      if (payload.txHash || payload.order?.splSignature) {
        setFulfillNote(t.checkout.fulfillOk);
      } else if (payload.detail || payload.order?.fulfillError) {
        setFulfillNote(t.checkout.fulfillWaitWallet);
      } else {
        setFulfillNote(t.checkout.fulfillPending);
      }
      try {
        const { value: lamportsNow } = await rpcWithFallback(connection, (rpc) =>
          rpc.getBalance(TREASURY, "confirmed"),
        );
        setRaisedSol(lamportsNow / LAMPORTS_PER_SOL);
      } catch {
        /* progress bar updates on the next poll */
      }
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "order_failed");
    } finally {
      setOrderBusy(false);
    }
  }

  async function startPix() {
    setOrderError(null);
    setFulfillNote(null);
    setOrderBusy(true);
    try {
      const order = await createPresaleOrder("pix");
      setPixOrderId(order.id);
      setPixCode(order.pixCopyPaste ?? "");
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "order_failed");
    } finally {
      setOrderBusy(false);
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
                {t.checkout.treasuryKicker}
              </p>
              <p className="mt-3 break-all font-mono text-[13px] leading-relaxed tracking-tight text-ink">
                {SOL_TREASURY}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                {t.checkout.treasuryBody}
              </p>
              <VisionDeliveryNotice className="mt-4" />
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex min-w-[138px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-ink transition duration-300 hover:border-cyan/40 hover:text-cyan"
                >
                  {copied ? (
                    <span className="inline-flex items-center gap-2 text-cyan">
                      <Check size={13} />
                      {t.checkout.copied}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Copy size={13} />
                      {t.checkout.copy}
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
                  {t.checkout.audit}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted">{t.checkout.progress}</span>
              <span className="tabular font-mono text-[13px] text-ink">
                {formatAmount(raisedSol, 2, locale)} /{" "}
                {formatAmount(HARD_CAP_SOL, 0, locale)} SOL
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
                {t.checkout.checkoutTitle}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                1 $VISION = {formatUsd(VISION_PRICE_USD, locale)}.{" "}
                {t.checkout.liveRate}{" "}
                <span className="text-cyan">1 SOL ≈ {rateLabel} $VISION</span>
                {priceLive
                  ? ` · ${t.checkout.liveQuote}`
                  : ` · ${t.checkout.fallbackQuote}`}
                .
              </p>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              {t.checkout.wallets}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPayMethod("sol")}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition duration-300 ${
                payMethod === "sol"
                  ? "border-cyan/50 bg-cyan/10 text-cyan"
                  : "border-white/10 text-muted hover:border-cyan/30 hover:text-ink"
              }`}
            >
              {t.checkout.paySol}
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("pix")}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition duration-300 ${
                payMethod === "pix"
                  ? "border-cyan/50 bg-cyan/10 text-cyan"
                  : "border-white/10 text-muted hover:border-cyan/30 hover:text-ink"
              }`}
            >
              {t.checkout.payPix}
            </button>
          </div>

          <label className="mt-6 block text-[13px] text-muted" htmlFor="dest-pubkey">
            {t.checkout.destLabel}
          </label>
          <input
            id="dest-pubkey"
            value={destPubkey}
            onChange={(event) => setDestPubkey(event.target.value)}
            placeholder={t.checkout.destPlaceholder}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-onyx/70 px-4 py-3 font-mono text-[13px] text-ink outline-none transition duration-300 focus:border-cyan/40 focus:ring-2 focus:ring-cyan/20"
          />

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
            {t.checkout.amountLabel}
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
            aria-label={t.checkout.slider}
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-onyx/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {t.checkout.usd}
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight text-violet tabular">
                {formatUsd(quote.usd, locale)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-onyx/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {t.checkout.bonus}
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight text-ink tabular">
                {quote.bonusPct}%
              </p>
            </div>
            <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                {t.checkout.youReceive}
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight text-cyan tabular">
                {formatAmount(quote.vision, 2, locale)}
              </p>
            </div>
          </div>

          {payMethod === "pix" && pixCode ? (
            <div className="mt-6 rounded-2xl border border-cyan/20 bg-cyan/[0.04] p-4">
              <p className="text-sm leading-relaxed text-muted">
                {t.checkout.pixHint}
              </p>
              <img
                alt="PIX QR"
                className="mx-auto mt-4 h-44 w-44 rounded-xl bg-white p-2"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(pixCode)}`}
              />
              <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-ink">
                {pixCode}
              </p>
              <button
                type="button"
                onClick={() => {
                  void copyText(pixCode);
                  setPixCopied(true);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-xs text-ink hover:border-cyan/40 hover:text-cyan"
              >
                {pixCopied ? t.checkout.copied : t.checkout.pixCopy}
              </button>
              <p className="mt-3 text-sm text-cyan">
                {fulfillNote ?? t.checkout.pixWaiting}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!pixOrderId) return;
                  void fetch(`/api/orders/${pixOrderId}/mock-pay`, {
                    method: "POST",
                  }).then(async (response) => {
                    const data = (await response.json()) as {
                      order?: { fulfillError?: string | null; splSignature?: string | null };
                    };
                    if (data.order?.splSignature) setFulfillNote(t.checkout.fulfillOk);
                    else if (data.order?.fulfillError)
                      setFulfillNote(t.checkout.fulfillWaitWallet);
                    else setFulfillNote(t.checkout.fulfillPending);
                  });
                }}
                className="mt-2 text-[11px] text-muted underline-offset-2 hover:text-cyan hover:underline"
              >
                {t.checkout.pixSimulate}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (payMethod === "pix") {
                void startPix();
                return;
              }
              if (!connected) {
                connectWallet();
                return;
              }
              void contribute();
            }}
            disabled={loading || orderBusy}
            className="cta-pulse glow-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan to-neon px-6 py-3.5 text-sm font-medium text-onyx transition duration-300 hover:brightness-110 disabled:opacity-55"
          >
            {loading || orderBusy ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                {orderBusy ? t.checkout.creatingOrder : t.checkout.confirming}
              </>
            ) : payMethod === "pix" ? (
              t.checkout.payPix
            ) : connected ? (
              t.checkout.buySol
            ) : (
              t.checkout.connectWallet
            )}
          </button>
          <VisionDeliveryNotice className="mt-4" />

          <AnimatePresence>
            {status === "cancelled" ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-sm text-muted"
                role="status"
              >
                {translateError(t, error, MIN_SOL, errorDetail)}
              </motion.p>
            ) : null}
            {orderError ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-sm text-red-400"
                role="status"
              >
                {orderError}
              </motion.p>
            ) : null}
            {status === "error" && error ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-sm text-red-400"
                role="status"
              >
                {translateError(t, error, MIN_SOL, errorDetail)}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {t.checkout.legal}
          </p>
          <TrustBadges className="mt-5" />
        </article>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {PRESALE_TIERS.map((tier) => {
          const tokens = visionForUsd(tier.usd, tier.bonusPct);
          const selected = activeTier === tier.id;
          const copy = t.tiers[tier.id];
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
                  {copy.badge}
                </p>
                <h3 className="mt-2 font-display text-xl tracking-tight">
                  {tier.name}
                </h3>
                <p className="mt-2 font-display text-3xl tracking-tight text-cyan tabular">
                  {formatUsd(tier.usd, locale)}
                </p>
                <p className="mt-2 font-mono text-xs text-cyan/90">
                  {formatAmount(tokens, 0, locale)} {t.checkout.visionBonus}{" "}
                  {tier.bonusPct}%
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm leading-relaxed text-muted">
                  {[copy.perk1, copy.perk2].map((perk) => (
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
                  {t.checkout.select} {tier.name}
                </button>
              </article>
            </HoverLift>
          );
        })}
      </div>

      <CheckoutReceipt
        open={status === "success"}
        txHash={txHash}
        tierName={tierName}
        note={fulfillNote}
        onClose={reset}
      />
    </div>
  );
}
