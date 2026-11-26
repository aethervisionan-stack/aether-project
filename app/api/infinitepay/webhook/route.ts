import { NextResponse } from "next/server";
import { extractTierFromOrderNsu } from "@/lib/infinitepay/config";
import {
  claimWebhookIdempotency,
  getInfinitePayOrder,
  markInfinitePayPaid,
  putInfinitePayOrder,
} from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function looksPaid(body: Record<string, unknown>): boolean {
  if (body.paid === true) return true;
  const event = String(body.event ?? body.type ?? body.status ?? "").toLowerCase();
  return event === "paid" || event === "settled" || event === "payment.paid";
}

export async function POST(req: Request) {
  // Always acknowledge — InfinitePay retries non-2xx.
  let received = false;
  try {
    let raw: unknown = null;
    try {
      raw = await req.json();
      received = true;
    } catch {
      // safe parse failure — still 200
      return NextResponse.json({ ok: true, received: false });
    }

    const body =
      raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const order_nsu =
      pickString(body.order_nsu) || pickString(body.orderNsu);
    const transaction_nsu =
      pickString(body.transaction_nsu) || pickString(body.transactionNsu);
    const slug =
      pickString(body.invoice_slug) ||
      pickString(body.slug) ||
      pickString(body.invoiceSlug);

    const idemKey =
      transaction_nsu ||
      (order_nsu && slug ? `${order_nsu}:${slug}` : null) ||
      order_nsu ||
      JSON.stringify(body).slice(0, 200);

    const already = claimWebhookIdempotency(idemKey);
    if (already) {
      return NextResponse.json({ ok: true, received: true, duplicate: true });
    }

    // Optional payment_check confirmation when we have enough fields
    if (order_nsu && transaction_nsu && slug && looksPaid(body)) {
      try {
        const { infinitepayHandle, infinitepayApiKey, isRealApiKey } =
          await import("@/lib/infinitepay/config");
        const handle = infinitepayHandle();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        const key = infinitepayApiKey();
        if (isRealApiKey(key)) {
          headers.Authorization = `Bearer ${key}`;
          headers["X-Api-Key"] = key;
        }
        await fetch("https://api.checkout.infinitepay.io/payment_check", {
          method: "POST",
          headers,
          body: JSON.stringify({
            handle,
            order_nsu,
            transaction_nsu,
            slug,
          }),
        }).catch(() => null);
      } catch {
        // never fail webhook on check errors
      }
    }

    if (order_nsu && looksPaid(body)) {
      const existing = getInfinitePayOrder(order_nsu);
      if (existing) {
        markInfinitePayPaid(order_nsu, {
          transaction_nsu: transaction_nsu ?? undefined,
          slug: slug ?? undefined,
        });
      } else {
        const tier = extractTierFromOrderNsu(order_nsu) ?? "unknown";
        putInfinitePayOrder({
          order_nsu,
          tier,
          sessionId: order_nsu.split("__")[0] ?? "webhook",
          amountCentavos:
            typeof body.amount === "number" ? body.amount : 0,
          status: "paid",
          paidAt: Date.now(),
          transaction_nsu: transaction_nsu ?? undefined,
          slug: slug ?? undefined,
          createdAt: Date.now(),
        });
      }
    }

    return NextResponse.json({ ok: true, received });
  } catch {
    return NextResponse.json({ ok: true, received });
  }
}
