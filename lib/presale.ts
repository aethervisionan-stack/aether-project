export const SQUADS_VAULT = "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa";
export const SOLSCAN_ACCOUNT = `https://solscan.io/account/${SQUADS_VAULT}`;

export const VISION_PRICE_USD = 0.05;
export const FALLBACK_SOL_USD = 150;
export const SOFT_CAP_SOL = 500;
export const HARD_CAP_SOL = 2000;
export const MIN_SOL = 0.05;
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
  return usd / VISION_PRICE_USD;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAmount(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
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
