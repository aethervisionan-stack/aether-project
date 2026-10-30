/**
 * Raydium constant-product launch price calculator for $VISION.
 *
 *   npx tsx scripts/calculate-raydium-price.ts
 *   npx tsx scripts/calculate-raydium-price.ts --vision 200000000 --sol 10
 *   npx tsx scripts/calculate-raydium-price.ts --vision 200000000 --sol 5,10,50 --fetch-price
 *
 * Spot at t0 (no fees):  P_VISION_in_SOL = SOL_reserve / VISION_reserve
 */
import "dotenv/config";

const DEFAULT_VISION = 200_000_000;
const DEFAULT_SOL = [5, 10, 50];
const DEFAULT_SOL_USD = 97.74;
const DEFAULT_SUPPLY = 1_000_000_000;
const PRESALE_USD = 0.05;

type Quote = {
  visionInPool: number;
  solInPool: number;
  solUsd: number;
  priceSol: number;
  priceUsd: number;
  fdvUsd: number;
  liquidityUsd: number;
  visionSideUsd: number;
  solSideUsd: number;
  poolShareOfSupply: number;
};

function parseFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function parseNumberList(raw: string | undefined, fallback: number[]): number[] {
  if (!raw?.trim()) return fallback;
  return raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function fmt(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value !== 0 && Math.abs(value) < 1e-4) {
    return value.toExponential(4);
  }
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function usd(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) {
    const tinyDigits = abs < 1e-6 ? 10 : 8;
    return `$${value.toFixed(tinyDigits)}`;
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

async function fetchSolUsd(): Promise<{ usd: number; source: string }> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    );
    if (response.ok) {
      const data = (await response.json()) as { solana?: { usd?: number } };
      const price = data.solana?.usd;
      if (typeof price === "number" && price > 0) {
        return { usd: price, source: "coingecko" };
      }
    }
  } catch {
    /* Binance fallback */
  }
  try {
    const response = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
    );
    if (response.ok) {
      const data = (await response.json()) as { price?: string };
      const price = Number.parseFloat(data.price ?? "");
      if (Number.isFinite(price) && price > 0) {
        return { usd: price, source: "binance" };
      }
    }
  } catch {
    /* default */
  }
  return { usd: DEFAULT_SOL_USD, source: "default" };
}

function quote(input: {
  visionInPool: number;
  solInPool: number;
  solUsd: number;
  supply: number;
}): Quote {
  const priceSol = input.solInPool / input.visionInPool;
  const priceUsd = priceSol * input.solUsd;
  const solSideUsd = input.solInPool * input.solUsd;
  const visionSideUsd = input.visionInPool * priceUsd;
  return {
    visionInPool: input.visionInPool,
    solInPool: input.solInPool,
    solUsd: input.solUsd,
    priceSol,
    priceUsd,
    fdvUsd: input.supply * priceUsd,
    liquidityUsd: solSideUsd + visionSideUsd,
    visionSideUsd,
    solSideUsd,
    poolShareOfSupply: input.visionInPool / input.supply,
  };
}

function printQuote(row: Quote, supply: number) {
  const vsPresale = row.priceUsd / PRESALE_USD;
  console.log("────────────────────────────────────────");
  console.log(`Pool          ${fmt(row.visionInPool, 0)} VISION  +  ${fmt(row.solInPool, 4)} SOL`);
  console.log(`Price / VISION (SOL)   ${row.priceSol.toFixed(12)} SOL`);
  console.log(`Price / VISION (USD)   ${usd(row.priceUsd, 8)}`);
  console.log(`FDV / initial mcap     ${usd(row.fdvUsd, 2)}  (supply ${fmt(supply, 0)})`);
  console.log(`SOL side (USD)         ${usd(row.solSideUsd, 2)}`);
  console.log(`VISION side (USD)      ${usd(row.visionSideUsd, 2)}`);
  console.log(`Initial liquidity      ${usd(row.liquidityUsd, 2)}  (both sides)`);
  console.log(`Pool vs total supply   ${(row.poolShareOfSupply * 100).toFixed(2)}%`);
  console.log(
    `vs presale $${PRESALE_USD.toFixed(2)}     ${vsPresale.toExponential(3)}×  (${fmt(1 / vsPresale, 1)}× cheaper)`,
  );
}

async function main() {
  const fetchPrice =
    process.argv.includes("--fetch-price") || process.argv.includes("--live");
  const visionInPool = Number(parseFlag("vision") ?? DEFAULT_VISION);
  const solList = parseNumberList(parseFlag("sol"), DEFAULT_SOL);
  const supply = Number(parseFlag("supply") ?? DEFAULT_SUPPLY);
  const solUsdFlag = parseFlag("sol-usd") ?? parseFlag("solUsd");

  if (!Number.isFinite(visionInPool) || visionInPool <= 0) {
    throw new Error("--vision must be a positive number");
  }
  if (!Number.isFinite(supply) || supply <= 0) {
    throw new Error("--supply must be a positive number");
  }

  let solUsd = Number(solUsdFlag ?? DEFAULT_SOL_USD);
  let solSource = solUsdFlag ? "cli" : "default";
  if (fetchPrice || !solUsdFlag) {
    if (fetchPrice) {
      const live = await fetchSolUsd();
      solUsd = live.usd;
      solSource = live.source;
    }
  }
  if (!Number.isFinite(solUsd) || solUsd <= 0) {
    throw new Error("--sol-usd must be a positive number");
  }

  console.log("Raydium launch simulation · $VISION / SOL (constant product x·y=k)");
  console.log(`SOL/USD          ${usd(solUsd, 2)}  (${solSource})`);
  console.log(`Total supply     ${fmt(supply, 0)} VISION`);
  console.log("Assumes Raydium AMM spot at t0, 0% fee, equal-value sides.");
  console.log("");

  for (const solInPool of solList) {
    printQuote(quote({ visionInPool, solInPool, solUsd, supply }), supply);
  }

  if (solList.length > 1) {
    console.log("────────────────────────────────────────");
    console.log("Summary");
    console.log(
      "SOL in pool | VISION/SOL        | VISION USD        | FDV           | Liquidity",
    );
    for (const solInPool of solList) {
      const row = quote({ visionInPool, solInPool, solUsd, supply });
      console.log(
        `${String(solInPool).padStart(11)} | ${row.priceSol.toFixed(12)} | ${usd(row.priceUsd, 8).padEnd(17)} | ${usd(row.fdvUsd, 0).padEnd(13)} | ${usd(row.liquidityUsd, 2)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
