/**
 * Validates secrets/mint-authority.json against the project Phantom and
 * checks SOL + $VISION balances used by auto-fulfill.
 *
 * Diagnostic only (no transfer):
 *   npx tsx scripts/test-fulfillment.ts
 *
 * Replay a confirmed SOL order (sends $VISION if the keypair is valid):
 *   npx tsx scripts/test-fulfillment.ts --replay-order <ORDER_ID> --sol-signature <TX>
 *
 * HTTP (dev server running):
 *   curl -X POST http://localhost:3000/api/orders/<ORDER_ID>/sol-paid ^
 *     -H "Content-Type: application/json" ^
 *     -d "{\"signature\":\"<SOL_TX>\"}"
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
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { loadDistributionKeypair } from "../lib/secret-keypair";
import { parseMintAddress } from "../lib/token-guard";
import { sendAndConfirmWithFreshBlockhash } from "../lib/send-with-blockhash";

const EXPECTED_OWNER =
  process.env.PHANTOM_OWNER?.trim() ||
  "9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911";
const MIN_SOL_FOR_FEES = 0.005;

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL?.trim() ||
    clusterApiUrl("mainnet-beta")
  );
}

async function connect(): Promise<Connection> {
  const urls = [
    rpcUrl(),
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
  ];
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
  const expected = new PublicKey(EXPECTED_OWNER);
  const mint = parseMintAddress(
    process.env.TOKEN_MINT || "2iGxAEtYLYb8NBvtQEoPbuDZzTEezWzu7G3nYDrabftv",
  );

  console.log("[test] expected Phantom", expected.toBase58());
  console.log("[test] TOKEN_MINT", mint.toBase58());
  console.log("[test] keypair path", process.env.MINT_AUTHORITY_KEYPAIR || "./secrets/mint-authority.json");

  let payer;
  try {
    payer = loadDistributionKeypair();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[key] INVALID — cannot load secrets/mint-authority.json");
    console.log("[key] detail", message);
    console.log(
      "[key] Export the Phantom",
      expected.toBase58(),
      "as a 64-byte JSON array into secrets/mint-authority.json (gitignored).",
    );
    printSolPaidHelp();
    process.exitCode = 1;
    return;
  }

  const matches = payer.publicKey.equals(expected);
  console.log("[key] loaded pubkey", payer.publicKey.toBase58());
  console.log("[key] matches PHANTOM_OWNER", matches ? "YES" : "NO");
  if (!matches) {
    console.log(
      "[key] WARNING: file is a valid keypair but it is NOT the expected Phantom. Auto-send would use this other wallet.",
    );
  }

  const connection = await connect();
  const lamports = await connection.getBalance(payer.publicKey, "confirmed");
  const sol = lamports / LAMPORTS_PER_SOL;
  console.log("[sol] balance", sol, "SOL", `(${lamports} lamports)`);
  console.log("[sol] enough for fees (>=", MIN_SOL_FOR_FEES, ")", sol >= MIN_SOL_FOR_FEES ? "YES" : "NO — send SOL to this Phantom");
  console.log("[sol] solscan", `https://solscan.io/account/${payer.publicKey.toBase58()}`);

  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
  const ata = await getAssociatedTokenAddress(
    mint,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  let visionUi = 0;
  let ataExists = true;
  try {
    const account = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
    visionUi = Number(BigInt(account.amount.toString())) / 10 ** mintInfo.decimals;
  } catch {
    ataExists = false;
  }
  console.log("[vision] mint", mint.toBase58());
  console.log("[vision] ata", ata.toBase58());
  console.log("[vision] ata exists", ataExists ? "YES" : "NO");
  console.log("[vision] balance UI", visionUi);
  console.log("[vision] solscan token", `https://solscan.io/token/${mint.toBase58()}`);
  console.log("[vision] solscan ata", `https://solscan.io/account/${ata.toBase58()}`);

  const ready = matches && sol >= MIN_SOL_FOR_FEES && ataExists && visionUi > 0;
  console.log("[status]", ready ? "READY for auto-fulfill" : "NOT READY — see flags above");

  if (process.argv.includes("--smoke-send")) {
    if (!ready) {
      console.log("[smoke] skipped — key/balances not ready");
      process.exitCode = 1;
      return;
    }
    const dest = new PublicKey(flag("dest") || expected.toBase58());
    const amountUi = Number(flag("amount") ?? "1");
    const destAta = await getAssociatedTokenAddress(
      mint,
      dest,
      false,
      TOKEN_PROGRAM_ID,
    );
    let destBefore = 0;
    let destExists = true;
    try {
      const destAccount = await getAccount(
        connection,
        destAta,
        "confirmed",
        TOKEN_PROGRAM_ID,
      );
      destBefore =
        Number(BigInt(destAccount.amount.toString())) / 10 ** mintInfo.decimals;
    } catch {
      destExists = false;
    }
    const raw = BigInt(Math.round(amountUi * 10 ** mintInfo.decimals));
    const ixs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
    ];
    if (!destExists) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          destAta,
          dest,
          mint,
          TOKEN_PROGRAM_ID,
        ),
      );
    }
    ixs.push(
      createTransferInstruction(
        ata,
        destAta,
        payer.publicKey,
        raw,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    console.log("[smoke] sending", amountUi, "VISION to", dest.toBase58());
    const signature = await sendAndConfirmWithFreshBlockhash(
      connection,
      payer,
      ixs,
    );
    const destAfterAccount = await getAccount(
      connection,
      destAta,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
    const destAfter =
      Number(BigInt(destAfterAccount.amount.toString())) / 10 ** mintInfo.decimals;
    console.log("[smoke] dest ATA before", destBefore);
    console.log("[smoke] dest ATA after", destAfter);
    console.log("[smoke] signature", signature);
    console.log("[smoke] solscan", `https://solscan.io/tx/${signature}`);
    return;
  }

  const orderId = flag("replay-order");
  const solSignature = flag("sol-signature");
  if (orderId && solSignature) {
    if (!ready) {
      console.log("[replay] skipped — key/balances not ready");
      process.exitCode = 1;
      return;
    }
    const { markPaidAndFulfill } = await import("../lib/fulfill-vision");
    console.log("[replay] calling markPaidAndFulfill", { orderId, solSignature });
    const result = await markPaidAndFulfill(orderId, { solSignature });
    console.log("[replay] status", result.order.status);
    console.log("[replay] skipped", result.skipped ?? "none");
    if (result.order.splSignature) {
      console.log("[replay] VISION tx", result.order.splSignature);
      console.log("[replay] solscan", `https://solscan.io/tx/${result.order.splSignature}`);
    }
    if (result.order.fulfillError) {
      console.log("[replay] fulfillError", result.order.fulfillError);
      process.exitCode = 1;
    }
    return;
  }

  printSolPaidHelp();
}

function printSolPaidHelp() {
  console.log("");
  console.log("[how to test a live SOL order]");
  console.log("1. npm run dev");
  console.log("2. Complete checkout (e.g. 0.05 SOL) so an order is created with memo = order id.");
  console.log("3. Copy ORDER_ID from .data/orders.json (or the network tab) and the SOL signature.");
  console.log("4. Replay internally:");
  console.log("     npx tsx scripts/test-fulfillment.ts --replay-order <ORDER_ID> --sol-signature <SOL_TX>");
  console.log("5. Or hit the dev endpoint:");
  console.log("     curl -X POST http://localhost:3000/api/orders/<ORDER_ID>/sol-paid -H \"Content-Type: application/json\" -d \"{\\\"signature\\\":\\\"<SOL_TX>\\\"}\"");
  console.log("Watch the Next.js terminal for [sol-paid] and [fulfill] lines, then the Solscan tx hash.");
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
