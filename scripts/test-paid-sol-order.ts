/**
 * Quotes $VISION for a paid SOL amount (default 0.05) and optionally sends it.
 *
 * Dry-run (no chain send):
 *   npx tsx scripts/test-paid-sol-order.ts --sol 0.05
 *
 * Live send (requires valid secrets/mint-authority.json):
 *   npx tsx scripts/test-paid-sol-order.ts --sol 0.05 --send --dest <BUYER_PUBKEY>
 */
import "dotenv/config";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { quoteVisionForLamports } from "../lib/vision-pricing";
import { createOrder, updateOrder } from "../lib/orders";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const solPaid = Number(flag("sol") ?? "0.05");
  if (!Number.isFinite(solPaid) || solPaid <= 0) {
    throw new Error("--sol must be a positive number");
  }
  const lamports = Math.floor(solPaid * LAMPORTS_PER_SOL);
  const dest =
    flag("dest") ||
    process.env.PHANTOM_OWNER?.trim() ||
    "9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911";
  const send = hasFlag("send");

  const quote = await quoteVisionForLamports({ lamports, tierId: null });
  const expectedFromSol = quote.solPaid / quote.priceVisionSol;
  const ok =
    Math.abs(quote.visionBase - expectedFromSol) / expectedFromSol < 1e-9;

  console.log("[quote] mode", quote.mode);
  console.log("[quote] SOL paid", quote.solPaid);
  console.log("[quote] SOL/USD", quote.solUsd, `(${quote.solUsdSource})`);
  console.log("[quote] price / VISION", quote.priceVisionSol, "SOL");
  console.log("[quote] price / VISION", `$${quote.priceVisionUsd}`);
  console.log("[quote] VISION base", quote.visionBase);
  console.log("[quote] bonus %", quote.bonusPct);
  console.log("[quote] VISION to send", quote.visionUi);
  console.log("[quote] proportion check", ok ? "PASS" : "FAIL");
  if (quote.mode === "raydium") {
    console.log(
      "[quote] Raydium reserves",
      quote.raydiumVisionReserve,
      "VISION /",
      quote.raydiumSolReserve,
      "SOL",
    );
  }

  if (!send) {
    console.log("[dry-run] no SPL transaction sent");
    console.log(
      "[dry-run] to send on-chain after a real treasury payment, use the landing checkout or:",
    );
    console.log(
      "  npx tsx scripts/test-fulfillment.ts --replay-order <ORDER_ID> --sol-signature <SOL_TX>",
    );
    if (!ok) process.exitCode = 1;
    return;
  }

  const order = await createOrder({
    method: "sol",
    destPubkey: dest,
    usd: quote.solPaid * quote.solUsd,
    solLamports: lamports,
    visionAmount: quote.visionUi,
    tierName: "test 0.05 SOL",
  });
  await updateOrder(order.id, { status: "paid" });
  console.log("[send] order", order.id, "dest", dest, "visionUi", quote.visionUi);

  const { fulfillVisionOrder } = await import("../lib/fulfill-vision");
  const result = await fulfillVisionOrder(order.id);
  console.log("[send] status", result.order.status);
  console.log("[send] skipped", result.skipped ?? "none");
  if (result.order.splSignature) {
    console.log("[send] solscan", `https://solscan.io/tx/${result.order.splSignature}`);
  }
  if (result.order.fulfillError) {
    console.log("[send] fulfillError", result.order.fulfillError);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
