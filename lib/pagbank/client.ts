import {
  PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
  pagbankApiBase,
  pagbankNotificationUrl,
  pagbankToken,
  pagbankTokenMeta,
} from "./config";
import { generateValidCPF } from "./cpf";

export type PagbankCreateResult = {
  orderId: string;
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
  amountCentavos: number;
  status: "waiting";
};

export type PagbankStatusResult = {
  orderId: string;
  status: "waiting" | "paid" | "declined" | "canceled";
  amountCentavos: number;
};

export type PagbankApiError = Error & {
  status?: number;
  code?: string;
  description?: string;
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

/**
 * Authorization: single `Bearer <token>`.
 * Token is pre-stripped of any pasted "Bearer " prefix in pagbankToken().
 */
function authHeaders(): HeadersInit {
  const token = pagbankToken();
  if (!token) throw new Error("PAGBANK_TOKEN missing");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** ISO-8601 expiration for charges.payment_method.pix.expiration_date */
function expirationIso(hours = 2): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function extractPixFromOrder(body: Json): {
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
} {
  for (const raw of asArray(body.charges)) {
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

/** Pull code/description from PagBank error shapes (object or error_messages[]). */
function parsePagbankErrorBody(
  body: Json,
  rawText: string,
): { code?: string; description?: string; message: string } {
  const firstErr = asRecord(asArray(body.error_messages)[0]);
  const code =
    pickString(body.code, firstErr?.code, firstErr?.error_code) || undefined;
  const description =
    pickString(
      body.description,
      firstErr?.description,
      firstErr?.message,
      body.message,
    ) || undefined;

  const message =
    [code, description].filter(Boolean).join(": ") ||
    description ||
    code ||
    (rawText && rawText.length < 400 ? rawText : null) ||
    "PagBank request failed";

  return { code, description, message };
}

/** Log status + safe headers + body; never Authorization / token values. */
function logPagbankFailure(
  op: string,
  res: Response,
  rawText: string,
  parsed: { code?: string; description?: string },
) {
  const safeHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "authorization" || k === "cookie" || k === "set-cookie") return;
    safeHeaders[key] = value;
  });

  let urlHost = "(unknown)";
  try {
    urlHost = new URL(res.url || pagbankApiBase()).host;
  } catch {
    urlHost = pagbankApiBase();
  }

  console.error(`[pagbank:${op}] HTTP ${res.status}`, {
    urlHost,
    apiBase: pagbankApiBase(),
    token: pagbankTokenMeta(),
    code: parsed.code ?? null,
    description: parsed.description ?? null,
    responseHeaders: safeHeaders,
    bodyText: rawText.slice(0, 4000),
  });
}

/**
 * Official PIX order (charges + payment_method PIX) per PagBank Orders docs.
 * Amount = R$ 3,00 (300). notification_urls only when HTTPS and non-localhost.
 * QR expiration is charges[].payment_method.pix.expiration_date (ISO-8601).
 */
function buildPixOrderPayload() {
  const amount = PAGBANK_UNLOCK_AMOUNT_CENTAVOS;
  const reference = `arq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const taxId = generateValidCPF();
  const expires = expirationIso(2);
  const notify = pagbankNotificationUrl();

  const payload: Json = {
    reference_id: reference,
    customer: {
      name: "Cliente Arquétipo",
      // Real TLD — @pagador.local was a likely reject risk
      email: `arquetipo.${taxId.slice(0, 6)}@aether-project-eight.vercel.app`,
      tax_id: taxId,
      phones: [
        {
          country: "55",
          area: "11",
          number: "987654321",
          type: "MOBILE",
        },
      ],
    },
    items: [
      {
        reference_id: "archetype-unlock",
        name: "Relatorio de Arquétipos",
        quantity: 1,
        unit_amount: amount,
      },
    ],
    charges: [
      {
        reference_id: `charge-${reference}`,
        description: "Desbloqueio do relatorio de arquetipos",
        amount: { value: amount, currency: "BRL" },
        payment_method: {
          type: "PIX",
          pix: { expiration_date: expires },
        },
      },
    ],
  };

  if (notify) {
    payload.notification_urls = [notify];
  }

  return { payload, amount };
}

export async function createPagbankPixOrder(): Promise<PagbankCreateResult> {
  const { payload, amount } = buildPixOrderPayload();
  const url = `${pagbankApiBase()}/orders`;

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let body: Json = {};
  try {
    body = rawText ? (JSON.parse(rawText) as Json) : {};
  } catch {
    body = { raw: rawText.slice(0, 500) };
  }

  if (!res.ok) {
    const parsed = parsePagbankErrorBody(body, rawText);
    logPagbankFailure("create", res, rawText, parsed);
    const err = new Error(
      parsed.code
        ? `PagBank create failed (${res.status}) ${parsed.code}${parsed.description ? `: ${parsed.description}` : ""}`
        : `PagBank create failed (${res.status})${parsed.description ? `: ${parsed.description}` : ""}`,
    ) as PagbankApiError;
    err.status = res.status;
    err.code = parsed.code;
    err.description = parsed.description;
    throw err;
  }

  const orderId = pickString(body.id);
  if (!orderId) throw new Error("PagBank create missing order id");

  const pix = extractPixFromOrder(body);
  return {
    orderId,
    pixCopyPaste: pix.pixCopyPaste,
    qrCodeImageUrl: pix.qrCodeImageUrl,
    amountCentavos: amount,
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

  const rawText = await res.text();
  let body: Json = {};
  try {
    body = rawText ? (JSON.parse(rawText) as Json) : {};
  } catch {
    body = {};
  }

  if (!res.ok) {
    const parsed = parsePagbankErrorBody(body, rawText);
    logPagbankFailure("status", res, rawText, parsed);
    const err = new Error(
      parsed.code
        ? `PagBank status failed (${res.status}) ${parsed.code}${parsed.description ? `: ${parsed.description}` : ""}`
        : `PagBank status failed (${res.status})${parsed.description ? `: ${parsed.description}` : ""}`,
    ) as PagbankApiError;
    err.status = res.status;
    err.code = parsed.code;
    err.description = parsed.description;
    throw err;
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
