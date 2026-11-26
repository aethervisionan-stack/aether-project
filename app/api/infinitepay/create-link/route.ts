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
import { createPagbankPixOrderCustom } from "@/lib/pagbank/client";
import { pagbankMockMode, pagbankToken } from "@/lib/pagbank/config";
import { putPagbankOrder } from "@/lib/pagbank/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PIX_TTL_MS = 24 * 60 * 60 * 1000;

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
        ? "PAGBANK_TOKEN ausente ou vazio"
        : "PAGBANK_MOCK=true — desative para gerar EMV real",
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
        error: "PagBank retornou payload Pix inválido (não é EMV 000201…)",
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
    return { emv: null, fieldsUsed: [], error: message.slice(0, 200) };
  }
}

function missingCredsMessage(input: {
  infinitepayOk: boolean;
  infinitepayError?: string | null;
  pagbankError?: string | null;
}): string {
  const missing: string[] = [];
  if (!canCreateRealCheckout() && !isRealApiKey()) {
    missing.push("INFINITEPAY_HANDLE ou INFINITEPAY_API_KEY");
  }
  if (!pagbankToken()) {
    missing.push("PAGBANK_TOKEN");
  }
  if (missing.length) {
    return `Credenciais insuficientes para Pix EMV in-app. Defina: ${missing.join(" e ")}. InfinitePay Checkout Integrado não devolve brcode; PagBank Orders (qr_codes[].text) é o fallback.`;
  }
  const parts = [
    "Não foi possível obter código Pix EMV (000201…) para QR in-app.",
    input.infinitepayError
      ? `InfinitePay: ${input.infinitepayError}`
      : input.infinitepayOk
        ? "InfinitePay: só retornou URL de checkout (sem EMV)."
        : null,
    input.pagbankError ? `PagBank: ${input.pagbankError}` : null,
    "Nunca geramos QR de URL https://. Configure um PAGBANK_TOKEN válido (sandbox ou produção).",
  ].filter(Boolean);
  return parts.join(" ");
}

function pixAliases(emv: string) {
  return {
    pixCode: emv,
    pixCopyPaste: emv,
    pix_emv: emv,
    brcode: emv,
    pix_code: emv,
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
    const expiresAt = new Date(Date.now() + PIX_TTL_MS).toISOString();

    let checkoutUrl: string | null = null;
    let emv: string | null = null;
    let fieldsUsed: string[] = [];
    let pagbankOrderId: string | undefined;
    let infinitepayError: string | null = null;
    let pagbankError: string | null = null;
    let infinitepayOk = false;

    // --- InfinitePay Checkout Integrado (try EMV; usually URL-only) ---
    if (!infinitepaySimulateLocal(handle) && canCreateRealCheckout()) {
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
        infinitepayError =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          `create-link failed (${res.status})`;
      } else {
        checkoutUrl = extractCheckoutUrl(data);
        if (!checkoutUrl) {
          infinitepayError = "InfinitePay não retornou URL do checkout";
        } else {
          infinitepayOk = true;
          const resolved = await resolveInfinitePayPixEmv(data, checkoutUrl);
          if (resolved.emv && isValidPixEmv(resolved.emv)) {
            emv = resolved.emv;
            fieldsUsed = [...resolved.fieldsUsed];
          }
        }
      }
    } else if (!canCreateRealCheckout()) {
      infinitepayError =
        "INFINITEPAY_HANDLE / INFINITEPAY_API_KEY ausentes ou placeholder";
    }

    // --- PagBank Orders EMV fallback (qr_codes[].text) ---
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
        pagbankError = fallback.error || "falha ao criar ordem Pix";
      }
    }

    // Never treat checkout URL as Pix EMV.
    if (emv && (/^https?:\/\//i.test(emv) || !isValidPixEmv(emv))) {
      emv = null;
      fieldsUsed = [];
      pagbankError =
        (pagbankError ? `${pagbankError}; ` : "") +
        "payload rejeitado (URL ou EMV inválido)";
    }

    if (!emv) {
      return NextResponse.json(
        {
          error: missingCredsMessage({
            infinitepayOk,
            infinitepayError,
            pagbankError,
          }),
          missing: {
            infinitepay: !canCreateRealCheckout(),
            pagbank: !pagbankToken() || pagbankMockMode(),
          },
          infinitepay_error: infinitepayError,
          pagbank_error: pagbankError,
          order_nsu,
          tier,
          amountCents: meta.priceCentavos,
        },
        { status: 502 },
      );
    }

    await putInfinitePayOrderAsync({
      order_nsu,
      tier,
      sessionId,
      amountCentavos: meta.priceCentavos,
      status: "created",
      url: checkoutUrl ?? undefined,
      pixCopyPaste: emv,
      emvFieldsUsed: fieldsUsed,
      pagbankOrderId,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      ...pixAliases(emv),
      amountCents: meta.priceCentavos,
      amountCentavos: meta.priceCentavos,
      amountLabel: meta.amountLabel,
      tier,
      order_nsu,
      expiresAt,
      url: checkoutUrl,
      pagbankOrderId: pagbankOrderId ?? null,
      emv_fields_used: fieldsUsed,
      emv_unavailable_reason: null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao criar cobrança Pix",
      },
      { status: 500 },
    );
  }
}
