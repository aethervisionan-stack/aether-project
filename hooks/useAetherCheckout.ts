"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import {
  FALLBACK_SOL_USD,
  MIN_SOL,
  SQUADS_MULTISIG,
} from "@/lib/presale";
import { requestWalletSession, type WalletBrand } from "@/lib/site";
import { Buffer } from "buffer";
import { rpcWithFallback } from "@/lib/solana";
import { MEMO_PROGRAM_ID } from "@/lib/memo";

export type CheckoutStatus =
  | "idle"
  | "pending"
  | "success"
  | "cancelled"
  | "error";

const TREASURY = new PublicKey(SQUADS_MULTISIG);
const FEE_BUFFER_LAMPORTS = Math.floor(0.005 * LAMPORTS_PER_SOL);
const COMPUTE_UNIT_LIMIT = 200_000;
const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 100_000;
const MAX_ERROR_DETAIL = 480;

function unwrapErrors(error: unknown): unknown[] {
  const seen: unknown[] = [];
  const queue: unknown[] = [error];
  while (queue.length) {
    const current = queue.shift();
    if (current == null || seen.includes(current)) continue;
    seen.push(current);
    if (typeof current === "object") {
      const nested = current as { cause?: unknown; error?: unknown };
      if (nested.cause) queue.push(nested.cause);
      if (nested.error) queue.push(nested.error);
    }
  }
  return seen;
}

function asSendTransactionError(
  error: unknown,
): SendTransactionError | null {
  for (const candidate of unwrapErrors(error)) {
    if (candidate instanceof SendTransactionError) return candidate;
    if (
      candidate &&
      typeof candidate === "object" &&
      "getLogs" in candidate &&
      typeof (candidate as SendTransactionError).getLogs === "function"
    ) {
      return candidate as SendTransactionError;
    }
  }
  return null;
}

function formatErrorDetail(error: unknown, logs: string[] | null): string {
  const fromLogs = logs
    ?.filter((line) => /error|failed|insufficient|custom program/i.test(line))
    .slice(-6)
    .join(" | ");
  if (fromLogs) return fromLogs.slice(0, MAX_ERROR_DETAIL);

  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_DETAIL);
}

export type CheckoutErrorCode =
  | "wallet_missing"
  | "min_sol"
  | "invalid_sol"
  | "cancelled"
  | "insufficient"
  | "simulation"
  | "generic";

function classifyError(error: unknown, hasLogs: boolean): {
  status: "cancelled" | "error";
  code: CheckoutErrorCode;
} {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (
    /WalletSignTransactionError|user rejected|user denied|user cancelled|rejected the request|declined/i.test(
      message,
    )
  ) {
    return { status: "cancelled", code: "cancelled" };
  }
  if (/insufficient|0x1\b|custom program error: 0x1/i.test(message)) {
    return { status: "error", code: "insufficient" };
  }
  if (hasLogs || /simulation/i.test(message)) {
    return { status: "error", code: "simulation" };
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
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
    setErrorDetail(null);
    setStatus("idle");
    setTierName(null);
  }, []);

  const solForUsd = useCallback(
    (usd: number) => (solUsd > 0 ? usd / solUsd : 0),
    [solUsd],
  );

  const connectWallet = useCallback(
    (preferred: WalletBrand = "phantom") => {
      setError(null);
      setErrorDetail(null);
      setStatus("idle");
      return requestWalletSession(() => setVisible(true), preferred);
    },
    [setVisible],
  );

  const handlePurchase = useCallback(
    async (name: string, priceInSol: number, memo?: string) => {
      setError(null);
      setErrorDetail(null);
      setTxHash(null);
      setTierName(name);

      if (!connected || !publicKey) {
        connectWallet("phantom");
        return null;
      }

      if (!Number.isFinite(priceInSol) || priceInSol < MIN_SOL) {
        setStatus("error");
        setError("min_sol");
        return null;
      }

      const lamports = Math.floor(priceInSol * LAMPORTS_PER_SOL);
      if (!Number.isSafeInteger(lamports) || lamports <= 0) {
        setStatus("error");
        setError("invalid_sol");
        return null;
      }

      setLoading(true);
      setStatus("pending");

      try {
        const { value: balance, connection: fundedConnection } =
          await rpcWithFallback(connection, (rpc) =>
            rpc.getBalance(publicKey, "confirmed"),
          );
        if (balance < lamports + FEE_BUFFER_LAMPORTS) {
          setStatus("error");
          setError("insufficient");
          setErrorDetail(
            "Insufficient SOL balance for transaction and network fees.",
          );
          return null;
        }

        const {
          value: { blockhash, lastValidBlockHeight },
          connection: rpc,
        } = await rpcWithFallback(fundedConnection, (next) =>
          next.getLatestBlockhash("confirmed"),
        );

        const transaction = new Transaction().add(
          ComputeBudgetProgram.setComputeUnitLimit({
            units: COMPUTE_UNIT_LIMIT,
          }),
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
          }),
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: TREASURY,
            lamports,
          }),
        );
        if (memo?.trim()) {
          transaction.add(
            new TransactionInstruction({
              keys: [],
              programId: MEMO_PROGRAM_ID,
              data: Buffer.from(memo.trim(), "utf8"),
            }),
          );
        }
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;

        const { value: signature, connection: sending } = await rpcWithFallback(
          rpc,
          (next) => sendTransaction(transaction, next),
        );

        const { value: confirmation } = await rpcWithFallback(sending, (next) =>
          next.confirmTransaction(
            {
              signature,
              blockhash,
              lastValidBlockHeight,
            },
            "confirmed",
          ),
        );

        if (confirmation.value.err) {
          const detail = JSON.stringify(confirmation.value.err);
          setStatus("error");
          setError("generic");
          setErrorDetail(detail.slice(0, MAX_ERROR_DETAIL));
          return null;
        }

        setTxHash(signature);
        setStatus("success");
        return signature;
      } catch (caught) {
        const sendError = asSendTransactionError(caught);
        let logs: string[] | null = null;
        if (sendError) {
          try {
            const { value } = await rpcWithFallback(connection, (rpc) =>
              sendError.getLogs(rpc),
            );
            logs = value;
          } catch {
            logs = sendError.logs ?? null;
          }
          console.error("Solana Simulation Logs:", logs);
        }

        const mapped = classifyError(caught, Boolean(logs?.length));
        setStatus(mapped.status);
        setError(mapped.code);
        setErrorDetail(
          mapped.code === "cancelled"
            ? null
            : formatErrorDetail(caught, logs),
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [connectWallet, connected, connection, publicKey, sendTransaction],
  );

  return {
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
    solForUsd,
  };
}
