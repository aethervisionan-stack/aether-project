import {
  PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
  pagbankApiBase,
  pagbankNotificationUrl,
  pagbankToken,
  pagbankTokenMeta,
} from "./config";
import { generateValidCPF } from "./cpf";
import { isValidPixEmv } from "./pixEmv";

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
  /** Truncated PagBank response text — never contains our token */
  bodyPreview?: string;
  parameterName?: string;
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
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
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
    // Prefer uncompressed JSON so error bodies are always readable on serverless
    "Accept-Encoding": "identity",
  };
}

/** ISO-8601 expiration for PIX QR (PagBank accepts Z or offset). */
function expirationIso(hours = 2): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/** Safe summary of order body for logs — never includes secrets/tokens. */
function summarizeOrderForLog(body: Json): Json {
  const qrCodes = asArray(body.qr_codes).map((raw) => {
    const qr = asRecord(raw);
    if (!qr) return { empty: true };
    const text = pickString(qr.text);
    return {
      id: pickString(qr.id),
      hasText: Boolean(text),
      textLength: text?.length ?? 0,
      textPrefix: text ? text.slice(0, 24) : null,
      validEmv: isValidPixEmv(text),
      linkRels: asArray(qr.links)
        .map((l) => pickString(asRecord(l)?.rel))
        .filter(Boolean),
    };
  });
  const charges = asArray(body.charges).map((raw) => {
    const charge = asRecord(raw);
    if (!charge) return { empty: true };
    const qr = asRecord(charge.qr_code);
    const text = pickString(qr?.text);
    return {
      id: pickString(charge.id),
      status: pickString(charge.status),
      hasQrText: Boolean(text),
      textLength: text?.length ?? 0,
      validEmv: isValidPixEmv(text),
      linkRels: asArray(charge.links)
        .map((l) => pickString(asRecord(l)?.rel))
        .filter(Boolean),
    };
  });
  return {
    id: pickString(body.id),
    reference_id: pickString(body.reference_id),
    status: pickString(body.status),
    qr_codes: qrCodes,
    charges,
    error_messages: body.error_messages ?? null,
  };
}

/**
 * Prefer PagBank `qr_codes[0].text` EMV; fall back to `charges[].qr_code.text`.
 * Never invent / forge copia-e-cola — missing/invalid text is an error.
 */
function extractPixFromOrder(body: Json): {
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
} {
  // 1) Official wallet/order qr_codes[0].text first (user/bank expectation)
  for (const raw of asArray(body.qr_codes)) {
    const qr = asRecord(raw);
    if (!qr) continue;
    const text = pickString(qr.text);
    if (!text || !isValidPixEmv(text)) continue;
    let png: string | null = null;
    for (const linkRaw of asArray(qr.links)) {
      const link = asRecord(linkRaw);
      if (!link) continue;
      if (String(link.rel).toUpperCase() === "QRCODE.PNG") {
        png = pickString(link.href);
      }
    }
    return { pixCopyPaste: text, qrCodeImageUrl: png };
  }

  // 2) PIX charges path — charges[].qr_code.text (PagBank PIX guide)
  for (const raw of asArray(body.charges)) {
    const charge = asRecord(raw);
    if (!charge) continue;
    const qr = asRecord(charge.qr_code);
    const text = pickString(qr?.text);
    if (!text || !isValidPixEmv(text)) continue;
    let png: string | null = null;
    for (const linkRaw of asArray(charge.links)) {
      const link = asRecord(linkRaw);
      if (!link) continue;
      if (String(link.rel).toUpperCase() === "QRCODE.PNG") {
        png = pickString(link.href);
      }
    }
    return { pixCopyPaste: text, qrCodeImageUrl: png };
  }

  const summary = summarizeOrderForLog(body);
  console.error("[pagbank:create] missing/invalid PIX EMV text", summary);
  const err = new Error(
    "PIX_EMV_MISSING: PagBank order has no valid qr_codes[0].text (or charges.qr_code.text) EMV — refusing fake fallback",
  ) as PagbankApiError;
  err.status = 502;
  err.code = "PIX_EMV_MISSING";
  err.description =
    "Pedido criado sem código Pix copia-e-cola válido. Não é possível emitir QR para o banco.";
  err.bodyPreview = JSON.stringify(summary).slice(0, 800);
  throw err;
}

function normalizeChargeStatus(raw: unknown): PagbankStatusResult["status"] {
  const s = String(raw ?? "").toUpperCase();
  if (s === "PAID" || s === "AUTHORIZED") return "paid";
  if (s === "DECLINED") return "declined";
  if (s === "CANCELED" || s === "CANCELLED") return "canceled";
  return "waiting";
}

/** Regex fallback when JSON parse fails or shape is unexpected. */
function regexExtractError(rawText: string): {
  code?: string;
  description?: string;
  parameterName?: string;
} {
  if (!rawText) return {};
  const code =
    rawText.match(/"code"\s*:\s*"([^"]+)"/i)?.[1] ||
    rawText.match(/"error"\s*:\s*"([^"]+)"/i)?.[1] ||
    undefined;
  const description =
    rawText.match(/"description"\s*:\s*"([^"]+)"/i)?.[1] ||
    rawText.match(/"message"\s*:\s*"([^"]+)"/i)?.[1] ||
    undefined;
  const parameterName =
    rawText.match(/"parameter_name"\s*:\s*"([^"]+)"/i)?.[1] || undefined;
  return { code, description, parameterName };
}

/**
 * Pull code/description from every known PagBank error shape.
 * Docs: { error_messages: [{ code, error, description, parameter_name }] }
 * Alt:  { code, description }
 */
function parsePagbankErrorBody(
  body: Json,
  rawText: string,
  httpStatus: number,
): {
  code: string;
  description: string;
  parameterName?: string;
  message: string;
  bodyPreview: string;
} {
  const bodyPreview = (rawText || "").slice(0, 800);
  const messages = asArray(body.error_messages);
  const firstErr =
    asRecord(messages[0]) ||
    asRecord(asArray(body.errors)[0]) ||
    null;

  let code =
    pickString(
      body.code,
      firstErr?.code,
      firstErr?.error_code,
      firstErr?.error,
      body.error,
    ) || undefined;

  let description =
    pickString(
      body.description,
      firstErr?.description,
      firstErr?.message,
      body.message,
      typeof messages[0] === "string" ? messages[0] : null,
    ) || undefined;

  let parameterName =
    pickString(firstErr?.parameter_name, body.parameter_name) || undefined;

  if (!code || !description) {
    const rx = regexExtractError(rawText);
    code = code || rx.code;
    description = description || rx.description;
    parameterName = parameterName || rx.parameterName;
  }

  // Always expose something actionable — never leave UI with bare "(403)" only
  if (!code) code = `HTTP_${httpStatus}`;
  if (!description) {
    if (!rawText) {
      description =
        "Empty body from PagBank (403 often = Orders API whitelist / ACCESS_DENIED). Check Vercel function logs.";
    } else if (/<!DOCTYPE|<html/i.test(rawText)) {
      description =
        "Non-JSON HTML body from upstream (proxy/WAF). See bodyPreview.";
    } else {
      description = bodyPreview.slice(0, 280);
    }
  }

  const message = parameterName
    ? `${code}: ${description} (field: ${parameterName})`
    : `${code}: ${description}`;

  return { code, description, parameterName, message, bodyPreview };
}

/** Log status + safe headers + body; never Authorization / token values. */
function logPagbankFailure(
  op: string,
  res: Response,
  rawText: string,
  parsed: { code: string; description: string; parameterName?: string },
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
    code: parsed.code,
    description: parsed.description,
    parameterName: parsed.parameterName ?? null,
    responseHeaders: safeHeaders,
    bodyText: rawText.slice(0, 4000),
  });
}

function makeApiError(
  op: string,
  status: number,
  parsed: ReturnType<typeof parsePagbankErrorBody>,
): PagbankApiError {
  const err = new Error(
    `PagBank ${op} failed (${status}) ${parsed.message}`,
  ) as PagbankApiError;
  err.status = status;
  err.code = parsed.code;
  err.description = parsed.description;
  err.bodyPreview = parsed.bodyPreview;
  err.parameterName = parsed.parameterName;
  return err;
}

/**
 * Official PIX order (charges + payment_method PIX) — R$ 3,00.
 * ASCII-safe customer/item strings; HTTPS notification_urls only (no localhost).
 * QR expiry: charges[].payment_method.pix.expiration_date (ISO-8601).
 *
 * Note: production 403 ACCESS_DENIED is PagBank Orders whitelist (account),
 * not amount — but invalid tax_id/email usually yield 400 with parameter_name.
 */
function buildPixOrderPayload() {
  const amount = PAGBANK_UNLOCK_AMOUNT_CENTAVOS;
  const reference = `arq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const taxId = generateValidCPF(); // digits-only, checksum-valid
  const expires = expirationIso(2);
  const notify = pagbankNotificationUrl();

  const payload: Json = {
    reference_id: reference,
    customer: {
      name: "Jose Silva",
      email: `cliente.${taxId.slice(0, 6)}@email.com`,
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
        reference_id: "archetype-unlock",
        name: "Relatorio de Arquetipos",
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
    body = {};
  }

  if (!res.ok) {
    const parsed = parsePagbankErrorBody(body, rawText, res.status);
    logPagbankFailure("create", res, rawText, parsed);
    throw makeApiError("create", res.status, parsed);
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
    const parsed = parsePagbankErrorBody(body, rawText, res.status);
    logPagbankFailure("status", res, rawText, parsed);
    throw makeApiError("status", res.status, parsed);
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
