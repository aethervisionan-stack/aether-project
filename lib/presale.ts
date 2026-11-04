/** Legacy Squads vault — leftover SOL/VISION may still sit here. Not the checkout dest. */
export const SQUADS_VAULT = "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa";
export const SQUADS_MULTISIG = SQUADS_VAULT;

/** Phantom 1 / relayer owner. Checkout SOL and /sol-paid listen here. */
export const RECEIVE_TREASURY = "9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911";
export const SOL_TREASURY = RECEIVE_TREASURY;
export const SOLSCAN_ACCOUNT = `https://solscan.io/account/${SOL_TREASURY}`;

export function isSolPaymentDestination(address: string | undefined): boolean {
  const value = address?.trim() ?? "";
  return value === SOL_TREASURY || value === SQUADS_VAULT;
}
export function solscanTx(signature: string) {
  return `https://solscan.io/tx/${signature}`;
}

/** Presale unit price. Every quote, tier and progress figure derives from this. */
export const VISION_PRICE_USD = 0.0001;
export const FALLBACK_SOL_USD = 150;
export const MIN_SOL = 0.05;
/** Progress band: 10% and 20% of the 2,000,000,000 $VISION supply. */
export const PRESALE_SOFT_TOKENS = 200_000_000;
export const PRESALE_HARD_TOKENS = 400_000_000;
export const TIER_SELECT_EVENT = "aether:select-tier";

export function requestPresaleTier(id: string) {
  window.dispatchEvent(new CustomEvent(TIER_SELECT_EVENT, { detail: { id } }));
  const next = `#presale?device=${id}`;
  if (window.location.hash === next) {
    document.getElementById("presale")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  window.location.hash = next;
}

export function visionFromUsd(usd: number): number {
  if (!(usd > 0) || !(VISION_PRICE_USD > 0)) return 0;
  return usd / VISION_PRICE_USD;
}

/** 1 USDT or 1 USDC, both treated as US$ 1. */
export function visionPerStablecoin(): number {
  return visionFromUsd(1);
}

/** Live SOL/USD → $VISION at the presale unit price. */
export function visionPerSol(solUsd: number): number {
  return visionFromUsd(solUsd);
}

/** Treasury SOL converted to $VISION already allocated at the unit price. */
export function allocatedVision(solAmount: number, solUsd: number): number {
  if (!(solAmount > 0) || !(solUsd > 0)) return 0;
  return visionFromUsd(solAmount * solUsd);
}

const NUMBER_LOCALE: Record<string, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
};

function usdFractionDigits(value: number): number {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs) || abs === 0 || abs >= 0.01) return 2;
  return Math.min(8, Math.max(4, Math.ceil(-Math.log10(abs))));
}

export function formatUsd(value: number, locale = "en"): string {
  const digits = usdFractionDigits(value);
  return new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Same numeric unit price, shown as R$ on the static TGE tag. */
export function formatBrl(value: number, locale = "en"): string {
  const digits = usdFractionDigits(value);
  const amount = new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `R$ ${amount}`;
}

export function formatAmount(
  value: number,
  fractionDigits = 2,
  locale = "en",
): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? "en-US", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export const PRESALE_TIERS = [
  {
    id: "early",
    name: "Vision 1.0",
    usd: 50,
    bonusPct: 5,
    highlight: false,
    badge: "Smart Audio",
    perks: [
      "Alocação Vision 1.0 · áudio essencial",
      "Equivalente a 3 meses de assinatura do app de IA",
    ],
  },
  {
    id: "pro",
    name: "Vision 2.0",
    usd: 200,
    bonusPct: 15,
    highlight: false,
    badge: "AI Camera",
    perks: [
      "Alocação Vision 2.0 · câmera 12MP multimodal",
      "Equivalente a 6 meses de assinatura do app",
    ],
  },
  {
    id: "master",
    name: "Vision 3.0",
    usd: 600,
    bonusPct: 25,
    highlight: false,
    badge: "Executivo",
    perks: [
      "Alocação Vision 3.0 · titânio e condução óssea",
      "Assinatura vitalícia do app + 10.000 $AETH na mainnet",
    ],
  },
  {
    id: "apex",
    name: "Vision 4.0",
    usd: 1200,
    bonusPct: 30,
    highlight: true,
    badge: "Flagship AR",
    perks: [
      "Alocação Vision 4.0 · Micro-OLED AR neural",
      "Alocação prioritária + assinatura vitalícia + 10.000 $AETH",
    ],
  },
] as const;

export function visionForUsd(usd: number, bonusPct: number): number {
  return visionFromUsd(usd) * (1 + bonusPct / 100);
}
