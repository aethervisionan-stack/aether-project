import { NextResponse } from "next/server";
import {
  infinitepayApiKey,
  infinitepayHandle,
  iqPaymentSimulateLocal,
  iqUnlockAmountCentavos,
  isRealApiKey,
} from "@/lib/iq-payment/config";
import {
  extractSessionIdFromOrderNsu,
  getIqUnlockByOrderNsu,
  getIqUnlockSession,
  isIqSessionUnlocked,
  markIqSessionPaid,
} from "@/lib/iq-payment/sessionUnlock";
import {
  getInfinitePayOrderAsync,
  markInfinitePayPaidAsync,
} from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  sessionId?: unknown;
  order_nsu?: unknown;
  transaction_nsu?: unknown;
  slug?: unknown;
  simulated?: unknown;
};

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = infinitepayApiKey();
  if (isRealApiKey(key)) {
    headers.Authorization = `Bearer ${key}`;
    headers["X-Api-Key"] = key;
  }
  return headers;
}

function detectPaid(data: Record<string, unknown>): boolean {
  if (data.paid === true) return true;
  if (data.success === true && data.paid !== false) {
    if (typeof data.paid === "boolean") return data.paid;
  }
  const status = String(data.status ?? data.payment_status ?? "").toLowerCase();
  return status === "paid" || status === "approved" || status === "settled";
}

export async function POST(req: Request) {
  try {
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const order_nsu = pickString(body.order_nsu);
    const transaction_nsu = pickString(body.transaction_nsu);
    const slug = pickString(body.slug);
    let sessionId = pickString(body.sessionId);

    if (!sessionId && order_nsu) {
      sessionId =
        extractSessionIdFromOrderNsu(order_nsu) ||
        (await getIqUnlockByOrderNsu(order_nsu))?.sessionId ||
        null;
    }

    if (!sessionId) {
      return NextResponse.json(
        {
          paid: false,
          unlocked: false,
          error: "sessionId ou order_nsu obrigatório",
          code: "BAD_SESSION",
        },
        { status: 400 },
      );
    }

    // Already unlocked on server — no client flag needed.
    if (await isIqSessionUnlocked(sessionId)) {
      const rec = await getIqUnlockSession(sessionId);
      return NextResponse.json({
        paid: true,
        unlocked: true,
        sessionId,
        order_nsu: rec?.order_nsu ?? order_nsu,
        amountCentavos: rec?.amountCentavos ?? iqUnlockAmountCentavos(),
        from: "store",
      });
    }

    if (!order_nsu) {
      return NextResponse.json({
        paid: false,
        unlocked: false,
        pending: true,
        sessionId,
        error: "Aguardando order_nsu do checkout.",
        code: "PENDING_ORDER",
      });
    }

    const localOrder = await getInfinitePayOrderAsync(order_nsu);
    const localUnlock =
      (await getIqUnlockSession(sessionId)) ||
      (await getIqUnlockByOrderNsu(order_nsu));

    if (localOrder?.status === "paid" || localUnlock?.status === "paid") {
      const paid = await markIqSessionPaid(sessionId, {
        order_nsu,
        transaction_nsu: transaction_nsu ?? localOrder?.transaction_nsu,
        slug: slug ?? localOrder?.slug,
        amountCentavos:
          localOrder?.amountCentavos ||
          localUnlock?.amountCentavos ||
          iqUnlockAmountCentavos(),
        simulated: localOrder?.simulated || localUnlock?.simulated,
      });
      return NextResponse.json({
        paid: true,
        unlocked: true,
        sessionId,
        order_nsu,
        amountCentavos: paid.amountCentavos,
        from: "store",
      });
    }

    const wantsSimComplete =
      Boolean(transaction_nsu) &&
      (iqPaymentSimulateLocal(req.url) ||
        body.simulated === true ||
        body.simulated === "1" ||
        localOrder?.simulated ||
        localUnlock?.simulated ||
        Boolean(transaction_nsu?.startsWith("SIM_")));

    if (wantsSimComplete) {
      if (!iqPaymentSimulateLocal(req.url) && !transaction_nsu?.startsWith("SIM_")) {
        return NextResponse.json(
          {
            paid: false,
            unlocked: false,
            error:
              "Simulação de pagamento só é permitida em localhost (desenvolvimento).",
            code: "SIM_FORBIDDEN",
          },
          { status: 403 },
        );
      }
      await markInfinitePayPaidAsync(order_nsu, {
        transaction_nsu: transaction_nsu ?? undefined,
        slug: slug ?? undefined,
      });
      const paid = await markIqSessionPaid(sessionId, {
        order_nsu,
        transaction_nsu: transaction_nsu ?? undefined,
        slug: slug ?? undefined,
        simulated: true,
        amountCentavos: iqUnlockAmountCentavos(),
      });
      return NextResponse.json({
        paid: true,
        unlocked: true,
        sessionId,
        order_nsu,
        simulated: true,
        amountCentavos: paid.amountCentavos,
      });
    }

    // Poll with only order_nsu — wait for webhook / payment_return params.
    if (!transaction_nsu || !slug) {
      return NextResponse.json({
        paid: false,
        unlocked: false,
        pending: true,
        sessionId,
        order_nsu,
      });
    }

    const handle = infinitepayHandle();
    const res = await fetch(
      "https://api.checkout.infinitepay.io/payment_check",
      {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          handle,
          order_nsu,
          transaction_nsu,
          slug,
        }),
      },
    );

    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      return NextResponse.json(
        {
          paid: false,
          unlocked: false,
          error:
            (typeof data.message === "string" && data.message) ||
            `Falha ao confirmar pagamento (${res.status}). Tente de novo.`,
          code: "PAYMENT_CHECK_FAILED",
          sessionId,
          order_nsu,
          details: data,
        },
        { status: 502 },
      );
    }

    const paid = detectPaid(data);
    const amountRaw =
      typeof data.amount === "number"
        ? data.amount
        : typeof data.paid_amount === "number"
          ? data.paid_amount
          : null;
    const expected = iqUnlockAmountCentavos();

    if (paid) {
      if (amountRaw != null && amountRaw < expected) {
        return NextResponse.json({
          paid: false,
          unlocked: false,
          sessionId,
          order_nsu,
          error: `Valor abaixo do esperado (${amountRaw} < ${expected} centavos).`,
          code: "AMOUNT_MISMATCH",
          amount: amountRaw,
        });
      }
      await markInfinitePayPaidAsync(order_nsu, { transaction_nsu, slug });
      const unlocked = await markIqSessionPaid(sessionId, {
        order_nsu,
        transaction_nsu,
        slug,
        amountCentavos: amountRaw ?? expected,
      });
      return NextResponse.json({
        paid: true,
        unlocked: true,
        sessionId,
        order_nsu,
        amountCentavos: unlocked.amountCentavos,
        capture_method: data.capture_method ?? null,
      });
    }

    return NextResponse.json({
      paid: false,
      unlocked: false,
      pending: true,
      sessionId,
      order_nsu,
      amount: amountRaw,
    });
  } catch (err) {
    return NextResponse.json(
      {
        paid: false,
        unlocked: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro ao verificar pagamento. Tente de novo sem perder a sessão.",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
