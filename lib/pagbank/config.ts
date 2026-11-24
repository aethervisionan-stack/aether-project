/** Unlock price in BRL centavos (R$ 3,00). */
export const PAGBANK_UNLOCK_AMOUNT_CENTAVOS = 300;

/**
 * Production Orders API host when SANDBOX is false/absent.
 * Never log the raw token value.
 */
export function pagbankToken(): string | undefined {
  let raw =
    process.env.PAGBANK_TOKEN?.trim() ||
    process.env.PAGSEGURO_TOKEN?.trim() ||
    undefined;
  if (!raw) return undefined;

  // Strip accidental wrapping quotes from dashboard paste
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  // Strip leading "Bearer " so Authorization does not become "Bearer Bearer …"
  if (/^Bearer\s+/i.test(raw)) {
    raw = raw.replace(/^Bearer\s+/i, "").trim();
  }

  // Remove accidental whitespace/newlines from dashboard paste
  raw = raw.replace(/\s+/g, "");

  return raw || undefined;
}

/** Safe token presence metadata for logs (never the secret itself). */
export function pagbankTokenMeta(): {
  present: boolean;
  length: number;
  hadBearerPrefix: boolean;
} {
  const original =
    process.env.PAGBANK_TOKEN?.trim() ||
    process.env.PAGSEGURO_TOKEN?.trim() ||
    "";
  const hadBearerPrefix = /^Bearer\s+/i.test(original.replace(/^["']|["']$/g, ""));
  const token = pagbankToken();
  return {
    present: Boolean(token),
    length: token?.length ?? 0,
    hadBearerPrefix,
  };
}

export function pagbankApiBase(): string {
  const explicit = process.env.PAGBANK_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const sandbox = process.env.PAGBANK_SANDBOX?.trim().toLowerCase();
  if (sandbox === "true" || sandbox === "1") {
    return "https://sandbox.api.pagseguro.com";
  }
  // SANDBOX false / absent / any other value → production host
  return "https://api.pagseguro.com";
}

/**
 * HTTPS notification URL for Orders `notification_urls`.
 * Never returns localhost / 127.0.0.1 (PagBank rejects those).
 */
export function pagbankNotificationUrl(): string | null {
  const candidates = [
    process.env.PAGBANK_NOTIFICATION_URL?.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim()
      ? `${process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, "")}/api/pagbank/webhook`
      : undefined,
    process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "")}/api/pagbank/webhook`
      : undefined,
  ];

  for (const url of candidates) {
    if (!url) continue;
    if (!/^https:\/\//i.test(url)) continue;
    if (/localhost|127\.0\.0\.1/i.test(url)) continue;
    return url;
  }
  return null;
}

/**
 * Dev/local simulate path.
 * Production (Vercel Production or NODE_ENV=production) stays OFF unless
 * PAGBANK_ALLOW_SIMULATE=true is set explicitly.
 */
export function pagbankSimulateAllowed(): boolean {
  if (process.env.PAGBANK_ALLOW_SIMULATE === "true") return true;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export function pagbankMockMode(): boolean {
  if (process.env.PAGBANK_MOCK === "true") return true;
  return !pagbankToken();
}
