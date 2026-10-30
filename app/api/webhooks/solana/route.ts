import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { fulfillApiBody, markPaidAndFulfill } from "@/lib/fulfill-vision";
import { verifySolPayment } from "@/lib/sol-payment";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Helius-style webhook: { signature } or { txs: [{ signature, memo }] }.
 */
export async function POST(request: Request) {
  const secret = process.env.SOLANA_WEBHOOK_SECRET?.trim();
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-webhook-secret") ??
    "";
  if (secret && header !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    signature?: string;
    orderId?: string;
    memo?: string;
    txs?: Array<{ signature?: string; memo?: string }>;
  };

  const events = body.txs?.length
    ? body.txs
    : [{ signature: body.signature, memo: body.memo ?? body.orderId }];

  const results = [];
  for (const event of events) {
    const signature = event.signature;
    if (!signature) continue;
    const orderId = (event.memo ?? body.orderId ?? "").trim();
    if (!orderId) continue;
    const order = await getOrder(orderId);
    if (!order || order.method !== "sol") continue;
    const verified = await verifySolPayment({
      signature,
      orderId: order.id,
      expectedLamports: order.solLamports,
    });
    if (!verified.ok) {
      console.log("[solana-webhook] verification failed", {
        orderId: order.id,
        signature,
        reason: verified.reason,
      });
      results.push({ signature, error: verified.reason });
      continue;
    }
    try {
      const fulfilled = await markPaidAndFulfill(order.id, {
        solSignature: signature,
        solLamports: verified.lamports,
      });
      const payload = fulfillApiBody(fulfilled, signature);
      console.log("[solana-webhook] fulfill result", {
        orderId: fulfilled.order.id,
        status: fulfilled.order.status,
        skipped: payload.skipped,
        txHash: payload.txHash,
        error: payload.error,
        detail: payload.detail,
      });
      results.push({ signature, ...payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[solana-webhook] fulfillment threw", {
        orderId: order.id,
        signature,
        name: error instanceof Error ? error.name : "unknown",
        message,
      });
      results.push({ signature, error: "fulfill_failed", detail: message });
    }
  }

  return NextResponse.json({ results });
}
