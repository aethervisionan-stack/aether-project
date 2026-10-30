import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { markPaidAndFulfill } from "@/lib/fulfill-vision";
import { toPublicOrder } from "@/lib/public-order";
import { verifySolPayment } from "@/lib/sol-payment";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

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

  let body: { signature?: string };
  try {
    body = (await request.json()) as { signature?: string };
  } catch (error) {
    console.error("[sol-paid] invalid JSON body", errorLog(error));
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
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

  let verified: Awaited<ReturnType<typeof verifySolPayment>>;
  try {
    verified = await verifySolPayment({
      signature: body.signature,
      orderId: order.id,
      expectedLamports: order.solLamports,
    });
  } catch (error) {
    console.error("[sol-paid] Solana RPC error while verifying payment", {
      orderId: order.id,
      signature: body.signature,
      ...errorLog(error),
    });
    return NextResponse.json(
      { error: "solana_rpc_error", detail: errorLog(error).message },
      { status: 503 },
    );
  }

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
    solPaid: verified.lamports / 1_000_000_000,
    solscan: `https://solscan.io/tx/${body.signature}`,
  });

  try {
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
      visionAmount: result.order.visionAmount,
    });
    return NextResponse.json({
      order: toPublicOrder(result.order),
      skipped: result.skipped ?? null,
    });
  } catch (error) {
    console.error("[sol-paid] fulfillment threw", {
      orderId: order.id,
      signature: body.signature,
      ...errorLog(error),
    });
    return NextResponse.json(
      {
        error: "fulfill_failed",
        detail: errorLog(error).message,
      },
      { status: 502 },
    );
  }
}
