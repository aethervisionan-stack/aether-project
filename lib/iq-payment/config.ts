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

/** Checkout item: result, AI-only upsell, or combo (result+AI in one Pix). */
export type IqUnlockItemType = "result" | "ai_upsell" | "combo";

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
  if (itemType === "ai_upsell") return iqAiUpsellAmountCentavos();
  if (itemType === "combo") {
    return iqUnlockAmountCentavos() + iqAiUpsellAmountCentavos();
  }
  return iqUnlockAmountCentavos();
}

export function iqUnlockAmountLabel(centavos = iqUnlockAmountCentavos()): string {
  const safe =
    typeof centavos === "number" && Number.isFinite(centavos) && centavos > 0
      ? centavos
      : iqUnlockAmountCentavos();
  return (safe / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Prefer a positive stored amount; never treat 0 as a real Pix price. */
export function coercePositiveCentavos(
  raw: unknown,
  fallback: number,
): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback > 0 ? fallback : iqUnlockAmountCentavos();
}

export function parseIqUnlockItemType(
  raw: unknown,
): IqUnlockItemType | null {
  if (raw === "result" || raw === "ai_upsell" || raw === "combo") return raw;
  return null;
}

export const IQ_UNLOCK_DESCRIPTION =
  "Desbloqueio do resultado do Teste de QI — perfil, ranking e revisão";

export const IQ_AI_UPSELL_DESCRIPTION =
  "Assistente de IA especializado no seu resultado do Teste de QI";

export const IQ_COMBO_DESCRIPTION =
  "Resultado do Teste de QI + assistente de IA (combo)";

export function iqDescriptionForItemType(
  itemType: IqUnlockItemType,
): string {
  if (itemType === "ai_upsell") return IQ_AI_UPSELL_DESCRIPTION;
  if (itemType === "combo") return IQ_COMBO_DESCRIPTION;
  return IQ_UNLOCK_DESCRIPTION;
}

export function iqInfinitePayTierForItemType(
  itemType: IqUnlockItemType,
): string {
  if (itemType === "ai_upsell") return "iq_unlock_ai";
  if (itemType === "combo") return "iq_unlock_combo";
  return "iq_unlock_result";
}

/** Checkout line items for InfinitePay (combo = two priced rows). */
export function iqCheckoutItemsForItemType(itemType: IqUnlockItemType): Array<{
  quantity: number;
  price: number;
  description: string;
}> {
  if (itemType === "combo") {
    return [
      {
        quantity: 1,
        price: iqUnlockAmountCentavos(),
        description: IQ_UNLOCK_DESCRIPTION,
      },
      {
        quantity: 1,
        price: iqAiUpsellAmountCentavos(),
        description: IQ_AI_UPSELL_DESCRIPTION,
      },
    ];
  }
  return [
    {
      quantity: 1,
      price: iqAmountCentavosForItemType(itemType),
      description: iqDescriptionForItemType(itemType),
    },
  ];
}

/**
 * Local payment simulation gate (automated tests / missing creds only).
 *
 * Production default: OFF
 * - VERCEL_ENV=production → never
 * - INFINITEPAY_SIMULATE=0 → never
 * - Real InfinitePay creds → never (unless SIMULATE=1 for local QA)
 * - SIMULATE=1 → only on loopback request hosts
 * - No creds → loopback only (dev convenience; never on public hosts)
 *
 * Automated tests: start `npm run dev` with INFINITEPAY_SIMULATE=1, then
 * `npm run qa:iq-payment`. Do not leave SIMULATE=1 in production env.
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

export function iqPaymentRedirectUrl(
  sessionId: string,
  orderNsu?: string | null,
  itemType?: IqUnlockItemType | null,
): string {
  const base = appPublicUrl();
  const params = new URLSearchParams({
    payment_return: "1",
    session_id: sessionId,
  });
  // Keep order_nsu so AI upsell return can mark the right tier (not the
  // already-paid result order) even when InfinitePay drops other params.
  if (orderNsu && orderNsu.trim()) {
    params.set("order_nsu", orderNsu.trim());
  }
  if (itemType === "ai_upsell" || itemType === "combo" || itemType === "result") {
    params.set("itemType", itemType);
  }
  return `${base}/teste-qi?${params.toString()}`;
}

/** InfinitePay webhook endpoint used when creating checkout links. */
export function iqPaymentWebhookUrl(): string {
  // Prefer pix webhook (handles InfinitePay payloads) so one URL covers unlock.
  return iqPixWebhookUrl();
}
