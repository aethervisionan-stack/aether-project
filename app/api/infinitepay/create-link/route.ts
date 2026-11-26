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
import { resolveInfinitePayPixEmv } from "@/lib/infinitepay/fetchPixEmv";
import { isValidPixEmv } from "@/lib/infinitepay/pixEmv";
import { putInfinitePayOrderAsync } from "@/lib/infinitepay/store";
import {
  createPagbankPixOrderCustom,
} from "@/lib/pagbank/client";
import { pagbankMockMode, pagbankToken } from "@/lib/pagbank/config";
import { putPagbankOrder } from "@/lib/pagbank/store";

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

async function tryPagbankEmvFallback(input: {
  order_nsu: string;
  tier: InfinitePayTier;
  amountCentavos: number;
  amountLabel: string;
  description: string;
}): Promise<{
  emv: string | null;
  pagbankOrderId?: string;
  fieldsUsed: string[];
  error?: string;
}> {
  if (pagbankMockMode() || !pagbankToken()) {
    return {
      emv: null,
      fieldsUsed: [],
      error: !pagbankToken()
        ? "pagbank_token_missing"
        : "pagbank_mock_mode",
    };
  }
  try {
    const created = await createPagbankPixOrderCustom({
      amountCentavos: input.amountCentavos,
      amountLabel: input.amountLabel,
      itemReference: `ip-${input.tier}`.slice(0, 64),
      itemName: input.description.slice(0, 100),
      chargeDescription: input.description.slice(0, 64),
      referenceId: `ip-${input.order_nsu}`.slice(0, 64),
    });
    if (!isValidPixEmv(created.pixCopyPaste)) {
      return {
        emv: null,
        fieldsUsed: [],
        error: "pagbank_emv_invalid",
      };
    }
    putPagbankOrder({
      orderId: created.orderId,
      amountCentavos: input.amountCentavos,
      status: "waiting",
      pixCopyPaste: created.pixCopyPaste,
      qrCodeImageUrl: created.qrCodeImageUrl,
      mock: false,
      createdAt: Date.now(),
    });
    const baseHint = created.apiBase?.includes("sandbox")
      ? "sandbox"
      : "production";
    return {
      emv: created.pixCopyPaste.trim(),
      pagbankOrderId: created.orderId,
      fieldsUsed: [`pagbank.qr_codes.text(${baseHint})`],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[infinitepay/create-link] PagBank Pix EMV fallback failed", {
      message,
    });
    return { emv: null, fieldsUsed: [], error: message.slice(0, 160) };
  }
}

function pixPayload(emv: string | null, fieldsUsed: string[]) {
  if (!emv) {
    return {
      pixCopyPaste: null as string | null,
      pix_emv: null as string | null,
      brcode: null as string | null,
      pix_code: null as string | null,
      emv_fields_used: fieldsUsed,
    };
  }
  return {
    pixCopyPaste: emv,
    pix_emv: emv,
    brcode: emv,
    pix_code: emv,
    emv_fields_used: fieldsUsed,
  };
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
      // Never forge Pix EMV in simulate mode — banks reject fake payloads.
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
      return NextResponse.json({
        url,
        order_nsu,
        simulated: true,
        amountLabel: meta.amountLabel,
        amountCentavos: meta.priceCentavos,
        tier,
        ...pixPayload(null, []),
      });
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
      items: [
        {
          quantity: 1,
          price: meta.priceCentavos,
          description: meta.description,
        },
      ],
    };

    // Handle identifies the merchant when API key is absent; with key it is optional
    // but safe to send when it belongs to the same account.
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

    // Official Checkout Integrado docs only guarantee `url`. Still scan the
    // response + invoice public APIs for brcode/emv/pix.code before falling back.
    const resolved = await resolveInfinitePayPixEmv(data, url);
    let emv = resolved.emv;
    let fieldsUsed = [...resolved.fieldsUsed];
    let pagbankOrderId: string | undefined;
    let emvUnavailableReason: string | null = null;

    if (!emv) {
      const fallback = await tryPagbankEmvFallback({
        order_nsu,
        tier: tier as InfinitePayTier,
        amountCentavos: meta.priceCentavos,
        amountLabel: meta.amountLabel,
        description: meta.description,
      });
      if (fallback.emv) {
        emv = fallback.emv;
        fieldsUsed = fallback.fieldsUsed;
        pagbankOrderId = fallback.pagbankOrderId;
      } else {
        emvUnavailableReason =
          fallback.error ||
          "infinitepay_links_api_returns_url_only; invoice_public_pix_needs_captcha_order";
      }
    }

    // Never treat checkout URL as Pix EMV.
    if (emv && /^https?:\/\//i.test(emv)) {
      emv = null;
      fieldsUsed = [];
      emvUnavailableReason = "rejected_checkout_url_as_pix_emv";
    }
    if (emv && !isValidPixEmv(emv)) {
      emv = null;
      fieldsUsed = [];
      emvUnavailableReason = "emv_failed_isValidPixEmv";
    }

    await putInfinitePayOrderAsync({
      order_nsu,
      tier,
      sessionId,
      amountCentavos: meta.priceCentavos,
      status: "created",
      url,
      pixCopyPaste: emv ?? undefined,
      emvFieldsUsed: fieldsUsed,
      pagbankOrderId,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      url,
      order_nsu,
      amountLabel: meta.amountLabel,
      amountCentavos: meta.priceCentavos,
      tier,
      pagbankOrderId: pagbankOrderId ?? null,
      emv_unavailable_reason: emv ? null : emvUnavailableReason,
      ...pixPayload(emv, fieldsUsed),
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
