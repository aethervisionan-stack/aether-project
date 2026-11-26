import { NextResponse } from "next/server";
import {
  INFINITEPAY_TIERS,
  appPublicUrl,
  infinitepayApiKey,
  infinitepayHandle,
  infinitepaySimulateLocal,
  isRealApiKey,
  parseInfinitePayTier,
  type InfinitePayTier,
} from "@/lib/infinitepay/config";
import { putInfinitePayOrder } from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  tier?: unknown;
  sessionId?: unknown;
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

export async function POST(req: Request) {
  try {
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const tier = parseInfinitePayTier(body.tier);
    if (!tier) {
      return NextResponse.json(
        { error: "tier inválido. Use result | mentor_upgrade | combo" },
        { status: 400 },
      );
    }

    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim().slice(0, 80)
        : `anon_${Date.now().toString(36)}`;

    const meta = INFINITEPAY_TIERS[tier as InfinitePayTier];
    const order_nsu = `${sessionId}__${tier}__${Date.now()}`;
    const handle = infinitepayHandle();
    const appUrl = appPublicUrl();
    const redirectUrl = `${appUrl}/arquetipos?payment_return=1`;
    const webhookUrl = `${appUrl}/api/infinitepay/webhook`;

    if (infinitepaySimulateLocal(handle)) {
      const url = `${appUrl}/arquetipos?payment_return=1&order_nsu=${encodeURIComponent(order_nsu)}&transaction_nsu=SIM_${Date.now()}&slug=sim-local&capture_method=pix&simulated=1`;
      putInfinitePayOrder({
        order_nsu,
        tier,
        sessionId,
        amountCentavos: meta.priceCentavos,
        status: "created",
        url,
        simulated: true,
        createdAt: Date.now(),
      });
      return NextResponse.json({
        url,
        order_nsu,
        simulated: true,
        amountLabel: meta.amountLabel,
        tier,
      });
    }

    const payload: Record<string, unknown> = {
      order_nsu,
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
      webhook: {
        url: webhookUrl,
        events: ["paid", "refunded", "canceled"],
      },
      items: [
        {
          quantity: 1,
          price: meta.priceCentavos,
          description: meta.description,
        },
      ],
    };

    // Handle identifies the merchant when API key is absent; with key it is optional.
    if (handle) {
      payload.handle = handle;
    }

    const res = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      const message =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `InfinitePay create-link failed (${res.status})`;
      return NextResponse.json({ error: message, details: data }, { status: 502 });
    }

    const url =
      (typeof data.url === "string" && data.url) ||
      (typeof data.checkout_url === "string" && data.checkout_url) ||
      (typeof data.link === "string" && data.link) ||
      null;

    if (!url) {
      return NextResponse.json(
        { error: "InfinitePay não retornou URL do checkout", details: data },
        { status: 502 },
      );
    }

    putInfinitePayOrder({
      order_nsu,
      tier,
      sessionId,
      amountCentavos: meta.priceCentavos,
      status: "created",
      url,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      url,
      order_nsu,
      amountLabel: meta.amountLabel,
      tier,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Erro ao criar link InfinitePay",
      },
      { status: 500 },
    );
  }
}
