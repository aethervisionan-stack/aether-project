/**
 * IQ post-test unlock via InfinitePay — amount and checkout helpers.
 * Amount is env-driven (centavos); never hardcode the charge in routes.
 */

import {
  appPublicUrl,
  canCreateRealCheckout,
  infinitepayApiKey,
  infinitepayHandle,
  infinitepaySimulateLocal,
  isRealApiKey,
  isPlaceholderHandle,
  normalizeHandle,
} from "@/lib/infinitepay/config";

export {
  appPublicUrl,
  canCreateRealCheckout,
  infinitepayApiKey,
  infinitepayHandle,
  infinitepaySimulateLocal,
  isRealApiKey,
  isPlaceholderHandle,
  normalizeHandle,
};

const DEFAULT_UNLOCK_CENTAVOS = 100;

/** Unlock price in centavos — from IQ_UNLOCK_AMOUNT_CENTAVOS (fallback 100 = R$1,00). */
export function iqUnlockAmountCentavos(): number {
  const raw = (process.env.IQ_UNLOCK_AMOUNT_CENTAVOS ?? "").trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0 && n <= 1_000_000) return n;
  }
  return DEFAULT_UNLOCK_CENTAVOS;
}

export function iqUnlockAmountLabel(centavos = iqUnlockAmountCentavos()): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export const IQ_UNLOCK_DESCRIPTION =
  "Desbloqueio completo do Teste de QI — resultados, ranking, revisão e assistente";

/**
 * Dev simulation only on loopback hosts (or explicit INFINITEPAY_SIMULATE=1).
 * Production / Vercel production never simulates.
 */
export function iqPaymentSimulateLocal(reqUrl?: string | null): boolean {
  if (process.env.INFINITEPAY_SIMULATE === "0") return false;
  // Vercel Production never simulates — missing creds must fail loudly.
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.INFINITEPAY_SIMULATE === "1") {
    return isLocalRequest(reqUrl);
  }
  // Placeholder creds: simulate only on loopback (local next start/dev).
  if (!infinitepaySimulateLocal()) return false;
  return isLocalRequest(reqUrl);
}

export function isLocalRequest(reqUrl?: string | null): boolean {
  if (!reqUrl) {
    // Fall back to APP_URL when no request URL (e.g. internal helpers).
    const app = appPublicUrl().toLowerCase();
    return (
      app.includes("localhost") ||
      app.includes("127.0.0.1") ||
      app.includes("[::1]")
    );
  }
  try {
    const host = new URL(reqUrl).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]"
    );
  } catch {
    return false;
  }
}

export function iqPaymentRedirectUrl(sessionId: string): string {
  const base = appPublicUrl();
  const params = new URLSearchParams({
    payment_return: "1",
    session_id: sessionId,
  });
  return `${base}/teste-qi?${params.toString()}`;
}

export function iqPaymentWebhookUrl(): string {
  return `${appPublicUrl()}/api/payment/infinitepay/webhook`;
}
