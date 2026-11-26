/**
 * Mercado Pago Pix helpers for IQ unlock (R$1 via MERCADOPAGO_ACCESS_TOKEN).
 */

import { createHash, randomUUID } from "crypto";
import { buildPixCopyPaste, pixConfig } from "@/lib/pix";
import {
  IQ_UNLOCK_DESCRIPTION,
  iqPixPayerEmail,
  iqUnlockAmountCentavos,
  mercadopagoAccessToken,
} from "@/lib/iq-payment/config";

const MP_API = "https://api.mercadopago.com";

export type MercadoPagoPixCreateResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  status: string;
  raw?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractPixFields(data: Record<string, unknown>): {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string | null;
} {
  const poi = asRecord(data.point_of_interaction);
  const tx = asRecord(poi?.transaction_data);
  const qrCode =
    (typeof tx?.qr_code === "string" && tx.qr_code) ||
    (typeof data.qr_code === "string" && data.qr_code) ||
    "";
  let qrCodeBase64 =
    (typeof tx?.qr_code_base64 === "string" && tx.qr_code_base64) ||
    (typeof data.qr_code_base64 === "string" && data.qr_code_base64) ||
    "";
  // Strip data-URL prefix if present
  if (qrCodeBase64.startsWith("data:")) {
    const idx = qrCodeBase64.indexOf(",");
    if (idx >= 0) qrCodeBase64 = qrCodeBase64.slice(idx + 1);
  }
  const expiresAt =
    (typeof data.date_of_expiration === "string" && data.date_of_expiration) ||
    (typeof tx?.date_of_expiration === "string" && tx.date_of_expiration) ||
    null;
  return { qrCode, qrCodeBase64, expiresAt };
}

async function qrCodeToBase64Png(qrCode: string): Promise<string> {
  try {
    // Prefer transitive/local `qrcode` if available (types already in package).
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

/** Localhost / missing-token simulation — never used in Vercel production. */
export async function createSimulatedPixPayment(input: {
  sessionId: string;
  amountCentavos?: number;
}): Promise<MercadoPagoPixCreateResult> {
  const amountCentavos = input.amountCentavos ?? iqUnlockAmountCentavos();
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
  return {
    paymentId,
    qrCode,
    qrCodeBase64,
    expiresAt: defaultPixExpiresAt(30),
    status: "pending",
  };
}

export async function createMercadoPagoPixPayment(input: {
  sessionId: string;
  amountCentavos?: number;
  description?: string;
  notificationUrl?: string;
}): Promise<MercadoPagoPixCreateResult> {
  const token = mercadopagoAccessToken();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente");
  }
  const amountCentavos = input.amountCentavos ?? iqUnlockAmountCentavos();
  const transaction_amount = Number((amountCentavos / 100).toFixed(2));
  const idempotency = createHash("sha256")
    .update(`${input.sessionId}:${amountCentavos}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);

  const body: Record<string, unknown> = {
    transaction_amount,
    description: input.description ?? IQ_UNLOCK_DESCRIPTION,
    payment_method_id: "pix",
    payer: {
      email: iqPixPayerEmail(),
    },
    external_reference: input.sessionId,
    metadata: {
      sessionId: input.sessionId,
      product: "iq_unlock",
    },
  };
  if (input.notificationUrl) {
    body.notification_url = input.notificationUrl;
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotency || randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `Mercado Pago create failed (${res.status})`;
    const err = new Error(message) as Error & {
      status?: number;
      details?: unknown;
    };
    err.status = res.status;
    err.details = data;
    throw err;
  }

  const paymentId = String(data.id ?? "");
  if (!paymentId) {
    throw new Error("Mercado Pago não retornou id do pagamento");
  }

  const fields = extractPixFields(data);
  let qrCode = fields.qrCode;
  let qrCodeBase64 = fields.qrCodeBase64;
  if (!qrCode) {
    throw new Error("Mercado Pago não retornou qr_code Pix");
  }
  if (!qrCodeBase64) {
    qrCodeBase64 = await qrCodeToBase64Png(qrCode);
  }

  return {
    paymentId,
    qrCode,
    qrCodeBase64,
    expiresAt: fields.expiresAt ?? defaultPixExpiresAt(30),
    status: String(data.status ?? "pending"),
    raw: data,
  };
}

export async function fetchMercadoPagoPayment(
  paymentId: string,
): Promise<{
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  paid: boolean;
  raw: Record<string, unknown>;
} | null> {
  const token = mercadopagoAccessToken();
  if (!token || !paymentId || paymentId.startsWith("sim_")) return null;

  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(data.status ?? "").toLowerCase();
  return {
    id: String(data.id ?? paymentId),
    status,
    statusDetail:
      typeof data.status_detail === "string" ? data.status_detail : null,
    externalReference:
      typeof data.external_reference === "string"
        ? data.external_reference
        : null,
    paid: status === "approved" || status === "accredited",
    raw: data,
  };
}

export function isMercadoPagoPaidStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "approved" || s === "accredited";
}
