import { NextResponse } from "next/server";
import {
  expectedAmountForTier,
  extractTierFromOrderNsu,
  infinitepayApiKey,
  infinitepayHandle,
  infinitepaySimulateLocal,
  isRealApiKey,
  parseInfinitePayTier,
  type InfinitePayTier,
} from "@/lib/infinitepay/config";
import {
  getInfinitePayOrderAsync,
  markInfinitePayPaidAsync,
} from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  order_nsu?: unknown;
  transaction_nsu?: unknown;
  slug?: unknown;
  simulated?: unknown;
};

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

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
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
    if (!order_nsu) {
      return NextResponse.json(
        { paid: false, error: "order_nsu obrigatório" },
        { status: 400 },
      );
    }

    const transaction_nsu = pickString(body.transaction_nsu);
    const slug = pickString(body.slug);
    const tierFromNsu = extractTierFromOrderNsu(order_nsu);
    const local = await getInfinitePayOrderAsync(order_nsu);

    // Poll path / webhook already marked paid — unlock without payment_check.
    if (local?.status === "paid") {
      const tier =
        tierFromNsu ??
        (parseInfinitePayTier(local.tier) as InfinitePayTier | null);
      return NextResponse.json({
        paid: true,
        tier,
        order_nsu,
        amount: local.amountCentavos || expectedAmountForTier(tier as InfinitePayTier),
        from: "store",
      });
    }

    const wantsSimComplete =
      Boolean(transaction_nsu) &&
      (infinitepaySimulateLocal() ||
        body.simulated === true ||
        body.simulated === "1" ||
        local?.simulated ||
        Boolean(transaction_nsu?.startsWith("SIM_")));

    // Local simulated checkout — only when redirect params are present
    // (opening the sim checkout URL), never on bare order_nsu poll.
    if (wantsSimComplete) {
      const tier =
        tierFromNsu ??
        (parseInfinitePayTier(local?.tier) as InfinitePayTier | null);
      if (!tier) {
        return NextResponse.json(
          { paid: false, error: "tier não encontrado no order_nsu" },
          { status: 400 },
        );
      }
      await markInfinitePayPaidAsync(order_nsu, {
        transaction_nsu: transaction_nsu ?? undefined,
        slug: slug ?? undefined,
      });
      return NextResponse.json({
        paid: true,
        tier,
        order_nsu,
        simulated: true,
        amount: expectedAmountForTier(tier),
      });
    }

    // Poll with only order_nsu — wait for webhook / payment_return.
    if (!transaction_nsu || !slug) {
      return NextResponse.json({
        paid: false,
        pending: true,
        order_nsu,
        tier: tierFromNsu ?? parseInfinitePayTier(local?.tier) ?? null,
      });
    }

    const handle = infinitepayHandle();
    const checkBody: Record<string, string> = {
      handle,
      order_nsu,
      transaction_nsu,
      slug,
    };

    const res = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(checkBody),
    });

    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      return NextResponse.json(
        {
          paid: false,
          error:
            (typeof data.message === "string" && data.message) ||
            `payment_check failed (${res.status})`,
          order_nsu,
          tier: tierFromNsu,
          details: data,
        },
        { status: 502 },
      );
    }

    const paid = detectPaid(data);
    const tier = tierFromNsu;
    const amountRaw =
      typeof data.amount === "number"
        ? data.amount
        : typeof data.paid_amount === "number"
          ? data.paid_amount
          : null;

    if (paid && tier) {
      const expected = expectedAmountForTier(tier);
      if (amountRaw != null && amountRaw < expected) {
        return NextResponse.json({
          paid: false,
          tier,
          order_nsu,
          error: `Valor abaixo do esperado (${amountRaw} < ${expected})`,
          amount: amountRaw,
        });
      }
      await markInfinitePayPaidAsync(order_nsu, { transaction_nsu, slug });
    }

    return NextResponse.json({
      paid,
      tier,
      order_nsu,
      amount: amountRaw,
      capture_method: data.capture_method ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        paid: false,
        error: err instanceof Error ? err.message : "Erro ao verificar pagamento",
      },
      { status: 500 },
    );
  }
}
