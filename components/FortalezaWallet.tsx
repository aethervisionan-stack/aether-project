"use client";

import {
  getOrCreateLocalWallet,
  getSolBalance,
  getVisionBalance,
  shortenAddress,
  TREASURY_WALLET,
} from "@/lib/solana";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, LoaderCircle, RefreshCw, Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

function formatBalance(value: number | null, digits = 4): string {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function FortalezaWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [vision, setVision] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"wallet" | "treasury" | null>(null);

  const refreshBalances = useCallback(async (pubkey: string, soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [solBal, visionBal] = await Promise.all([
        getSolBalance(pubkey),
        getVisionBalance(pubkey),
      ]);
      setSol(solBal);
      setVision(visionBal);
    } catch (err) {
      console.warn("[Fortaleza] balance refresh failed", err);
      setError("Não foi possível atualizar os saldos. Tente novamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    try {
      const keypair = getOrCreateLocalWallet();
      const pubkey = keypair.publicKey.toBase58();
      setAddress(pubkey);
      void refreshBalances(pubkey);
    } catch (err) {
      console.warn("[Fortaleza] wallet init failed", err);
      setError("Falha ao inicializar a Fortaleza Wallet neste dispositivo.");
      setLoading(false);
    }
  }, [refreshBalances]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onCopyWallet = async () => {
    if (!address) return;
    if (await copyText(address)) setCopied("wallet");
  };

  const onCopyTreasury = async () => {
    if (await copyText(TREASURY_WALLET)) setCopied("treasury");
  };

  return (
    <section
      id="fortaleza"
      className="relative z-30 border-b border-white/10 bg-[linear-gradient(180deg,rgba(6,182,212,0.06),transparent)]"
      aria-label="Fortaleza Wallet"
    >
      <div className="mx-auto max-w-6xl px-5 py-5">
        <div className="glass overflow-hidden rounded-[1.5rem] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm tracking-tight text-ink sm:text-base">
                  Fortaleza Wallet
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/25 bg-cyan/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan">
                  <Shield size={11} aria-hidden />
                  100% Auto-Custódia • Chaves Criptografadas no Dispositivo
                </span>
              </div>
              <p className="mt-2 font-mono text-xs text-muted sm:text-sm">
                {address ? shortenAddress(address, 4) : "Gerando carteira…"}
                {address ? (
                  <span className="ml-2 hidden text-[11px] text-muted/80 sm:inline">
                    {address}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-4 sm:gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  SOL
                </p>
                <p className="mt-1 font-mono text-lg tabular text-ink">
                  {loading && sol == null ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin text-cyan"
                    />
                  ) : (
                    formatBalance(sol)
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  $VISION
                </p>
                <p className="mt-1 font-mono text-lg tabular text-cyan">
                  {loading && vision == null ? (
                    <LoaderCircle
                      size={16}
                      className="animate-spin text-cyan"
                    />
                  ) : (
                    formatBalance(vision, 2)
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onCopyWallet()}
              disabled={!address}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-ink transition hover:border-cyan/40 hover:text-cyan disabled:opacity-40"
            >
              {copied === "wallet" ? <Check size={13} /> : <Copy size={13} />}
              Copiar carteira local
            </button>
            <button
              type="button"
              onClick={() => void onCopyTreasury()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-ink transition hover:border-cyan/40 hover:text-cyan"
            >
              {copied === "treasury" ? <Check size={13} /> : <Copy size={13} />}
              Copiar tesouraria (pré-venda)
            </button>
            <button
              type="button"
              onClick={() => address && void refreshBalances(address, true)}
              disabled={!address || refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan to-neon px-3 py-1.5 text-xs font-medium text-onyx transition hover:brightness-110 disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={refreshing ? "animate-spin" : undefined}
              />
              Atualizar saldos
            </button>
          </div>

          <p className="mt-3 text-[11px] text-muted">
            Tesouraria:{" "}
            <span className="font-mono text-ink/80">
              {shortenAddress(TREASURY_WALLET, 4)}
            </span>
          </p>

          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 text-xs text-violet"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
