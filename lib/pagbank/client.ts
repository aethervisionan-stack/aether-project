import {
  PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
  pagbankApiBase,
  pagbankProductMeta,
  pagbankToken,
  type PagbankProduct,
} from "./config";
import { generateValidCPF } from "./cpf";

export type PagbankCreateResult = {
  orderId: string;
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
  amountCentavos: number;
  amountLabel: string;
  product: PagbankProduct;
  status: "waiting";
};

export type PagbankStatusResult = {
  orderId: string;
  status: "waiting" | "paid" | "declined" | "canceled";
  amountCentavos: number;
};

type Json = Record<string, unknown>;

function asRecord(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Json)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function authHeaders(): HeadersInit {
  const token = pagbankToken();
  if (!token) throw new Error("PAGBANK_TOKEN missing");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function expirationIso(hours = 1): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function extractPixFromOrder(body: Json): {
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
} {
  const charges = asArray(body.charges);
  for (const raw of charges) {
    const charge = asRecord(raw);
    if (!charge) continue;
    const qr = asRecord(charge.qr_code);
    const text = pickString(qr?.text);
    let png: string | null = null;
    for (const linkRaw of asArray(charge.links)) {
      const link = asRecord(linkRaw);
      if (!link) continue;
      if (String(link.rel).toUpperCase() === "QRCODE.PNG") {
        png = pickString(link.href);
      }
    }
    if (text) return { pixCopyPaste: text, qrCodeImageUrl: png };
  }

  for (const raw of asArray(body.qr_codes)) {
    const qr = asRecord(raw);
    if (!qr) continue;
    const text = pickString(qr.text);
    let png: string | null = null;
    for (const linkRaw of asArray(qr.links)) {
      const link = asRecord(linkRaw);
      if (!link) continue;
      if (String(link.rel).toUpperCase() === "QRCODE.PNG") {
        png = pickString(link.href);
      }
    }
    if (text) return { pixCopyPaste: text, qrCodeImageUrl: png };
  }

  throw new Error("PagBank order missing PIX QR payload");
}

function normalizeChargeStatus(raw: unknown): PagbankStatusResult["status"] {
  const s = String(raw ?? "").toUpperCase();
  if (s === "PAID" || s === "AUTHORIZED") return "paid";
  if (s === "DECLINED") return "declined";
  if (s === "CANCELED" || s === "CANCELLED") return "canceled";
  return "waiting";
}

export async function createPagbankPixOrder(
  product: PagbankProduct = "unlock",
): Promise<PagbankCreateResult> {
  const meta = pagbankProductMeta(product);
  const amount = meta.amountCentavos;
  const reference = `arq-${product}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const taxId = generateValidCPF();

  const payload = {
    reference_id: reference,
    customer: {
      name: "Cliente Arquétipo",
      email: `arquetipo.${taxId.slice(0, 6)}@pagador.local`,
      tax_id: taxId,
      phones: [
        {
          country: "55",
          area: "11",
          number: "999999999",
          type: "MOBILE",
        },
      ],
    },
    items: [
      {
        reference_id: meta.itemReference,
        name: meta.itemName,
        quantity: 1,
        unit_amount: amount,
      },
    ],
    charges: [
      {
        reference_id: `charge-${reference}`,
        description: meta.chargeDescription,
        amount: { value: amount, currency: "BRL" },
        payment_method: {
          type: "PIX",
          pix: { expiration_date: expirationIso(2) },
        },
      },
    ],
  };

  const res = await fetch(`${pagbankApiBase()}/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    const msg =
      pickString(body.message, body.error_messages) ||
      `PagBank create failed (${res.status})`;
    throw new Error(msg);
  }

  const orderId = pickString(body.id);
  if (!orderId) throw new Error("PagBank create missing order id");

  const pix = extractPixFromOrder(body);
  return {
    orderId,
    pixCopyPaste: pix.pixCopyPaste,
    qrCodeImageUrl: pix.qrCodeImageUrl,
    amountCentavos: amount,
    amountLabel: meta.amountLabel,
    product,
    status: "waiting",
  };
}

export async function fetchPagbankOrderStatus(
  orderId: string,
): Promise<PagbankStatusResult> {
  const res = await fetch(
    `${pagbankApiBase()}/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    },
  );

  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    throw new Error(
      pickString(body.message) || `PagBank status failed (${res.status})`,
    );
  }

  let status: PagbankStatusResult["status"] = "waiting";
  for (const raw of asArray(body.charges)) {
    const charge = asRecord(raw);
    if (!charge) continue;
    const next = normalizeChargeStatus(charge.status);
    if (next === "paid") {
      status = "paid";
      break;
    }
    if (next !== "waiting") status = next;
  }

  return {
    orderId: pickString(body.id) || orderId,
    status,
    amountCentavos: PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
  };
}
