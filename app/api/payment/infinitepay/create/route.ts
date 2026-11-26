import { NextResponse } from "next/server";
import {
  IQ_UNLOCK_DESCRIPTION,
  appPublicUrl,
  canCreateRealCheckout,
  infinitepayApiKey,
  infinitepayHandle,
  iqPaymentRedirectUrl,
  iqPaymentSimulateLocal,
  iqPaymentWebhookUrl,
  iqUnlockAmountCentavos,
  iqUnlockAmountLabel,
  isRealApiKey,
} from "@/lib/iq-payment/config";
import { putIqUnlockSession } from "@/lib/iq-payment/sessionUnlock";
import { putInfinitePayOrderAsync } from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  sessionId?: unknown;
};

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = infinitepayApiKey();
  if (isRealApiKey(key)) {
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

function sanitizeSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 96);
  if (!trimmed || !/^iq_[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const sessionId = sanitizeSessionId(body.sessionId);
    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            "sessionId inválido. Use o id de sessão do teste (formato iq_…).",
          code: "BAD_SESSION",
        },
        { status: 400 },
      );
    }

    const amountCentavos = iqUnlockAmountCentavos();
    const amountLabel = iqUnlockAmountLabel(amountCentavos);
    const order_nsu = `iq__${sessionId}__${Date.now()}`;
    const handle = infinitepayHandle();
    const redirectUrl = iqPaymentRedirectUrl(sessionId);
    const webhookUrl = iqPaymentWebhookUrl();
    const reqUrl = req.url;

    const now = Date.now();
    await putIqUnlockSession({
      sessionId,
      unlocked: false,
      order_nsu,
      amountCentavos,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    if (iqPaymentSimulateLocal(reqUrl)) {
      const appUrl = appPublicUrl();
      const url = `${appUrl}/teste-qi?payment_return=1&session_id=${encodeURIComponent(sessionId)}&order_nsu=${encodeURIComponent(order_nsu)}&transaction_nsu=SIM_${Date.now()}&slug=sim-iq-local&capture_method=pix&simulated=1`;
      await putIqUnlockSession({
        sessionId,
        unlocked: false,
        order_nsu,
        amountCentavos,
        status: "pending",
        simulated: true,
        createdAt: now,
        updatedAt: Date.now(),
      });
      await putInfinitePayOrderAsync({
        order_nsu,
        tier: "iq_unlock",
        sessionId,
        amountCentavos,
        status: "created",
        url,
        simulated: true,
        createdAt: Date.now(),
      });
      return NextResponse.json({
        url,
        order_nsu,
        sessionId,
        amountCentavos,
        amountLabel,
        simulated: true,
      });
    }

    if (!canCreateRealCheckout()) {
      return NextResponse.json(
        {
          error:
            "InfinitePay não configurada. Defina INFINITEPAY_HANDLE ou INFINITEPAY_API_KEY. Em produção a simulação local não está disponível.",
          code: "MISSING_CREDENTIALS",
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
          price: amountCentavos,
          description: IQ_UNLOCK_DESCRIPTION,
        },
      ],
    };

    if (handle && !handle.toUpperCase().includes("COLE_AQUI")) {
      payload.handle = handle;
    }

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
        `InfinitePay create failed (${res.status})`;
      return NextResponse.json(
        { error: message, code: "CREATE_FAILED", details: data },
        { status: 502 },
      );
    }

    const url = extractCheckoutUrl(data);
    if (!url) {
      return NextResponse.json(
        {
          error: "InfinitePay não retornou URL do checkout",
          code: "NO_CHECKOUT_URL",
          details: data,
        },
        { status: 502 },
      );
    }

    await putInfinitePayOrderAsync({
      order_nsu,
      tier: "iq_unlock",
      sessionId,
      amountCentavos,
      status: "created",
      url,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      url,
      order_nsu,
      sessionId,
      amountCentavos,
      amountLabel,
      simulated: false,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Erro ao criar checkout InfinitePay",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
