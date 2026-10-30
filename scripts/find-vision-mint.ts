/**
 * Discovers $VISION mint(s) from a wallet's token accounts and recent txs.
 * Looks for InitializeMint / InitializeMint2, Smithii payment program, Metaplex metadata.
 *
 *   npx tsx scripts/find-vision-mint.ts
 *   npx tsx scripts/find-vision-mint.ts <WALLET>
 */
import "dotenv/config";

import {
  Connection,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getMint,
} from "@solana/spl-token";
import { SQUADS_VAULT } from "../lib/presale";

const TOKEN_PROGRAM = TOKEN_PROGRAM_ID.toBase58();
const TOKEN_2022 = TOKEN_2022_PROGRAM_ID.toBase58();
const METAPLEX = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const SMITHII_PAY = "payTxVMsrh3oo81ocHb6xFge4vGUJenEFFa3sRdLNX2";
const SMITHII_VAULT = "5KgfWjGePnbFgDAuCqxB5oymuFxQskvCtrw6eYfDa7fj";
const SMITHII_ADMIN = "smt2qMoPxtJPa42BDwYH1yuugYuHri6wbhCjm25VeRo";
const WSOL = "So11111111111111111111111111111111111111112";

const MINT_IX = new Set(["initializeMint", "initializeMint2", "initializeMintCloseAuthority"]);

type Hit = {
  mint: string;
  source: string;
  signature?: string;
  decimals?: number;
  supplyUi?: number;
  mintAuthority?: string | null;
  name?: string;
  symbol?: string;
};

function rpcUrl() {
  return process.env.SOLANA_RPC_URL?.trim() || clusterApiUrl("mainnet-beta");
}

function uiAmount(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

async function describeMint(connection: Connection, mintStr: string, hit: Hit) {
  try {
    const mint = new PublicKey(mintStr);
    let info = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID).catch(
      () => null,
    );
    if (!info) {
      info = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    }
    hit.decimals = info.decimals;
    hit.supplyUi = uiAmount(BigInt(info.supply.toString()), info.decimals);
    hit.mintAuthority = info.mintAuthority?.toBase58() ?? null;
  } catch {
    /* not a mint */
  }
}

async function tokenAccounts(connection: Connection, owner: PublicKey): Promise<Hit[]> {
  const hits: Hit[] = [];
  for (const program of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const { value } = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: program,
    });
    for (const item of value) {
      const parsed = item.account.data.parsed as {
        info?: { mint?: string; tokenAmount?: { uiAmount?: number; decimals?: number } };
      };
      const mint = parsed.info?.mint;
      if (!mint || mint === WSOL) continue;
      const amount = parsed.info?.tokenAmount?.uiAmount ?? 0;
      hits.push({
        mint,
        source: `ata:${program.equals(TOKEN_PROGRAM_ID) ? "spl" : "token-2022"}`,
        decimals: parsed.info?.tokenAmount?.decimals,
        supplyUi: amount,
      });
    }
  }
  return hits;
}

async function scanSignatures(
  connection: Connection,
  owner: PublicKey,
  limitSigs = 400,
): Promise<Hit[]> {
  const hits: Hit[] = [];
  let before: string | undefined;
  let fetched = 0;

  while (fetched < limitSigs) {
    const batch = await connection.getSignaturesForAddress(owner, {
      limit: Math.min(100, limitSigs - fetched),
      before,
    });
    if (!batch.length) break;
    fetched += batch.length;
    before = batch[batch.length - 1]?.signature;

    const sigs = batch.map((item) => item.signature);
    const txs = await connection.getParsedTransactions(sigs, {
      maxSupportedTransactionVersion: 0,
    });

    for (let i = 0; i < txs.length; i += 1) {
      const tx = txs[i];
      const signature = sigs[i];
      if (!tx) continue;
      const keys = tx.transaction.message.accountKeys.map((key) => key.pubkey.toBase58());
      const programs = new Set(
        tx.transaction.message.instructions.map((ix) =>
          "programId" in ix ? ix.programId.toBase58() : "",
        ),
      );
      const smithii =
        programs.has(SMITHII_PAY) ||
        keys.includes(SMITHII_VAULT) ||
        keys.includes(SMITHII_ADMIN);

      const instructions = [
        ...tx.transaction.message.instructions,
        ...(tx.meta?.innerInstructions ?? []).flatMap((inner) => inner.instructions),
      ];

      for (const ix of instructions) {
        if (!("parsed" in ix) || !ix.parsed || typeof ix.parsed !== "object") continue;
        const parsed = ix.parsed as {
          type?: string;
          info?: { mint?: string; mintAuthority?: string };
        };
        const programId = ix.programId.toBase58();
        if (
          MINT_IX.has(parsed.type ?? "") &&
          (programId === TOKEN_PROGRAM || programId === TOKEN_2022)
        ) {
          const mint = parsed.info?.mint;
          if (mint) {
            hits.push({
              mint,
              source: smithii
                ? `initializeMint+smithii`
                : `initializeMint:${parsed.type}`,
              signature,
            });
          }
        }
        if (parsed.type === "mintTo" && parsed.info?.mint) {
          hits.push({
            mint: parsed.info.mint,
            source: smithii ? "mintTo+smithii" : "mintTo",
            signature,
          });
        }
      }

      if (smithii && programs.has(METAPLEX)) {
        const extras = keys.filter(
          (key) =>
            key !== owner.toBase58() &&
            key !== TOKEN_PROGRAM &&
            key !== TOKEN_2022 &&
            key !== METAPLEX &&
            key !== SMITHII_PAY &&
            key !== SMITHII_VAULT &&
            !key.startsWith("ComputeBudget") &&
            key !== "11111111111111111111111111111111",
        );
        for (const mint of extras.slice(0, 8)) {
          hits.push({
            mint,
            source: "smithii+metaplex-account-key",
            signature,
          });
        }
      }
    }
  }

  return hits;
}

async function fetchMetadata(mint: string): Promise<{ name?: string; symbol?: string }> {
  try {
    const url = `https://lite-api.jup.ag/tokens/v2/search?query=${mint}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return {};
    const json = (await response.json()) as Array<{
      id?: string;
      name?: string;
      symbol?: string;
    }>;
    const row = json.find((item) => item.id === mint) ?? json[0];
    return { name: row?.name, symbol: row?.symbol };
  } catch {
    return {};
  }
}

async function main() {
  const ownerStr =
    process.argv[2]?.trim() ||
    process.env.PHANTOM_OWNER?.trim() ||
    SQUADS_VAULT;
  const owner = new PublicKey(ownerStr);
  const connection = new Connection(rpcUrl(), { commitment: "confirmed" });

  console.log("[wallet]", owner.toBase58());
  console.log("[rpc]", rpcUrl());
  console.log("[note] TOKEN_MINT in .env is the Squads vault, not a mint.");

  const ataHits = await tokenAccounts(connection, owner);
  console.log(`[ata] ${ataHits.length} non-wSOL token account(s)`);

  let txHits: Hit[] = [];
  try {
    txHits = await scanSignatures(connection, owner);
    console.log(`[tx] scanned signatures, ${txHits.length} mint-related hit(s)`);
  } catch (error) {
    console.log(
      "[tx] signature scan failed:",
      error instanceof Error ? error.message : error,
    );
  }

  const byMint = new Map<string, Hit>();
  for (const hit of [...ataHits, ...txHits]) {
    const prev = byMint.get(hit.mint);
    if (!prev) byMint.set(hit.mint, { ...hit });
    else {
      prev.source = `${prev.source}, ${hit.source}`;
      prev.signature = prev.signature ?? hit.signature;
    }
  }

  const ranked: Hit[] = [];
  for (const hit of byMint.values()) {
    await describeMint(connection, hit.mint, hit);
    if (hit.decimals == null && !hit.source.startsWith("ata")) {
      continue;
    }
    const meta = await fetchMetadata(hit.mint);
    hit.name = meta.name;
    hit.symbol = meta.symbol;
    ranked.push(hit);
  }

  ranked.sort((a, b) => {
    const score = (hit: Hit) => {
      let n = 0;
      if (hit.symbol?.toUpperCase() === "VISION") n += 100;
      if (/aether/i.test(hit.name ?? "")) n += 80;
      if (hit.supplyUi && Math.abs(hit.supplyUi - 1_000_000_000) < 1) n += 60;
      if (hit.source.includes("smithii")) n += 40;
      if (hit.source.includes("initializeMint")) n += 30;
      return n;
    };
    return score(b) - score(a);
  });

  if (!ranked.length) {
    console.log(
      "[none] No SPL mint found on this wallet. Smithii Token Creator mints to the Phantom that signed — pass that pubkey:\n  npx tsx scripts/find-vision-mint.ts <PHANTOM_PUBKEY>",
    );
    process.exitCode = 1;
    return;
  }

  console.log("[candidates]");
  for (const hit of ranked.slice(0, 15)) {
    console.log(
      JSON.stringify(
        {
          mint: hit.mint,
          name: hit.name ?? null,
          symbol: hit.symbol ?? null,
          decimals: hit.decimals ?? null,
          supplyOrAtaUi: hit.supplyUi ?? null,
          mintAuthority: hit.mintAuthority ?? null,
          source: hit.source,
          signature: hit.signature ?? null,
          solscan: `https://solscan.io/token/${hit.mint}`,
        },
        null,
        2,
      ),
    );
  }

  const best =
    ranked.find(
      (hit) =>
        hit.symbol?.toUpperCase() === "VISION" ||
        /aether vision/i.test(hit.name ?? ""),
    ) ??
    ranked.find(
      (hit) => hit.supplyUi && Math.abs(hit.supplyUi - 1_000_000_000) < 1,
    ) ??
    ranked[0];

  console.log("[best]", best.mint);
  console.log("[solscan]", `https://solscan.io/token/${best.mint}`);
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
