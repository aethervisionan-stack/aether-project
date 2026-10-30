/**
 * Move a $VISION float to the fulfillment relayer
 * (9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911).
 *
 * This keypair can only spend an ATA it owns. It cannot spend the Squads
 * vault ATA (CsthDwBh… / owner AVj6q1t8…). A snippet that calls
 * getOrCreateAssociatedTokenAccount(..., signer.publicKey) transfers from
 * the signer's ATA — which is currently empty — not from Squads.
 *
 * Preview:
 *   npx tsx scripts/fund-relayer.ts --amount 1000000
 *
 * Send (only if this keypair actually holds $VISION):
 *   npx tsx scripts/fund-relayer.ts --amount 1000000 --execute
 */
import "dotenv/config";

import {
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { loadDistributionKeypair } from "../lib/secret-keypair";
import { sendAndConfirmWithFreshBlockhash } from "../lib/send-with-blockhash";
import { parseMintAddress } from "../lib/token-guard";
import { SQUADS_VAULT } from "../lib/presale";

const RELAYER =
  process.env.PHANTOM_OWNER?.trim() ||
  "9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911";
const MIN_FEE_SOL = 0.005;

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function rpcUrl() {
  return process.env.SOLANA_RPC_URL?.trim() || clusterApiUrl("mainnet-beta");
}

async function connect(): Promise<Connection> {
  const urls = [rpcUrl(), "https://api.mainnet-beta.solana.com"];
  let last: unknown;
  for (const url of [...new Set(urls)]) {
    try {
      const connection = new Connection(url, "confirmed");
      await connection.getLatestBlockhash("confirmed");
      console.log("[rpc]", url);
      return connection;
    } catch (error) {
      last = error;
      console.log(
        "[rpc] failed",
        url,
        error instanceof Error ? error.message : error,
      );
    }
  }
  throw last instanceof Error ? last : new Error("No RPC available");
}

function uiOf(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const amountUi = Number(flag("amount") ?? "1000000");
  if (!Number.isFinite(amountUi) || amountUi <= 0) {
    console.error("[fund-relayer] --amount must be a positive UI $VISION amount");
    process.exitCode = 1;
    return;
  }

  const mint = parseMintAddress(
    process.env.TOKEN_MINT || "2iGxAEtYLYb8NBvtQEoPbuDZzTEezWzu7G3nYDrabftv",
  );
  const relayer = new PublicKey(RELAYER);
  const squads = new PublicKey(SQUADS_VAULT);
  const signer = loadDistributionKeypair();
  const connection = await connect();

  const mintAccount = await connection.getAccountInfo(mint, "confirmed");
  if (!mintAccount) {
    throw new Error(`mint ${mint.toBase58()} not found`);
  }
  const tokenProgram = mintAccount.owner;
  const mintInfo = await getMint(connection, mint, "confirmed", tokenProgram);
  const raw = BigInt(
    Math.round(amountUi * 10 ** mintInfo.decimals),
  );

  const signerAta = await getAssociatedTokenAddress(
    mint,
    signer.publicKey,
    false,
    tokenProgram,
  );
  const relayerAta = await getAssociatedTokenAddress(
    mint,
    relayer,
    false,
    tokenProgram,
  );
  const squadsAta = await getAssociatedTokenAddress(
    mint,
    squads,
    true,
    tokenProgram,
  );

  const signerAccount = await getAccount(
    connection,
    signerAta,
    "confirmed",
    tokenProgram,
  ).catch(() => null);
  const relayerAccount = await getAccount(
    connection,
    relayerAta,
    "confirmed",
    tokenProgram,
  ).catch(() => null);
  const squadsAccount = await getAccount(
    connection,
    squadsAta,
    "confirmed",
    tokenProgram,
  ).catch(() => null);

  const signerUi = signerAccount
    ? uiOf(BigInt(signerAccount.amount.toString()), mintInfo.decimals)
    : 0;
  const relayerUi = relayerAccount
    ? uiOf(BigInt(relayerAccount.amount.toString()), mintInfo.decimals)
    : 0;
  const squadsUi = squadsAccount
    ? uiOf(BigInt(squadsAccount.amount.toString()), mintInfo.decimals)
    : 0;
  const payerSol =
    (await connection.getBalance(signer.publicKey, "confirmed")) /
    LAMPORTS_PER_SOL;

  console.log("[signer]", signer.publicKey.toBase58());
  console.log("[relayer]", relayer.toBase58());
  console.log("[mint]", mint.toBase58(), "decimals", mintInfo.decimals);
  console.log("[amount UI]", amountUi, "raw", raw.toString());
  console.log("[signer ATA]", signerAta.toBase58(), "UI", signerUi);
  console.log("[relayer ATA]", relayerAta.toBase58(), "UI", relayerUi);
  console.log("[squads ATA]", squadsAta.toBase58(), "UI", squadsUi);
  console.log("[signer SOL]", payerSol);
  console.log("[execute]", execute ? "YES" : "NO (dry-run)");

  if (signer.publicKey.equals(relayer) && signerUi <= 0 && squadsUi > 0) {
    console.error(
      "[fund-relayer] refused: $VISION is in the Squads vault ATA, not in this keypair.\n" +
        "  getOrCreateAssociatedTokenAccount(..., signer.publicKey) would pull from an empty ATA.\n" +
        "  A Squads member private key cannot System/SPL-transfer vault tokens.\n" +
        "  In the Squads UI, send $VISION from " +
        squads.toBase58() +
        " to " +
        relayer.toBase58() +
        " (ATA " +
        relayerAta.toBase58() +
        ").",
    );
    process.exitCode = 1;
    return;
  }

  if (!signerAccount || BigInt(signerAccount.amount.toString()) < raw) {
    console.error(
      `[fund-relayer] signer ATA has ${signerUi} $VISION, need ${amountUi}`,
    );
    process.exitCode = 1;
    return;
  }
  if (payerSol < MIN_FEE_SOL) {
    console.error(
      `[fund-relayer] signer has ${payerSol} SOL; need >= ${MIN_FEE_SOL} for fees/rent`,
    );
    process.exitCode = 1;
    return;
  }

  if (!execute) {
    console.log("[dry-run] no transaction sent. Add --execute to broadcast.");
    return;
  }

  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
  ];
  if (!relayerAccount) {
    ixs.push(
      createAssociatedTokenAccountInstruction(
        signer.publicKey,
        relayerAta,
        relayer,
        mint,
        tokenProgram,
      ),
    );
  }
  ixs.push(
    createTransferInstruction(
      signerAta,
      relayerAta,
      signer.publicKey,
      raw,
      [],
      tokenProgram,
    ),
  );

  const signature = await sendAndConfirmWithFreshBlockhash(
    connection,
    signer,
    ixs,
  );
  console.log("[sent]", signature);
  console.log("[solscan]", `https://solscan.io/tx/${signature}`);
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
