/**
 * Mint 1_000_000_000 new $VISION (9 decimals) to the distribution relayer.
 *
 *   npx tsx scripts/mint-fresh-supply.ts
 *
 * Signer: PRIVATE_KEY / ADMIN_PRIVATE_KEY (bs58), else mint-authority.json /
 * MINT_AUTHORITY_SECRET (64-byte JSON). Must match on-chain mintAuthority.
 */
import "dotenv/config";

import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { loadDistributionKeypair } from "../lib/secret-keypair";

const MINT = new PublicKey("2iGxAEtYLYb8NBvtQEoPbuDZzTEezWzu7G3nYDrabftv");
const RELAYER = new PublicKey("9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911");
const DECIMALS = 9;
const UI_AMOUNT = 1_000_000_000;
const RAW_AMOUNT = BigInt(UI_AMOUNT) * BigInt(10) ** BigInt(DECIMALS);

function loadMintSigner(): Keypair {
  const raw = (
    process.env.PRIVATE_KEY ||
    process.env.ADMIN_PRIVATE_KEY ||
    ""
  ).trim();
  if (raw) {
    if (raw.startsWith("[")) {
      const bytes = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(bytes));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  }
  return loadDistributionKeypair();
}

async function connect(): Promise<Connection> {
  const urls = [
    process.env.SOLANA_RPC_URL?.trim(),
    "https://api.mainnet-beta.solana.com",
    clusterApiUrl("mainnet-beta"),
  ].filter((url): url is string => Boolean(url));
  let last: unknown;
  for (const url of [...new Set(urls)]) {
    try {
      const connection = new Connection(url, "confirmed");
      await connection.getLatestBlockhash("confirmed");
      console.log("[rpc]", url);
      return connection;
    } catch (error) {
      last = error;
      console.warn(
        "[rpc] failed",
        url,
        error instanceof Error ? error.message : error,
      );
    }
  }
  throw last instanceof Error ? last : new Error("No Solana RPC available");
}

async function main() {
  const signer = loadMintSigner();
  console.log("[signer]", signer.publicKey.toBase58());
  console.log("[mint]", MINT.toBase58());
  console.log("[relayer]", RELAYER.toBase58());
  console.log("[ui]", UI_AMOUNT, "decimals", DECIMALS, "raw", RAW_AMOUNT.toString());

  const connection = await connect();
  const mintInfo = await getMint(connection, MINT, "confirmed");
  if (mintInfo.decimals !== DECIMALS) {
    throw new Error(
      `On-chain decimals are ${mintInfo.decimals}, expected ${DECIMALS}`,
    );
  }
  const authority = mintInfo.mintAuthority;
  if (!authority) {
    throw new Error("Mint authority is revoked; mintTo is impossible");
  }
  if (!authority.equals(signer.publicKey)) {
    throw new Error(
      `Signer ${signer.publicKey.toBase58()} is not mint authority ${authority.toBase58()}`,
    );
  }

  const supplyBefore =
    Number(mintInfo.supply) / 10 ** mintInfo.decimals;
  console.log("[supply before UI]", supplyBefore);
  console.log("[mint authority]", authority.toBase58());

  console.log("[ata] getOrCreateAssociatedTokenAccount for relayer");
  const dest = await getOrCreateAssociatedTokenAccount(
    connection,
    signer,
    MINT,
    RELAYER,
  );
  console.log("[relayer ATA]", dest.address.toBase58());
  console.log(
    "[relayer ATA before UI]",
    Number(dest.amount) / 10 ** mintInfo.decimals,
  );

  console.log("[mintTo] sending");
  const signature = await mintTo(
    connection,
    signer,
    MINT,
    dest.address,
    signer,
    RAW_AMOUNT,
  );
  console.log("[confirmed]", signature);
  console.log("[solscan]", `https://solscan.io/tx/${signature}`);

  const after = await getMint(connection, MINT, "confirmed");
  const destAfter = await getOrCreateAssociatedTokenAccount(
    connection,
    signer,
    MINT,
    RELAYER,
  );
  console.log(
    "[supply after UI]",
    Number(after.supply) / 10 ** after.decimals,
  );
  console.log(
    "[relayer ATA after UI]",
    Number(destAfter.amount) / 10 ** after.decimals,
  );
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
