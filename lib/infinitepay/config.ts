/** InfinitePay Checkout Integrado — oferta arquetipos */

export type InfinitePayTier = "result" | "mentor_upgrade" | "combo";

export const INFINITEPAY_TIERS: Record<
  InfinitePayTier,
  {
    priceCentavos: number;
    description: string;
    amountLabel: string;
  }
> = {
  result: {
    priceCentavos: 100,
    description: "Diagnóstico Completo — dossiê luz, sombra e integração",
    amountLabel: "R$ 1,00",
  },
  mentor_upgrade: {
    priceCentavos: 500,
    description: "Consultoria IA Mentor Estratégico — 30 dias",
    amountLabel: "R$ 5,00",
  },
  combo: {
    priceCentavos: 600,
    description: "Combo Diagnóstico Completo + Consultoria IA 30 dias",
    amountLabel: "R$ 6,00",
  },
};

const PLACEHOLDER_HANDLE = "COLE_AQUI_SUA_INFINITETAG_SEM_CIFRAO";
const PLACEHOLDER_API_KEY = "COLE_AQUI_SUA_API_KEY_DA_INFINITEPAY";

export function normalizeHandle(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.trim().replace(/^\$+/, "");
}

export function infinitepayHandle(): string {
  return normalizeHandle(process.env.INFINITEPAY_HANDLE);
}

export function infinitepayApiKey(): string {
  return (process.env.INFINITEPAY_API_KEY ?? "").trim();
}

export function isPlaceholderHandle(handle = infinitepayHandle()): boolean {
  if (!handle) return true;
  return (
    handle === PLACEHOLDER_HANDLE ||
    handle.toUpperCase().includes("COLE_AQUI")
  );
}

export function isRealApiKey(key = infinitepayApiKey()): boolean {
  if (!key) return false;
  if (key === PLACEHOLDER_API_KEY) return false;
  if (key.toUpperCase().includes("COLE_AQUI")) return false;
  return true;
}

/**
 * Simulate local checkout only when we have no usable InfinitePay credentials.
 * A real API key wins over a missing/placeholder handle (docs: handle optional with key).
 * Never simulate on Vercel Production — missing creds must fail loudly instead of
 * returning a fake on-site URL that looks like "pay did nothing".
 */
export function infinitepaySimulateLocal(
  handle = infinitepayHandle(),
): boolean {
  if (process.env.INFINITEPAY_SIMULATE === "1") return true;
  if (process.env.INFINITEPAY_SIMULATE === "0") return false;
  if (isRealApiKey()) return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return isPlaceholderHandle(handle);
}

/** True when we can call InfinitePay for a real checkout link. */
export function canCreateRealCheckout(): boolean {
  return isRealApiKey() || !isPlaceholderHandle();
}

export function appPublicUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function parseInfinitePayTier(raw: unknown): InfinitePayTier | null {
  if (raw === "result" || raw === "mentor_upgrade" || raw === "combo") {
    return raw;
  }
  // legacy aliases from PagBank dual plans
  if (raw === "basic_3") return "result";
  if (raw === "combo_890") return "combo";
  return null;
}

/** Extract tier from order_nsu `${sessionId}__${tier}__${timestamp}` */
export function extractTierFromOrderNsu(
  orderNsu: string | null | undefined,
): InfinitePayTier | null {
  if (!orderNsu || typeof orderNsu !== "string") return null;
  const parts = orderNsu.split("__");
  if (parts.length < 2) return null;
  return parseInfinitePayTier(parts[1]);
}

export function expectedAmountForTier(tier: InfinitePayTier): number {
  return INFINITEPAY_TIERS[tier].priceCentavos;
}

export function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
