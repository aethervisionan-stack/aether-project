function emv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixCopyPaste(input: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountBrl: number;
  txid: string;
}): string {
  const key = input.pixKey.trim();
  const name = input.merchantName.trim().slice(0, 25) || "AETHER VISION";
  const city = input.merchantCity.trim().slice(0, 15) || "SAO PAULO";
  const txid = input.txid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "VISION";
  const amount = Math.max(0.01, input.amountBrl).toFixed(2);

  const merchantAccount = emv(
    "26",
    emv("00", "br.gov.bcb.pix") + emv("01", key),
  );
  const additional = emv("62", emv("05", txid));
  const payload =
    emv("00", "01") +
    emv("01", "12") +
    merchantAccount +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amount) +
    emv("58", "BR") +
    emv("59", name) +
    emv("60", city) +
    additional +
    "6304";
  return payload + crc16ccitt(payload);
}

export function pixConfig() {
  return {
    key: process.env.PIX_KEY?.trim() || "pix@aethervision.local",
    merchantName: process.env.PIX_MERCHANT_NAME?.trim() || "AETHER VISION",
    merchantCity: process.env.PIX_MERCHANT_CITY?.trim() || "SAO PAULO",
    webhookSecret: process.env.PIX_WEBHOOK_SECRET?.trim() || "",
    // Never enable mock pay in production. Local/dev only when explicitly opted in.
    allowMock:
      process.env.NODE_ENV !== "production" &&
      process.env.PIX_ALLOW_MOCK === "true",
  };
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Pull paid BRL from common PIX/MP/OpenPix webhook shapes.
 * Returns null when the payload has no usable amount (caller must fail closed).
 */
export function extractPixPaidBrl(body: Record<string, unknown>): number | null {
  const candidates: unknown[] = [
    body.amount,
    body.value,
    body.transaction_amount,
    body.paidAmount,
    body.paid_amount,
    (body.payment as Record<string, unknown> | undefined)?.transaction_amount,
    (body.payment as Record<string, unknown> | undefined)?.amount,
    (body.data as Record<string, unknown> | undefined)?.amount,
    (body.data as Record<string, unknown> | undefined)?.value,
    (body.data as Record<string, unknown> | undefined)?.transaction_amount,
    (
      (body.data as Record<string, unknown> | undefined)?.payment as
        | Record<string, unknown>
        | undefined
    )?.transaction_amount,
    (body.pix as Record<string, unknown> | undefined)?.amount,
    (body.charge as Record<string, unknown> | undefined)?.value,
  ];

  for (const candidate of candidates) {
    const n = asNumber(candidate);
    if (n != null && n > 0) return n;
  }
  return null;
}

/** Paid BRL must cover the order (small float tolerance). */
export function pixAmountCoversOrder(
  paidBrl: number,
  orderBrl: number,
): boolean {
  if (!(paidBrl > 0) || !(orderBrl > 0)) return false;
  const tolerance = Math.max(0.05, orderBrl * 0.005);
  return paidBrl + tolerance >= orderBrl;
}
