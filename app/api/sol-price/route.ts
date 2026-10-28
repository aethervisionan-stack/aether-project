const FALLBACK_SOL_USD = 150;

async function priceFromCoinGecko(): Promise<number | null> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    { next: { revalidate: 30 } },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { solana?: { usd?: number } };
  const usd = data.solana?.usd;
  return typeof usd === "number" && Number.isFinite(usd) && usd > 0 ? usd : null;
}

async function priceFromBinance(): Promise<number | null> {
  const response = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { price?: string };
  const usd = Number.parseFloat(data.price ?? "");
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

export async function GET() {
  try {
    const gecko = await priceFromCoinGecko();
    if (gecko !== null) {
      return Response.json({ usd: gecko, source: "coingecko" });
    }
  } catch {
    /* try Binance */
  }

  try {
    const binance = await priceFromBinance();
    if (binance !== null) {
      return Response.json({ usd: binance, source: "binance" });
    }
  } catch {
    /* fallback */
  }

  return Response.json({ usd: FALLBACK_SOL_USD, source: "fallback" });
}
