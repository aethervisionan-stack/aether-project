import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  type TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { parseMintAddress } from "@/lib/token-guard";
import { loadDistributionKeypair } from "@/lib/secret-keypair";
import { getOrder, updateOrder, type VisionOrder } from "@/lib/orders";
import { sendAndConfirmWithFreshBlockhash } from "@/lib/send-with-blockhash";
import { quoteVisionForLamports, quoteVisionForSol, fetchSolUsd, bonusPctForTier } from "@/lib/vision-pricing";
import type { VisionQuote } from "@/lib/vision-pricing";

const COMPUTE_UNIT_LIMIT = 300_000;
const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 1_000_000;

function log(scope: string, message: string, extra?: Record<string, unknown>) {
  if (extra) {
    console.log(`[${scope}] ${message}`, extra);
    return;
  }
  console.log(`[${scope}] ${message}`);
}

function uiToRaw(amount: number, decimals: number): bigint {
  const [whole, frac = ""] = amount.toFixed(decimals).split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0");
}

export async function quoteForFulfillment(
  order: VisionOrder,
  paidLamports?: number | null,
): Promise<VisionQuote> {
  const lamports = paidLamports ?? order.solLamports;
  if (order.method === "sol") {
    if (!lamports || lamports <= 0) {
      throw new Error(
        "SOL order has no verified lamports from the Squads treasury transfer",
      );
    }
    const quote = await quoteVisionForLamports({
      lamports,
      tierId: order.tierId,
    });
    log("fulfill", "VISION amount from SOL received at treasury", {
      orderId: order.id,
      paidLamports: lamports,
      solPaid: quote.solPaid,
      solUsd: quote.solUsd,
      solUsdSource: quote.solUsdSource,
      bonusPct: quote.bonusPct,
      checkoutVisionAmount: order.visionAmount,
      visionUi: quote.visionUi,
    });
    return quote;
  }
  const sol = await fetchSolUsd();
  const solPaid = order.usd > 0 ? order.usd / sol.usd : 0;
  return quoteVisionForSol({
    solPaid,
    bonusPct: bonusPctForTier(order.tierId),
    solUsd: sol.usd,
    solUsdSource: sol.source,
  });
}

export type FulfillResult = {
  order: VisionOrder;
  skipped?: string;
};

export async function fulfillVisionOrder(orderId: string): Promise<FulfillResult> {
  const order = await getOrder(orderId);
  if (!order) {
    throw new Error("Order not found");
  }
  if (order.status === "fulfilled" && order.splSignature) {
    log("fulfill", "already fulfilled — skipping duplicate send", {
      orderId,
      splSignature: order.splSignature,
    });
    return { order, skipped: "already_fulfilled" };
  }
  if (order.status !== "paid") {
    throw new Error(`Order is ${order.status}, expected paid`);
  }

  let payer;
  try {
    payer = loadDistributionKeypair();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("fulfill", "keypair missing or invalid — SOL is recorded, SPL not sent", {
      orderId,
      hint: "Export the Phantom that holds $VISION into secrets/mint-authority.json (64-byte JSON array).",
      error: message,
    });
    const next = await updateOrder(orderId, {
      fulfillError: `Keypair unavailable: ${message}`,
    });
    return { order: next ?? order, skipped: "no_hot_wallet" };
  }

  const mint = parseMintAddress(process.env.TOKEN_MINT);
  const quote = await quoteForFulfillment(order, order.solLamports);
  const visionUi = quote.visionUi;
  if (!Number.isFinite(visionUi) || visionUi <= 0) {
    throw new Error("Cannot compute $VISION amount for this order");
  }

  const rpc =
    process.env.SOLANA_RPC_URL?.trim() ||
    clusterApiUrl(
      (process.env.SOLANA_CLUSTER as "mainnet-beta" | "devnet" | "testnet") ??
        "mainnet-beta",
    );
  const connection = new Connection(rpc, { commitment: "confirmed" });
  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
  const destOwner = new PublicKey(order.destPubkey);
  const sourceAta = await getAssociatedTokenAddress(
    mint,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  const destAta = await getAssociatedTokenAddress(
    mint,
    destOwner,
    false,
    TOKEN_PROGRAM_ID,
  );
  const rawAmount = uiToRaw(visionUi, mintInfo.decimals);

  log("fulfill", "preparing SPL transfer", {
    orderId,
    method: order.method,
    paidUsd: order.usd,
    solPaid: quote.solPaid,
    pricing: quote.mode,
    priceVisionSol: quote.priceVisionSol,
    priceVisionUsd: quote.priceVisionUsd,
    solUsd: quote.solUsd,
    bonusPct: quote.bonusPct,
    visionUi,
    decimals: mintInfo.decimals,
    rawAmount: rawAmount.toString(),
    mint: mint.toBase58(),
    from: payer.publicKey.toBase58(),
    to: destOwner.toBase58(),
    sourceAta: sourceAta.toBase58(),
    destAta: destAta.toBase58(),
    solSignature: order.solSignature,
  });

  const source = await getAccount(
    connection,
    sourceAta,
    "confirmed",
    TOKEN_PROGRAM_ID,
  ).catch(() => null);
  const sourceUi = source
    ? Number(BigInt(source.amount.toString())) / 10 ** mintInfo.decimals
    : 0;
  log("fulfill", "source ATA balance", {
    exists: Boolean(source),
    ui: sourceUi,
  });

  if (!source || BigInt(source.amount.toString()) < rawAmount) {
    const message =
      "Phantom ATA missing or insufficient $VISION. Transfer not sent; payment stays paid.";
    log("fulfill", message, { neededUi: visionUi, haveUi: sourceUi });
    const next = await updateOrder(orderId, { fulfillError: message });
    return { order: next ?? order, skipped: "insufficient_float" };
  }

  let destExists = true;
  try {
    await getAccount(connection, destAta, "confirmed", TOKEN_PROGRAM_ID);
  } catch {
    destExists = false;
  }
  log("fulfill", destExists ? "buyer ATA exists" : "will create buyer ATA");

  const instructions: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
    }),
  ];
  if (!destExists) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        destAta,
        destOwner,
        mint,
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  instructions.push(
    createTransferInstruction(
      sourceAta,
      destAta,
      payer.publicKey,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  let signature: string;
  try {
    signature = await sendAndConfirmWithFreshBlockhash(
      connection,
      payer,
      instructions,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log("fulfill", "on-chain SPL error — SOL stays paid, VISION not sent", {
      orderId,
      name: error instanceof Error ? error.name : "unknown",
      err: detail,
    });
    const next = await updateOrder(orderId, {
      fulfillError: `SPL transfer failed: ${detail}`,
    });
    return { order: next ?? order, skipped: "spl_failed" };
  }

  log("fulfill", "confirmed — $VISION sent", {
    orderId,
    visionUi,
    to: destOwner.toBase58(),
    signature,
    solscanTx: `https://solscan.io/tx/${signature}`,
    solscanToken: `https://solscan.io/token/${mint.toBase58()}`,
  });

  const next = await updateOrder(orderId, {
    status: "fulfilled",
    visionAmount: visionUi,
    splSignature: signature,
    fulfillError: null,
  });
  return { order: next ?? { ...order, status: "fulfilled", splSignature: signature } };
}

export async function markPaidAndFulfill(
  orderId: string,
  paymentPatch: Partial<VisionOrder>,
): Promise<FulfillResult> {
  const existing = await getOrder(orderId);
  if (!existing) throw new Error("Order not found");
  if (existing.status === "fulfilled") {
    log("fulfill", "order already fulfilled", {
      orderId,
      splSignature: existing.splSignature,
    });
    return { order: existing, skipped: "already_fulfilled" };
  }
  if (existing.status !== "paid") {
    log("fulfill", "marking order paid", {
      orderId,
      method: existing.method,
      solSignature: paymentPatch.solSignature ?? existing.solSignature,
    });
    await updateOrder(orderId, { ...paymentPatch, status: "paid" });
  }
  return fulfillVisionOrder(orderId);
}
