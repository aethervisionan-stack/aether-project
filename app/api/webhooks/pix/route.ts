import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { findOrderByPixTxid, getOrder } from "@/lib/orders";
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

export async function POST(request: Request) {
  const pix = pixConfig();
  const raw = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const headerSecret =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-pix-secret") ??
    "";
  const mpSignature = request.headers.get("x-signature") ?? "";

  if (pix.webhookSecret) {
    const hmac = createHmac("sha256", pix.webhookSecret).update(raw).digest("hex");
    const okHeader = headerSecret && safeEqual(headerSecret, pix.webhookSecret);
    const okHmac = mpSignature && safeEqual(mpSignature, hmac);
    if (!okHeader && !okHmac) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "PIX_WEBHOOK_SECRET required in production" },
      { status: 401 },
    );
  }

  const orderId = String(
    body.orderId ??
      body.txid ??
      (body.data as { id?: string } | undefined)?.id ??
      "",
  ).trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId or txid required" }, { status: 400 });
  }

  const order =
    (await getOrder(orderId)) ?? (await findOrderByPixTxid(orderId));
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await markPaidAndFulfill(order.id, {
    pixTxid: order.pixTxid ?? orderId,
  });
  return NextResponse.json({
    order: toPublicOrder(result.order),
    skipped: result.skipped ?? null,
  });
}
