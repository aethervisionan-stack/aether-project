import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { markPaidAndFulfill } from "@/lib/fulfill-vision";
import { toPublicOrder } from "@/lib/public-order";
import { verifySolPayment } from "@/lib/sol-payment";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    console.log("[sol-paid] order not found", { id });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.method !== "sol") {
    console.log("[sol-paid] rejected non-SOL order", { id, method: order.method });
    return NextResponse.json({ error: "not_sol_order" }, { status: 400 });
  }

  const body = (await request.json()) as { signature?: string };
  if (!body.signature) {
    return NextResponse.json({ error: "signature required" }, { status: 400 });
  }

  console.log("[sol-paid] verifying treasury deposit", {
    orderId: order.id,
    signature: body.signature,
    expectedLamports: order.solLamports,
    destPubkey: order.destPubkey,
    visionAmount: order.visionAmount,
  });

  const verified = await verifySolPayment({
    signature: body.signature,
    orderId: order.id,
    expectedLamports: order.solLamports,
  });
  if (!verified.ok) {
    console.log("[sol-paid] verification failed", {
      orderId: order.id,
      reason: verified.reason,
    });
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  console.log("[sol-paid] SOL confirmed — starting $VISION transfer", {
    orderId: order.id,
    paidLamports: verified.lamports,
    solscan: `https://solscan.io/tx/${body.signature}`,
  });

  const result = await markPaidAndFulfill(order.id, {
    solSignature: body.signature,
    solLamports: verified.lamports,
  });
  console.log("[sol-paid] fulfill result", {
    orderId: result.order.id,
    status: result.order.status,
    skipped: result.skipped ?? null,
    splSignature: result.order.splSignature,
    fulfillError: result.order.fulfillError,
  });
  return NextResponse.json({
    order: toPublicOrder(result.order),
    skipped: result.skipped ?? null,
  });
}
