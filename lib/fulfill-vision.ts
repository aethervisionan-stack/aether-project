import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { parseMintAddress } from "@/lib/token-guard";
import { loadDistributionKeypair } from "@/lib/secret-keypair";
import { getOrder, updateOrder, type VisionOrder } from "@/lib/orders";
import {
  describeSolanaSendError,
  sendAndConfirmWithFreshBlockhash,
} from "@/lib/send-with-blockhash";
import { quoteVisionForLamports, quoteVisionForSol, fetchSolUsd, bonusPctForTier } from "@/lib/vision-pricing";
import type { VisionQuote } from "@/lib/vision-pricing";
import { SQUADS_VAULT } from "@/lib/presale";
import { executeWithRpcFallback } from "@/lib/solana";
import { toPublicOrder } from "@/lib/public-order";

const COMPUTE_UNIT_LIMIT = 300_000;
const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 1_000_000;
const MIN_FEE_SOL = 0.005;
const SQUADS = new PublicKey(SQUADS_VAULT);

function log(scope: string, message: string, extra?: Record<string, unknown>) {
  if (extra) {
    console.log(`[${scope}] ${message}`, extra);
    return;
  }
  console.log(`[${scope}] ${message}`);
}

function logError(scope: string, message: string, extra?: Record<string, unknown>) {
  if (extra) {
    console.error(`[${scope}] ${message}`, extra);
    return;
  }
  console.error(`[${scope}] ${message}`);
}

function uiAmount(raw: bigint | number | string, decimals: number): number {
  return Number(BigInt(raw.toString())) / 10 ** decimals;
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

export function fulfillApiBody(result: FulfillResult, solSignature?: string | null) {
  const spl = result.order.splSignature;
  const skipped = result.skipped ?? null;
  const deliveryFailed =
    Boolean(result.order.fulfillError) ||
    Boolean(skipped && skipped !== "already_fulfilled");
  return {
    order: toPublicOrder(result.order),
    txHash: spl ?? null,
    solSignature: result.order.solSignature ?? solSignature ?? null,
    splSignature: spl ?? null,
    skipped,
    error: deliveryFailed ? (skipped ?? "fulfill_failed") : null,
    detail: result.order.fulfillError ?? null,
  };
}

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

  let connection;
  let tokenProgram: PublicKey;
  let mintInfo;
  try {
    const live = await executeWithRpcFallback(async (rpc) => {
      const mintAccount = await rpc.getAccountInfo(mint, "confirmed");
      if (!mintAccount) {
        throw new TypeError(`TOKEN_MINT ${mint.toBase58()} account not found`);
      }
      const info = await getMint(rpc, mint, "confirmed", mintAccount.owner);
      return { tokenProgram: mintAccount.owner, mintInfo: info };
    });
    connection = live.connection;
    tokenProgram = live.result.tokenProgram;
    mintInfo = live.result.mintInfo;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("fulfill", "no live Solana RPC for SPL transfer", {
      orderId,
      err: message,
    });
    throw new Error(`solana_rpc_error: ${message}`);
  }
  const destOwner = new PublicKey(order.destPubkey);
  const sourceAta = await getAssociatedTokenAddress(
    mint,
    payer.publicKey,
    false,
    tokenProgram,
  );
  const destAta = await getAssociatedTokenAddress(
    mint,
    destOwner,
    false,
    tokenProgram,
  );
  const squadsAta = await getAssociatedTokenAddress(
    mint,
    SQUADS,
    true,
    tokenProgram,
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
    tokenProgram: tokenProgram.toBase58(),
    signer: payer.publicKey.toBase58(),
    to: destOwner.toBase58(),
    sourceAta: sourceAta.toBase58(),
    destAta: destAta.toBase58(),
    squadsAta: squadsAta.toBase58(),
    rpc: connection.rpcEndpoint,
    solSignature: order.solSignature,
  });

  const payerLamports = await connection.getBalance(payer.publicKey, "confirmed");
  const payerSol = payerLamports / LAMPORTS_PER_SOL;
  log("fulfill", "distribution wallet SOL (fees + ATA rent)", {
    pubkey: payer.publicKey.toBase58(),
    sol: payerSol,
    minFeeSol: MIN_FEE_SOL,
  });
  if (payerSol < MIN_FEE_SOL) {
    const message = `Distribution wallet ${payer.publicKey.toBase58()} has ${payerSol} SOL; need >= ${MIN_FEE_SOL} SOL for fees and ATA rent-exemption.`;
    logError("fulfill", message, { orderId, payerLamports });
    const next = await updateOrder(orderId, { fulfillError: message });
    return { order: next ?? order, skipped: "insufficient_sol_fees" };
  }

  const source = await getAccount(
    connection,
    sourceAta,
    "confirmed",
    tokenProgram,
  ).catch(() => null);
  const sourceUi = source ? uiAmount(source.amount.toString(), mintInfo.decimals) : 0;
  const squadsAccount = await getAccount(
    connection,
    squadsAta,
    "confirmed",
    tokenProgram,
  ).catch(() => null);
  const squadsUi = squadsAccount
    ? uiAmount(squadsAccount.amount.toString(), mintInfo.decimals)
    : 0;
  log("fulfill", "token account balances", {
    sourceExists: Boolean(source),
    sourceUi,
    squadsExists: Boolean(squadsAccount),
    squadsUi,
  });

  if (!source || BigInt(source.amount.toString()) < rawAmount) {
    const message =
      squadsUi > 0
        ? `$VISION float is in Squads vault ATA ${squadsAta.toBase58()} (${squadsUi} tokens). Auto-fulfill signs with ${payer.publicKey.toBase58()} (ATA ${sourceAta.toBase58()} has ${sourceUi}). A Squads vault cannot be spent with MINT_AUTHORITY_SECRET. Move a $VISION float from Squads to the distribution wallet, then replay this order.`
        : `Distribution ATA ${sourceAta.toBase58()} missing or insufficient $VISION (have ${sourceUi}, need ${visionUi}).`;
    logError("fulfill", message, {
      orderId,
      neededUi: visionUi,
      haveUi: sourceUi,
      squadsUi,
    });
    const next = await updateOrder(orderId, { fulfillError: message });
    return { order: next ?? order, skipped: "insufficient_float" };
  }

  let destExists = true;
  try {
    await getAccount(connection, destAta, "confirmed", tokenProgram);
  } catch {
    destExists = false;
  }
  if (destExists) {
    log("fulfill", "buyer ATA exists", { destAta: destAta.toBase58() });
  } else {
    log("fulfill", "creating buyer ATA (payer covers rent-exemption)", {
      destAta: destAta.toBase58(),
      destOwner: destOwner.toBase58(),
      mint: mint.toBase58(),
      tokenProgram: tokenProgram.toBase58(),
    });
  }

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
        tokenProgram,
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
      tokenProgram,
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
    const described = await describeSolanaSendError(error, connection);
    const detail = [
      described.kind,
      described.name,
      described.message,
      described.logs?.slice(-8).join(" | "),
    ]
      .filter(Boolean)
      .join(" — ");
    logError("fulfill", "on-chain SPL error — SOL stays paid, VISION not sent", {
      orderId,
      kind: described.kind,
      name: described.name,
      message: described.message,
      logs: described.logs,
      destExists,
      payerSol,
    });
    const next = await updateOrder(orderId, {
      fulfillError: `SPL transfer failed: ${detail}`,
    });
    return { order: next ?? order, skipped: described.kind };
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
