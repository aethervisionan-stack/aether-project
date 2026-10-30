import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  FALLBACK_SOL_USD,
  PRESALE_TIERS,
  VISION_PRICE_USD,
} from "@/lib/presale";

export type PricingMode = "presale" | "raydium";

export type VisionQuote = {
  mode: PricingMode;
  solPaid: number;
  solUsd: number;
  solUsdSource: string;
  bonusPct: number;
  priceVisionSol: number;
  priceVisionUsd: number;
  visionBase: number;
  visionUi: number;
  raydiumVisionReserve: number | null;
  raydiumSolReserve: number | null;
};

export function pricingMode(): PricingMode {
  return process.env.VISION_PRICING?.trim() === "raydium" ? "raydium" : "presale";
}

export function bonusPctForTier(tierId: string | null | undefined): number {
  const tier = PRESALE_TIERS.find((item) => item.id === tierId);
  return tier?.bonusPct ?? 0;
}

export function raydiumReserves(): { vision: number; sol: number } | null {
  const vision = Number(process.env.RAYDIUM_VISION_IN_POOL ?? "");
  const sol = Number(process.env.RAYDIUM_SOL_IN_POOL ?? "");
  if (vision > 0 && sol > 0) return { vision, sol };
  return null;
}

export async function fetchSolUsd(): Promise<{ usd: number; source: string }> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    );
    if (response.ok) {
      const data = (await response.json()) as { solana?: { usd?: number } };
      const usd = data.solana?.usd;
      if (typeof usd === "number" && usd > 0) {
        return { usd, source: "coingecko" };
      }
    }
  } catch {
    /* Binance */
  }
  try {
    const response = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
    );
    if (response.ok) {
      const data = (await response.json()) as { price?: string };
      const usd = Number.parseFloat(data.price ?? "");
      if (Number.isFinite(usd) && usd > 0) {
        return { usd, source: "binance" };
      }
    }
  } catch {
    /* fallback */
  }
  const envUsd = Number(process.env.SOL_USD ?? "");
  if (Number.isFinite(envUsd) && envUsd > 0) {
    return { usd: envUsd, source: "env" };
  }
  return { usd: FALLBACK_SOL_USD, source: "fallback" };
}

export function quoteVisionForSol(input: {
  solPaid: number;
  bonusPct?: number;
  solUsd: number;
  solUsdSource?: string;
  mode?: PricingMode;
}): VisionQuote {
  const mode = input.mode ?? pricingMode();
  const bonusPct = input.bonusPct ?? 0;
  const pool = raydiumReserves();

  if (!(input.solPaid > 0) || !(input.solUsd > 0)) {
    throw new Error("SOL paid and SOL/USD must be positive to quote $VISION");
  }

  let priceVisionSol: number;
  let priceVisionUsd: number;
  if (mode === "raydium" && pool) {
    priceVisionSol = pool.sol / pool.vision;
    priceVisionUsd = priceVisionSol * input.solUsd;
  } else {
    // Presale: $0.05 / VISION. Amount = (SOL * SOL/USD) / 0.05.
    priceVisionUsd = VISION_PRICE_USD;
    priceVisionSol = priceVisionUsd / input.solUsd;
  }

  const usdValue = input.solPaid * input.solUsd;
  const visionBase =
    mode === "raydium" && pool
      ? input.solPaid / priceVisionSol
      : usdValue / VISION_PRICE_USD;
  const visionUi = visionBase * (1 + bonusPct / 100);

  return {
    mode: mode === "raydium" && pool ? "raydium" : "presale",
    solPaid: input.solPaid,
    solUsd: input.solUsd,
    solUsdSource: input.solUsdSource ?? "provided",
    bonusPct,
    priceVisionSol,
    priceVisionUsd,
    visionBase,
    visionUi,
    raydiumVisionReserve: pool?.vision ?? null,
    raydiumSolReserve: pool?.sol ?? null,
  };
}

export async function quoteVisionForLamports(input: {
  lamports: number;
  tierId?: string | null;
}): Promise<VisionQuote> {
  const solPaid = input.lamports / LAMPORTS_PER_SOL;
  const sol = await fetchSolUsd();
  return quoteVisionForSol({
    solPaid,
    bonusPct: bonusPctForTier(input.tierId),
    solUsd: sol.usd,
    solUsdSource: sol.source,
  });
}

