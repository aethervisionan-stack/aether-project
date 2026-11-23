import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { markPaidAndFulfill } from "@/lib/fulfill-vision";
import { pixConfig } from "@/lib/pix";
import { toPublicOrder } from "@/lib/public-order";

export const runtime = "nodejs";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Local/dev only. Simulates a PIX confirmation so the checkout UI can be tested.
 * Requires PIX_ALLOW_MOCK=true (non-production) and a matching shared secret.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "mock_pay_disabled" }, { status: 403 });
  }

  const pix = pixConfig();
  if (!pix.allowMock) {
    return NextResponse.json({ error: "mock_pay_disabled" }, { status: 403 });
  }

  const requiredSecret =
    process.env.MOCK_PAY_SECRET?.trim() || pix.webhookSecret;
  if (!requiredSecret) {
    return NextResponse.json(
      { error: "mock_pay_secret_required" },
      { status: 503 },
    );
  }
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-mock-pay-secret") ??
    "";
  if (!header || !safeEqual(header, requiredSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = await markPaidAndFulfill(order.id, {
    pixTxid: order.pixTxid,
  });
  return NextResponse.json({
    order: toPublicOrder(result.order),
    skipped: result.skipped ?? null,
  });
}
