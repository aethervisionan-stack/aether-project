/**
 * InfinitePay Pix helpers for IQ unlock (R$1 via INFINITEPAY_HANDLE / INFINITEPAY_API_KEY).
 * Creates Checkout Integrado link, resolves Pix EMV when available, else QR of checkout URL.
 */

import { buildPixCopyPaste, pixConfig } from "@/lib/pix";
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
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  status: string;
  checkoutUrl?: string;
  emvResolved?: boolean;
  raw?: Record<string, unknown>;
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

/** Localhost / missing-cred simulation — never used in Vercel production. */
export async function createSimulatedInfinitePayPix(input: {
  sessionId: string;
  amountCentavos?: number;
}): Promise<InfinitePayPixCreateResult> {
  const amountCentavos = input.amountCentavos ?? iqUnlockAmountCentavos();
  const order_nsu = `iq__${input.sessionId}__${Date.now()}`;
  const paymentId = `sim_${input.sessionId}_${Date.now()}`;
  const pix = pixConfig();
  const qrCode = buildPixCopyPaste({
    pixKey: pix.key,
    merchantName: pix.merchantName || "TESTE QI",
    merchantCity: pix.merchantCity,
    amountBrl: amountCentavos / 100,
    txid: paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25),
  });
  const qrCodeBase64 = await qrCodeToBase64Png(qrCode);
  const appUrl = appPublicUrl();
  const checkoutUrl = `${appUrl}/teste-qi?payment_return=1&session_id=${encodeURIComponent(input.sessionId)}&order_nsu=${encodeURIComponent(order_nsu)}&transaction_nsu=SIM_${Date.now()}&slug=sim-iq-local&capture_method=pix&simulated=1`;

  await putInfinitePayOrderAsync({
    order_nsu,
    tier: "iq_unlock",
    sessionId: input.sessionId,
    amountCentavos,
    status: "created",
    url: checkoutUrl,
    simulated: true,
    pixCopyPaste: qrCode,
    createdAt: Date.now(),
  });

  return {
    paymentId,
    order_nsu,
    qrCode,
    qrCodeBase64,
    expiresAt: defaultPixExpiresAt(30),
    status: "pending",
    checkoutUrl,
    emvResolved: true,
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
  // Prefer Pix copia-e-cola when InfinitePay exposes it; else QR the checkout URL.
  const qrCode = emv ?? checkoutUrl;
  const qrCodeBase64 = await qrCodeToBase64Png(qrCode);

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
