import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { markPaidAndFulfill } from "@/lib/fulfill-vision";
import { toPublicOrder } from "@/lib/public-order";
import { verifySolPayment } from "@/lib/sol-payment";

export const runtime = "nodejs";

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
      results.push({ signature, error: verified.reason });
      continue;
    }
    const fulfilled = await markPaidAndFulfill(order.id, {
      solSignature: signature,
      solLamports: verified.lamports,
    });
    results.push({
      signature,
      order: toPublicOrder(fulfilled.order),
      skipped: fulfilled.skipped ?? null,
    });
  }

  return NextResponse.json({ results });
}
