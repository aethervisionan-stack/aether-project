/**
 * IQ post-test unlock via Mercado Pago Pix — amount and helpers.
 * Amount is env-driven (centavos); never hardcode the charge in routes.
 * InfinitePay helpers remain re-exported for legacy /api/payment/infinitepay/* routes.
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
const PLACEHOLDER_TOKEN = "COLE_AQUI_SEU_ACCESS_TOKEN_MERCADOPAGO";

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

export function mercadopagoAccessToken(): string {
  return (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim();
}

export function isRealMercadopagoToken(
  token = mercadopagoAccessToken(),
): boolean {
  if (!token) return false;
  if (token === PLACEHOLDER_TOKEN) return false;
  if (token.toUpperCase().includes("COLE_AQUI")) return false;
  // Mercado Pago tokens are typically APP_USR-… or TEST-…
  return token.length >= 20;
}

/**
 * Dev simulation only on loopback hosts (or explicit MERCADOPAGO_SIMULATE=1).
 * Production / Vercel production never simulates.
 */
export function iqPaymentSimulateLocal(reqUrl?: string | null): boolean {
  if (process.env.MERCADOPAGO_SIMULATE === "0") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.MERCADOPAGO_SIMULATE === "1") {
    return isLocalRequest(reqUrl);
  }
  // No real token: simulate only on loopback.
  if (isRealMercadopagoToken()) return false;
  return isLocalRequest(reqUrl);
}

export function isLocalRequest(reqUrl?: string | null): boolean {
  if (!reqUrl) {
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

/** True when we can call Mercado Pago for a real Pix charge. */
export function canCreateRealPix(): boolean {
  return isRealMercadopagoToken();
}

export function iqPixWebhookUrl(): string {
  return `${appPublicUrl()}/api/payment/pix/webhook`;
}

/** @deprecated InfinitePay redirect — kept for legacy IQ routes. */
export function iqPaymentRedirectUrl(sessionId: string): string {
  const base = appPublicUrl();
  const params = new URLSearchParams({
    payment_return: "1",
    session_id: sessionId,
  });
  return `${base}/teste-qi?${params.toString()}`;
}

/** @deprecated InfinitePay webhook — kept for legacy IQ routes. */
export function iqPaymentWebhookUrl(): string {
  return `${appPublicUrl()}/api/payment/infinitepay/webhook`;
}

export function iqPixPayerEmail(): string {
  const fromEnv = (process.env.MERCADOPAGO_PAYER_EMAIL ?? "").trim();
  if (fromEnv && fromEnv.includes("@")) return fromEnv;
  return "qi-unlock@aethervision.local";
}
