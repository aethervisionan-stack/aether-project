import { isValidPixEmv } from "@/lib/infinitepay/pixEmv";
import { appPublicUrl } from "@/lib/infinitepay/config";
import {
  PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
  pagbankApiBase,
  pagbankProductMeta,
  pagbankSandboxMode,
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
  apiBase?: string;
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

function formatPagbankError(status: number, body: Json): string {
  const parts: string[] = [];
  const code = pickString(body.code, body.error_code);
  const description = pickString(
    body.description,
    body.message,
    body.error_description,
  );
  if (code) parts.push(code);
  if (description) parts.push(description);

  for (const raw of asArray(body.error_messages)) {
    if (typeof raw === "string" && raw.trim()) {
      parts.push(raw.trim());
      continue;
    }
    const row = asRecord(raw);
    if (!row) continue;
    const c = pickString(row.code, row.error_code);
    const d = pickString(row.description, row.message);
    if (c || d) parts.push([c, d].filter(Boolean).join(": "));
  }

  if (parts.length) return `PagBank create failed (${status}): ${parts.join(" | ")}`;
  return `PagBank create failed (${status})`;
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

function expirationIso(hours = 2): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function extractPixFromOrder(body: Json): {
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
} {
  // Prefer top-level qr_codes (homolog / Orders QR arrangement).
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
    if (text && isValidPixEmv(text)) {
      return { pixCopyPaste: text, qrCodeImageUrl: png };
    }
  }

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
    if (text && isValidPixEmv(text)) {
      return { pixCopyPaste: text, qrCodeImageUrl: png };
    }
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

function buildQrCodesPayload(input: {
  reference: string;
  amount: number;
  itemReference: string;
  itemName: string;
  taxId: string;
}): Json {
  const notify = appPublicUrl().replace(/\/$/, "");
  const notificationUrls =
    notify.startsWith("https://") && !/localhost/i.test(notify)
      ? [`${notify}/api/pagbank/webhook`]
      : [];

  const payload: Json = {
    reference_id: input.reference,
    customer: {
      name: "Cliente Arquetipo",
      // Valid TLD — @pagador.local was rejected / contributed to failures.
      email: `cliente.arquetipo.${input.taxId.slice(0, 8)}@example.com`,
      tax_id: input.taxId,
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
        reference_id: input.itemReference.slice(0, 64),
        name: input.itemName.slice(0, 100),
        quantity: 1,
        unit_amount: input.amount,
      },
    ],
    // Homolog-proven path (sandbox success): qr_codes arrangement → text EMV.
    qr_codes: [
      {
        amount: { value: input.amount },
        expiration_date: expirationIso(24),
      },
    ],
  };

  if (notificationUrls.length) {
    payload.notification_urls = notificationUrls;
  }

  return payload;
}

async function postOrder(
  apiBase: string,
  payload: Json,
): Promise<{ ok: true; body: Json } | { ok: false; status: number; body: Json }> {
  const res = await fetch(`${apiBase}/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) return { ok: false, status: res.status, body };
  return { ok: true, body };
}

export async function createPagbankPixOrder(
  product: PagbankProduct = "basic_3",
): Promise<PagbankCreateResult> {
  const meta = pagbankProductMeta(product);
  return createPagbankPixOrderCustom({
    amountCentavos: meta.amountCentavos,
    amountLabel: meta.amountLabel,
    itemReference: meta.itemReference,
    itemName: meta.itemName,
    chargeDescription: meta.chargeDescription,
    product,
  });
}

/**
 * Create a Pix order with an explicit amount.
 * Uses Orders `qr_codes` arrangement (returns `qr_codes[].text` EMV).
 * If production returns ACCESS_DENIED/403 and sandbox is not forced, retries sandbox once.
 */
export async function createPagbankPixOrderCustom(input: {
  amountCentavos: number;
  amountLabel: string;
  itemReference: string;
  itemName: string;
  chargeDescription: string;
  product?: PagbankProduct;
  referenceId?: string;
}): Promise<PagbankCreateResult> {
  const amount = Math.round(input.amountCentavos);
  if (!(amount > 0)) throw new Error("PagBank amount must be > 0");
  const product = input.product ?? "basic_3";
  const reference =
    input.referenceId?.slice(0, 64) ||
    `arq-${product}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const taxId = generateValidCPF();

  const payload = buildQrCodesPayload({
    reference,
    amount,
    itemReference: input.itemReference,
    itemName: input.itemName,
    taxId,
  });

  const primaryBase = pagbankApiBase();
  let result = await postOrder(primaryBase, payload);
  let usedBase = primaryBase;

  // Prod Orders often 403 ACCESS_DENIED (whitelist). Homolog worked on sandbox
  // with the same qr_codes shape — retry sandbox once when not already there.
  if (
    !result.ok &&
    result.status === 403 &&
    !pagbankSandboxMode() &&
    !process.env.PAGBANK_API_URL?.trim()
  ) {
    const sandboxBase = "https://sandbox.api.pagseguro.com";
    console.error("[pagbank:create] prod 403 — retrying sandbox once", {
      code: pickString(result.body.code),
      description: pickString(result.body.description),
    });
    result = await postOrder(sandboxBase, payload);
    usedBase = sandboxBase;
  }

  if (!result.ok) {
    const msg = formatPagbankError(result.status, result.body);
    console.error("[pagbank:create] failed", {
      status: result.status,
      apiBase: usedBase,
      code: pickString(result.body.code),
      // never log token
    });
    throw new Error(msg);
  }

  const orderId = pickString(result.body.id);
  if (!orderId) throw new Error("PagBank create missing order id");

  const pix = extractPixFromOrder(result.body);
  return {
    orderId,
    pixCopyPaste: pix.pixCopyPaste,
    qrCodeImageUrl: pix.qrCodeImageUrl,
    amountCentavos: amount,
    amountLabel: input.amountLabel,
    product,
    status: "waiting",
    apiBase: usedBase,
  };
}

export async function fetchPagbankOrderStatus(
  orderId: string,
): Promise<PagbankStatusResult> {
  const bases = [pagbankApiBase()];
  if (!pagbankSandboxMode() && !process.env.PAGBANK_API_URL?.trim()) {
    bases.push("https://sandbox.api.pagseguro.com");
  }

  let lastError: Error | null = null;
  for (const base of bases) {
    try {
      const res = await fetch(
        `${base}/orders/${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        },
      );
      const body = (await res.json().catch(() => ({}))) as Json;
      if (!res.ok) {
        lastError = new Error(
          pickString(body.message, body.description) ||
            `PagBank status failed (${res.status})`,
        );
        continue;
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
      // qr_codes-only orders may have no charges — treat as waiting until paid webhook.
      if (status === "waiting") {
        const topStatus = String(body.status ?? "").toUpperCase();
        if (topStatus === "PAID") status = "paid";
      }

      return {
        orderId: pickString(body.id) || orderId,
        status,
        amountCentavos: PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("PagBank status failed");
}
