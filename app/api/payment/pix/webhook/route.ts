import { NextResponse } from "next/server";
import { iqUnlockAmountCentavos } from "@/lib/iq-payment/config";
import { isInfinitePayPaidStatus } from "@/lib/iq-payment/infinitepay-pix";
import {
  extractSessionIdFromOrderNsu,
  getIqUnlockByOrderNsu,
  getIqUnlockByPaymentId,
  getIqUnlockSession,
  markIqSessionPaid,
} from "@/lib/iq-payment/sessionUnlock";
import {
  claimWebhookIdempotency,
  getInfinitePayOrderAsync,
  markInfinitePayPaidAsync,
  putInfinitePayOrderAsync,
} from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function looksPaid(body: Record<string, unknown>): boolean {
  if (body.paid === true) return true;
  const event = String(
    body.event ?? body.type ?? body.status ?? body.action ?? "",
  ).toLowerCase();
  return isInfinitePayPaidStatus(event) || event === "payment.paid";
}

/**
 * InfinitePay Pix webhook for IQ unlock.
 * Accepts InfinitePay { order_nsu, paid/settled, … } payloads.
 * Always acknowledges 200 so InfinitePay does not retry forever on unknown events.
 */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const order_nsu =
      pickString(body.order_nsu) ||
      pickString(body.orderNsu) ||
      pickString(body.paymentId) ||
      pickString(body.id);
    const transaction_nsu =
      pickString(body.transaction_nsu) || pickString(body.transactionNsu);
    const slug =
      pickString(body.invoice_slug) ||
      pickString(body.slug) ||
      pickString(body.invoiceSlug);

    if (!order_nsu) {
      return NextResponse.json({ ok: true, ignored: true, reason: "no_id" });
    }

    const idemKey = `iq-pix:${transaction_nsu || (slug ? `${order_nsu}:${slug}` : order_nsu)}`;
    if (claimWebhookIdempotency(idemKey)) {
      return NextResponse.json({ ok: true, received: true, duplicate: true });
    }

    if (!looksPaid(body)) {
      return NextResponse.json({
        ok: true,
        order_nsu,
        unlocked: false,
        status: "pending",
      });
    }

    const existing = await getInfinitePayOrderAsync(order_nsu);
    if (existing) {
      await markInfinitePayPaidAsync(order_nsu, {
        transaction_nsu: transaction_nsu ?? undefined,
        slug: slug ?? undefined,
      });
    } else {
      const sessionGuess =
        extractSessionIdFromOrderNsu(order_nsu) ??
        order_nsu.split("__")[1] ??
        "webhook";
      await putInfinitePayOrderAsync({
        order_nsu,
        tier: "iq_unlock",
        sessionId: sessionGuess,
        amountCentavos:
          typeof body.amount === "number"
            ? body.amount
            : iqUnlockAmountCentavos(),
        status: "paid",
        paidAt: Date.now(),
        transaction_nsu: transaction_nsu ?? undefined,
        slug: slug ?? undefined,
        createdAt: Date.now(),
      });
    }

    let sessionId =
      (await getIqUnlockByOrderNsu(order_nsu))?.sessionId ||
      (await getIqUnlockByPaymentId(order_nsu))?.sessionId ||
      extractSessionIdFromOrderNsu(order_nsu) ||
      existing?.sessionId ||
      null;

    if (!sessionId || !/^iq_[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({
        ok: true,
        order_nsu,
        unlocked: false,
        reason: "session_not_found",
      });
    }

    const unlockRow = await getIqUnlockSession(sessionId);
    await markIqSessionPaid(sessionId, {
      paymentId: order_nsu,
      order_nsu,
      transaction_nsu: transaction_nsu ?? undefined,
      slug: slug ?? undefined,
      amountCentavos:
        typeof body.amount === "number"
          ? body.amount
          : unlockRow?.amountCentavos ?? iqUnlockAmountCentavos(),
      simulated: false,
    });

    return NextResponse.json({
      ok: true,
      order_nsu,
      sessionId,
      unlocked: true,
    });
  } catch (err) {
    console.error("[iq-pix-webhook]", err);
    // Still 200 — avoid infinite retries; status polling will reconcile.
    return NextResponse.json({
      ok: true,
      error: err instanceof Error ? err.message : "webhook_error",
    });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
