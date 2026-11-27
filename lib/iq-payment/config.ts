/**
 * IQ post-test unlock via InfinitePay Pix — amount and helpers.
 * Amounts are env-driven (centavos); never hardcode the charge in routes.
 *
 * Two tiers on the same sessionId:
 * - result (IQ_UNLOCK_AMOUNT_CENTAVOS) → resultUnlocked
 * - ai_upsell (IQ_AI_UPSELL_AMOUNT_CENTAVOS) → aiUnlocked
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

export type IqUnlockItemType = "result" | "ai_upsell";

const DEFAULT_UNLOCK_CENTAVOS = 100;
const DEFAULT_AI_UPSELL_CENTAVOS = 100;

function parseCentavosEnv(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const n = Number.parseInt(trimmed, 10);
  if (Number.isFinite(n) && n > 0 && n <= 1_000_000) return n;
  return fallback;
}

/** Stage-1 result unlock in centavos — IQ_UNLOCK_AMOUNT_CENTAVOS (fallback 100 = R$1,00). */
export function iqUnlockAmountCentavos(): number {
  return parseCentavosEnv(
    process.env.IQ_UNLOCK_AMOUNT_CENTAVOS ?? "",
    DEFAULT_UNLOCK_CENTAVOS,
  );
}

/** Stage-2 AI upsell in centavos — IQ_AI_UPSELL_AMOUNT_CENTAVOS (fallback 100 = R$1,00). */
export function iqAiUpsellAmountCentavos(): number {
  return parseCentavosEnv(
    process.env.IQ_AI_UPSELL_AMOUNT_CENTAVOS ?? "",
    DEFAULT_AI_UPSELL_CENTAVOS,
  );
}

export function iqAmountCentavosForItemType(
  itemType: IqUnlockItemType,
): number {
  return itemType === "ai_upsell"
    ? iqAiUpsellAmountCentavos()
    : iqUnlockAmountCentavos();
}

export function iqUnlockAmountLabel(centavos = iqUnlockAmountCentavos()): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseIqUnlockItemType(
  raw: unknown,
): IqUnlockItemType | null {
  if (raw === "result" || raw === "ai_upsell") return raw;
  return null;
}

export const IQ_UNLOCK_DESCRIPTION =
  "Desbloqueio do resultado do Teste de QI — perfil, ranking e revisão";

export const IQ_AI_UPSELL_DESCRIPTION =
  "Assistente Gemini especializado no seu resultado do Teste de QI";

export function iqDescriptionForItemType(
  itemType: IqUnlockItemType,
): string {
  return itemType === "ai_upsell"
    ? IQ_AI_UPSELL_DESCRIPTION
    : IQ_UNLOCK_DESCRIPTION;
}

export function iqInfinitePayTierForItemType(
  itemType: IqUnlockItemType,
): string {
  return itemType === "ai_upsell" ? "iq_unlock_ai" : "iq_unlock_result";
}

/**
 * Dev simulation only on loopback hosts (or explicit INFINITEPAY_SIMULATE=1).
 * Production / Vercel production never simulates.
 * With real InfinitePay credentials, create hits the live API unless SIMULATE=1.
 */
export function iqPaymentSimulateLocal(reqUrl?: string | null): boolean {
  if (process.env.INFINITEPAY_SIMULATE === "0") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.INFINITEPAY_SIMULATE === "1") {
    return isLocalRequest(reqUrl);
  }
  // No usable InfinitePay creds: simulate only on loopback.
  if (canCreateRealCheckout()) return false;
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

/** True when we can call InfinitePay for a real Pix / checkout charge. */
export function canCreateRealPix(): boolean {
  return canCreateRealCheckout();
}

export function iqPixWebhookUrl(): string {
  return `${appPublicUrl()}/api/payment/pix/webhook`;
}

export function iqPaymentRedirectUrl(sessionId: string): string {
  const base = appPublicUrl();
  const params = new URLSearchParams({
    payment_return: "1",
    session_id: sessionId,
  });
  return `${base}/teste-qi?${params.toString()}`;
}

/** InfinitePay webhook endpoint used when creating checkout links. */
export function iqPaymentWebhookUrl(): string {
  // Prefer pix webhook (handles InfinitePay payloads) so one URL covers unlock.
  return iqPixWebhookUrl();
}
