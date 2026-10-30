/**
 * Dry-run SOL transfer from the fulfillment hot wallet
 * (secrets/mint-authority.json) to a destination Phantom.
 *
 * This is NOT the Squads treasury. Checkout SOL lands on
 * AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa and cannot be
 * moved with this keypair.
 *
 * Keep at least MIN_RESERVE SOL on the hot wallet for SPL fees.
 *
 * Preview:
 *   npx tsx scripts/withdraw-sol.ts --dest <PHANTOM_PUBKEY> --amount 0.01
 *
 * Send (mainnet):
 *   npx tsx scripts/withdraw-sol.ts --dest <PHANTOM_PUBKEY> --amount 0.01 --execute
 */
import "dotenv/config";

import {
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { loadDistributionKeypair } from "../lib/secret-keypair";
import { sendAndConfirmWithFreshBlockhash } from "../lib/send-with-blockhash";
import { SQUADS_VAULT } from "../lib/presale";

const MIN_RESERVE_SOL = 0.008;

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
      console.log("[rpc] failed", url, error instanceof Error ? error.message : error);
    }
  }
  throw last instanceof Error ? last : new Error("No RPC available");
}

async function main() {
  const destRaw = flag("dest")?.trim();
  if (!destRaw) {
    console.error(
      "Missing --dest. Pass your test Phantom pubkey, for example:\n" +
        "  npx tsx scripts/withdraw-sol.ts --dest SEU_ENDERECO_PHANTOM --amount 0.01",
    );
    process.exitCode = 1;
    return;
  }

  let dest: PublicKey;
  try {
    dest = new PublicKey(destRaw);
  } catch {
    console.error("[withdraw] --dest is not a valid Solana address");
    process.exitCode = 1;
    return;
  }

  const amountSol = Number(flag("amount") ?? "0.01");
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    console.error("[withdraw] --amount must be a positive SOL amount");
    process.exitCode = 1;
    return;
  }

  const execute = process.argv.includes("--execute");
  const payer = loadDistributionKeypair();
  const connection = await connect();
  const balance = await connection.getBalance(payer.publicKey, "confirmed");
  const balanceSol = balance / LAMPORTS_PER_SOL;
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const remainingSol = (balance - lamports) / LAMPORTS_PER_SOL;

  console.log("[from]", payer.publicKey.toBase58());
  console.log("[to]", dest.toBase58());
  console.log("[amount]", amountSol, "SOL", `(${lamports} lamports)`);
  console.log("[hot wallet SOL]", balanceSol);
  console.log("[would remain]", remainingSol);
  console.log("[execute]", execute ? "YES" : "NO (dry-run)");
  console.log("[solscan from]", `https://solscan.io/account/${payer.publicKey.toBase58()}`);
  console.log("[solscan to]", `https://solscan.io/account/${dest.toBase58()}`);

  if (dest.equals(payer.publicKey)) {
    console.error("[withdraw] destination is the same as the hot wallet — nothing to send");
    process.exitCode = 1;
    return;
  }
  if (dest.toBase58() === SQUADS_VAULT) {
    console.error("[withdraw] refused: destination is the Squads vault, not a test Phantom");
    process.exitCode = 1;
    return;
  }
  if (lamports > balance) {
    console.error("[withdraw] insufficient SOL on the hot wallet");
    process.exitCode = 1;
    return;
  }
  if (remainingSol < MIN_RESERVE_SOL) {
    console.error(
      `[withdraw] refused: would leave ${remainingSol} SOL, need at least ${MIN_RESERVE_SOL} SOL for $VISION fulfillment fees`,
    );
    process.exitCode = 1;
    return;
  }
  if (amountSol < 0.05) {
    console.log(
      "[note] checkout minimum is 0.05 SOL. This amount is only enough as a top-up, not a full test buy.",
    );
  }

  if (!execute) {
    console.log("[dry-run] no transaction sent. Add --execute to broadcast.");
    return;
  }

  const signature = await sendAndConfirmWithFreshBlockhash(connection, payer, [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: dest,
      lamports,
    }),
  ]);
  console.log("[sent]", signature);
  console.log("[solscan tx]", `https://solscan.io/tx/${signature}`);
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
