import { NextResponse } from "next/server";
import {
  INFINITEPAY_TIERS,
  appPublicUrl,
  canCreateRealCheckout,
  infinitepayApiKey,
  infinitepayHandle,
  infinitepaySimulateLocal,
  isRealApiKey,
  parseInfinitePayTier,
  type InfinitePayTier,
} from "@/lib/infinitepay/config";
import { putInfinitePayOrderAsync } from "@/lib/infinitepay/store";

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
    // Docs: X-Api-Key identifies the merchant; Bearer kept for older gateways.
    headers["X-Api-Key"] = key;
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function extractCheckoutUrl(data: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    data.url,
    data.checkout_url,
    data.payment_url,
    data.link,
    data.checkout_link,
  ];
  const nested = data.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    candidates.push(
      d.url,
      d.checkout_url,
      d.payment_url,
      d.link,
      d.checkout_link,
    );
  }
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c.trim())) {
      return c.trim();
    }
  }
  return null;
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
    const redirectUrl = `${appUrl}/?payment_return=1`;
    const webhookUrl = `${appUrl}/api/infinitepay/webhook`;

    if (infinitepaySimulateLocal(handle)) {
      const url = `${appUrl}/?payment_return=1&order_nsu=${encodeURIComponent(order_nsu)}&transaction_nsu=SIM_${Date.now()}&slug=sim-local&capture_method=pix&simulated=1`;
      await putInfinitePayOrderAsync({
        order_nsu,
        tier,
        sessionId,
        amountCentavos: meta.priceCentavos,
        status: "created",
        url,
        simulated: true,
        createdAt: Date.now(),
      });
      return NextResponse.json({ url, order_nsu });
    }

    if (!canCreateRealCheckout()) {
      return NextResponse.json(
        {
          error:
            "InfinitePay não configurada. Defina INFINITEPAY_HANDLE ou INFINITEPAY_API_KEY.",
        },
        { status: 503 },
      );
    }

    const payload: Record<string, unknown> = {
      order_nsu,
      redirect_url: redirectUrl,
      webhook_url: webhookUrl,
      items: [
        {
          quantity: 1,
          price: meta.priceCentavos,
          description: meta.description,
        },
      ],
    };

    // Handle without leading $ — identifies merchant when API key is absent.
    if (handle && !handle.toUpperCase().includes("COLE_AQUI")) {
      payload.handle = handle;
    }

    // Advanced options (require API key per InfinitePay docs)
    if (isRealApiKey()) {
      payload.webhook = {
        url: webhookUrl,
        events: ["paid", "settled"],
      };
      payload.options = {
        single_payment: true,
        payment_methods_enabled: ["credit_card", "pix"],
      };
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

    const url = extractCheckoutUrl(data);

    if (!url) {
      return NextResponse.json(
        { error: "InfinitePay não retornou URL do checkout", details: data },
        { status: 502 },
      );
    }

    await putInfinitePayOrderAsync({
      order_nsu,
      tier,
      sessionId,
      amountCentavos: meta.priceCentavos,
      status: "created",
      url,
      createdAt: Date.now(),
    });

    return NextResponse.json({ url, order_nsu });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Erro ao criar link InfinitePay",
      },
      { status: 500 },
    );
  }
}
