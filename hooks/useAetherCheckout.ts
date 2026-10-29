"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import {
  FALLBACK_SOL_USD,
  MIN_SOL,
  SQUADS_MULTISIG,
} from "@/lib/presale";
import { hasInjectedSolanaWallet } from "@/lib/site";

export type CheckoutStatus =
  | "idle"
  | "pending"
  | "success"
  | "cancelled"
  | "error";

const TREASURY = new PublicKey(SQUADS_MULTISIG);

export type CheckoutErrorCode =
  | "wallet_missing"
  | "min_sol"
  | "invalid_sol"
  | "cancelled"
  | "insufficient"
  | "generic";

function classifyError(error: unknown): {
  status: "cancelled" | "error";
  code: CheckoutErrorCode;
} {
  const message = error instanceof Error ? error.message : "";
  const cancelledByUser =
    /reject|cancel|declin|user/i.test(message) ||
    message.includes("WalletSignTransactionError");
  if (cancelledByUser) {
    return { status: "cancelled", code: "cancelled" };
  }
  if (/insufficient|0x1\b|custom program error: 0x1/i.test(message)) {
    return { status: "error", code: "insufficient" };
  }
  return { status: "error", code: "generic" };
}

export function useAetherCheckout() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<CheckoutErrorCode | null>(null);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [tierName, setTierName] = useState<string | null>(null);
  const [solUsd, setSolUsd] = useState(FALLBACK_SOL_USD);

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      try {
        const response = await fetch("/api/sol-price", { cache: "no-store" });
        const data = (await response.json()) as { usd?: number };
        if (!cancelled && typeof data.usd === "number" && data.usd > 0) {
          setSolUsd(data.usd);
        }
      } catch {
        if (!cancelled) setSolUsd(FALLBACK_SOL_USD);
      }
    }

    void loadPrice();
    const interval = window.setInterval(() => void loadPrice(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setTxHash(null);
    setError(null);
    setStatus("idle");
    setTierName(null);
  }, []);

  const solForUsd = useCallback(
    (usd: number) => (solUsd > 0 ? usd / solUsd : 0),
    [solUsd],
  );

  const handlePurchase = useCallback(
    async (name: string, priceInSol: number) => {
      setError(null);
      setTxHash(null);
      setTierName(name);

      if (!connected || !publicKey) {
        if (!hasInjectedSolanaWallet()) {
          setStatus("error");
          setError("wallet_missing");
          return null;
        }
        setVisible(true);
        setStatus("idle");
        return null;
      }

      if (!Number.isFinite(priceInSol) || priceInSol < MIN_SOL) {
        setStatus("error");
        setError("min_sol");
        return null;
      }

      const lamports = Math.round(priceInSol * LAMPORTS_PER_SOL);
      if (lamports <= 0) {
        setStatus("error");
        setError("invalid_sol");
        return null;
      }

      setLoading(true);
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
        await connection.confirmTransaction(signature, "confirmed");
        setTxHash(signature);
        setStatus("success");
        return signature;
      } catch (caught) {
        const mapped = classifyError(caught);
        setStatus(mapped.status);
        setError(mapped.code);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connected, connection, publicKey, sendTransaction, setVisible],
  );

  return {
    loading,
    txHash,
    error,
    status,
    tierName,
    handlePurchase,
    reset,
    connected,
    publicKey,
    solUsd,
    solForUsd,
  };
}
