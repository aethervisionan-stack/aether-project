/**
 * InfinitePay Pix helpers for IQ unlock (R$1 via INFINITEPAY_HANDLE / INFINITEPAY_API_KEY).
 * Creates Checkout Integrado link and resolves Pix EMV when InfinitePay exposes it.
 * Docs: Checkout Integrado does NOT return Pix EMV/QR — only a checkout URL. Never encode
 * that URL as a bank-scannable "Pix" payload (banks reject it as serviço indisponível).
 */

import { resolveInfinitePayPixEmv } from "@/lib/infinitepay/fetchPixEmv";
import { isValidPixEmv } from "@/lib/infinitepay/pixEmv";
import { putInfinitePayOrderAsync } from "@/lib/infinitepay/store";
import {
  IQ_UNLOCK_DESCRIPTION,
  appPublicUrl,
  canCreateRealCheckout,
  infinitepayApiKey,
  infinitepayHandle,
  iqPaymentRedirectUrl,
  iqPaymentWebhookUrl,
  iqUnlockAmountCentavos,
  isRealApiKey,
} from "@/lib/iq-payment/config";

export type InfinitePayPixCreateResult = {
  paymentId: string;
  order_nsu: string;
  /** Pix EMV (copia-e-cola) only — never a checkout URL. Empty when unavailable. */
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  status: string;
  checkoutUrl?: string;
  emvResolved?: boolean;
  /** Machine-readable reason when EMV is missing or flow is simulated. */
  code?: string;
  /** Clear PT-BR notice for the UI (sim / checkout-only / misconfig). */
  notice?: string;
  raw?: Record<string, unknown>;
};

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = infinitepayApiKey();
  if (isRealApiKey(key)) {
    // InfinitePay Checkout Integrado docs: X-Api-Key only (server-side).
    headers["X-Api-Key"] = key;
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

async function qrCodeToBase64Png(qrCode: string): Promise<string> {
  try {
    const QR = (await import("qrcode")) as {
      toDataURL: (
        text: string,
        opts?: { type?: string; margin?: number; width?: number },
      ) => Promise<string>;
    };
    const dataUrl = await QR.toDataURL(qrCode, {
      type: "image/png",
      margin: 2,
      width: 280,
    });
    const idx = dataUrl.indexOf(",");
    return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  } catch {
    // 1x1 white PNG fallback — client can still render from qrCode string.
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  }
}

export function defaultPixExpiresAt(minutes = 30): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/**
 * Localhost / missing-cred simulation — never used in Vercel production.
 * Does NOT emit a fake Pix EMV: banks reject placeholder keys as "serviço indisponível".
 */
export async function createSimulatedInfinitePayPix(input: {
  sessionId: string;
  amountCentavos?: number;
  reason?: "missing_credentials" | "forced_simulate";
}): Promise<InfinitePayPixCreateResult> {
  const amountCentavos = input.amountCentavos ?? iqUnlockAmountCentavos();
  const order_nsu = `iq__${input.sessionId}__${Date.now()}`;
  const paymentId = `sim_${input.sessionId}_${Date.now()}`;
  const appUrl = appPublicUrl();
  const checkoutUrl = `${appUrl}/teste-qi?payment_return=1&session_id=${encodeURIComponent(input.sessionId)}&order_nsu=${encodeURIComponent(order_nsu)}&transaction_nsu=SIM_${Date.now()}&slug=sim-iq-local&capture_method=pix&simulated=1`;

  const reason = input.reason ?? "missing_credentials";
  const notice =
    reason === "forced_simulate"
      ? "Modo simulação forçado (INFINITEPAY_SIMULATE=1). Remova essa variável do ambiente, deixe INFINITEPAY_HANDLE e INFINITEPAY_API_KEY no .env.local e reinicie a porta 3010 para Pix real via InfinitePay. Apps de banco não aceitam QR simulado."
      : "InfinitePay em modo simulação: defina INFINITEPAY_HANDLE (InfiniteTag sem $) e/ou INFINITEPAY_API_KEY (inchk_…) no .env.local e reinicie a porta 3010. Sem isso, não há Pix real — use “Simular pagamento” só em localhost.";

  await putInfinitePayOrderAsync({
    order_nsu,
    tier: "iq_unlock",
    sessionId: input.sessionId,
    amountCentavos,
    status: "created",
    url: checkoutUrl,
    simulated: true,
    createdAt: Date.now(),
  });

  return {
    paymentId,
    order_nsu,
    qrCode: "",
    qrCodeBase64: "",
    expiresAt: defaultPixExpiresAt(30),
    status: "pending",
    checkoutUrl,
    emvResolved: false,
    code: reason === "forced_simulate" ? "SIMULATED_FORCED" : "SIMULATED_MISSING_CREDENTIALS",
    notice,
  };
}

export async function createInfinitePayPixPayment(input: {
  sessionId: string;
  amountCentavos?: number;
  description?: string;
}): Promise<InfinitePayPixCreateResult> {
  if (!canCreateRealCheckout()) {
    throw new Error(
      "InfinitePay não configurada. Defina INFINITEPAY_HANDLE ou INFINITEPAY_API_KEY.",
    );
  }

  const amountCentavos = input.amountCentavos ?? iqUnlockAmountCentavos();
  const order_nsu = `iq__${input.sessionId}__${Date.now()}`;
  const handle = infinitepayHandle();
  const redirectUrl = iqPaymentRedirectUrl(input.sessionId);
  const webhookUrl = iqPaymentWebhookUrl();

  const payload: Record<string, unknown> = {
    order_nsu,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    items: [
      {
        quantity: 1,
        price: amountCentavos,
        description: input.description ?? IQ_UNLOCK_DESCRIPTION,
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
      payment_methods_enabled: ["pix"],
    };
  }

  const res = await fetch("https://api.checkout.infinitepay.io/links", {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `InfinitePay create failed (${res.status})`;
    const err = new Error(message) as Error & {
      status?: number;
      details?: unknown;
    };
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.details = data;
    throw err;
  }

  const checkoutUrl = extractCheckoutUrl(data);
  if (!checkoutUrl) {
    const err = new Error("InfinitePay não retornou URL do checkout") as Error & {
      status?: number;
      details?: unknown;
    };
    err.status = 502;
    err.details = data;
    throw err;
  }

  const emvResult = await resolveInfinitePayPixEmv(data, checkoutUrl);
  const emv =
    emvResult.emv && isValidPixEmv(emvResult.emv) ? emvResult.emv : null;
  // Never fall back to checkout URL as "Pix" — bank apps cannot pay that.
  const qrCode = emv ?? "";
  const qrCodeBase64 = emv ? await qrCodeToBase64Png(emv) : "";

  await putInfinitePayOrderAsync({
    order_nsu,
    tier: "iq_unlock",
    sessionId: input.sessionId,
    amountCentavos,
    status: "created",
    url: checkoutUrl,
    pixCopyPaste: emv ?? undefined,
    emvFieldsUsed: emvResult.fieldsUsed,
    createdAt: Date.now(),
  });

  return {
    paymentId: order_nsu,
    order_nsu,
    qrCode,
    qrCodeBase64,
    expiresAt: defaultPixExpiresAt(30),
    status: "pending",
    checkoutUrl,
    emvResolved: Boolean(emv),
    code: emv ? "PIX_EMV" : "CHECKOUT_ONLY",
    notice: emv
      ? undefined
      : "Checkout InfinitePay criado. A API do Checkout Integrado não devolve o código Pix (EMV) — abra o link da InfinitePay para ver o QR Pix real e pagar. Depois volte aqui; a liberação ocorre pelo webhook/confirmação.",
    raw: data,
  };
}

export function isInfinitePayPaidStatus(
  status: string | null | undefined,
): boolean {
  const s = (status ?? "").toLowerCase();
  return (
    s === "paid" ||
    s === "approved" ||
    s === "settled" ||
    s === "payment.paid"
  );
}
