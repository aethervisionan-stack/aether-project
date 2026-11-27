import { NextResponse } from "next/server";
import {
  iqAmountCentavosForItemType,
  iqUnlockAmountCentavos,
} from "@/lib/iq-payment/config";
import {
  extractItemTypeFromOrderNsu,
  extractSessionIdFromOrderNsu,
  getIqUnlockByOrderNsu,
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
      `iq:${transaction_nsu || (order_nsu && slug ? `${order_nsu}:${slug}` : null) || order_nsu || JSON.stringify(body).slice(0, 200)}`;

    const already = claimWebhookIdempotency(idemKey);
    if (already) {
      return NextResponse.json({ ok: true, received: true, duplicate: true });
    }

    if (order_nsu && looksPaid(body)) {
      const existing = await getInfinitePayOrderAsync(order_nsu);
      if (existing) {
        await markInfinitePayPaidAsync(order_nsu, {
          transaction_nsu: transaction_nsu ?? undefined,
          slug: slug ?? undefined,
        });
      } else {
        const sessionId =
          extractSessionIdFromOrderNsu(order_nsu) ??
          order_nsu.split("__")[1] ??
          "webhook";
        await putInfinitePayOrderAsync({
          order_nsu,
          tier: "iq_unlock",
          sessionId,
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

      const unlockRow = await getIqUnlockByOrderNsu(order_nsu);
      const sessionId =
        unlockRow?.sessionId ||
        extractSessionIdFromOrderNsu(order_nsu) ||
        existing?.sessionId ||
        null;

      if (sessionId) {
        const itemType =
          extractItemTypeFromOrderNsu(order_nsu) ??
          unlockRow?.itemType ??
          "result";
        await markIqSessionPaid(sessionId, {
          order_nsu,
          transaction_nsu: transaction_nsu ?? undefined,
          slug: slug ?? undefined,
          amountCentavos:
            typeof body.amount === "number"
              ? body.amount
              : unlockRow?.amountCentavos ??
                iqAmountCentavosForItemType(itemType),
          itemType,
        });
      }
    }

    return NextResponse.json({ ok: true, received });
  } catch {
    return NextResponse.json({ ok: true, received });
  }
}
