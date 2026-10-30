/**
 * Dry-run by default. Plans a single restoration tx:
 *   transfer from the local keypair ATA → PHANTOM_OWNER ATA
 * or mintTo (only if ALLOW_MINT_TO_TARGET=true AND keypair is mint authority).
 *
 * Does not send unless RESTORE_EXECUTE=true and RESTORE_PHANTOM_OK=true.
 *
 *   npm run token:restore
 */
import "dotenv/config";

import {
  Connection,
  PublicKey,
  clusterApiUrl,
  type Cluster,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  mintTo,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import {
  parseMintAddress,
  parseOwnerAddress,
} from "../lib/token-guard";
import { loadSecretKeypair } from "./load-keypair";

function clusterFromEnv(): Cluster {
  const cluster = (process.env.SOLANA_CLUSTER ?? "mainnet-beta").trim();
  if (cluster === "mainnet-beta" || cluster === "devnet" || cluster === "testnet") {
    return cluster;
  }
  throw new Error(`Unsupported SOLANA_CLUSTER: ${cluster}`);
}

function uiAmount(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

async function restore() {
  const execute =
    process.env.RESTORE_EXECUTE === "true" &&
    process.env.RESTORE_PHANTOM_OK === "true";
  const cluster = clusterFromEnv();
  const rpc = process.env.SOLANA_RPC_URL?.trim() || clusterApiUrl(cluster);
  const mintAddress = parseMintAddress(process.env.TOKEN_MINT);
  const phantom = parseOwnerAddress(process.env.PHANTOM_OWNER, "PHANTOM_OWNER");
  const payer = loadSecretKeypair(
    process.env.MINT_AUTHORITY_KEYPAIR,
    process.env.MINT_AUTHORITY_SECRET,
  );
  const expectedUi = Number(process.env.EXPECTED_UI_SUPPLY ?? 1_000_000_000);
  const allowMint = process.env.ALLOW_MINT_TO_TARGET === "true";

  const connection = new Connection(rpc, { commitment: "confirmed" });
  const mint = await getMint(connection, mintAddress, "confirmed", TOKEN_PROGRAM_ID);

  const sourceAta = await getAssociatedTokenAddress(
    mintAddress,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  const destAta = await getAssociatedTokenAddress(
    mintAddress,
    phantom,
    false,
    TOKEN_PROGRAM_ID,
  );

  let sourceRaw = BigInt(0);
  try {
    sourceRaw = BigInt(
      (await getAccount(connection, sourceAta, "confirmed", TOKEN_PROGRAM_ID)).amount.toString(),
    );
  } catch {
    /* source ATA missing */
  }

  let destRaw = BigInt(0);
  let destExists = true;
  try {
    destRaw = BigInt(
      (await getAccount(connection, destAta, "confirmed", TOKEN_PROGRAM_ID)).amount.toString(),
    );
  } catch {
    destExists = false;
  }

  const expectedRaw = BigInt(expectedUi) * BigInt(10) ** BigInt(mint.decimals);
  const deficit = destRaw >= expectedRaw ? BigInt(0) : expectedRaw - destRaw;

  const plan = {
    mode: execute ? "EXECUTE" : "DRY_RUN",
    mint: mintAddress.toBase58(),
    decimals: mint.decimals,
    phantom: phantom.toBase58(),
    destAta: destAta.toBase58(),
    destExists,
    destUi: uiAmount(destRaw, mint.decimals),
    sourceAta: sourceAta.toBase58(),
    sourceUi: uiAmount(sourceRaw, mint.decimals),
    expectedUi,
    deficitUi: uiAmount(deficit, mint.decimals),
    mintAuthority: mint.mintAuthority?.toBase58() ?? null,
    payer: payer.publicKey.toBase58(),
    allowMint,
  };

  console.log("[plan]", JSON.stringify(plan, null, 2));

  if (deficit === BigInt(0)) {
    console.log("[ok] Phantom ATA already at or above expected UI supply. No tx needed.");
    return;
  }

  const canTransfer = sourceRaw >= deficit;
  const canMint =
    allowMint && mint.mintAuthority?.equals(payer.publicKey) === true;

  if (!canTransfer && !canMint) {
    console.log("[blocked] Cannot restore:");
    console.log(" - Transfer needs source ATA UI >= deficit (local keypair currently holds less).");
    console.log(" - mintTo needs ALLOW_MINT_TO_TARGET=true and this keypair as mint authority.");
    console.log("Set RESTORE_PHANTOM_OK=true and RESTORE_EXECUTE=true only after you confirm the plan.");
    process.exitCode = 1;
    return;
  }

  const action = canTransfer ? "transfer" : "mintTo";
  console.log(`[action] would ${action} ${uiAmount(deficit, mint.decimals)} UI to Phantom ATA`);

  if (!execute) {
    console.log(
      "[dry-run] No transaction sent. To execute after explicit review, set RESTORE_PHANTOM_OK=true and RESTORE_EXECUTE=true.",
    );
    return;
  }

  if (action === "transfer") {
    const tx = new Transaction();
    if (!destExists) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          destAta,
          phantom,
          mintAddress,
          TOKEN_PROGRAM_ID,
        ),
      );
    }
    tx.add(
      createTransferInstruction(
        sourceAta,
        destAta,
        payer.publicKey,
        deficit,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    const signature = await connection.sendTransaction(tx, [payer], {
      skipPreflight: false,
    });
    await connection.confirmTransaction(signature, "confirmed");
    console.log("[tx]", signature);
    console.log("[solscan]", `https://solscan.io/tx/${signature}`);
    return;
  }

  const signature = await mintTo(
    connection,
    payer,
    mintAddress,
    destAta,
    payer,
    deficit,
  );
  console.log("[mintTo.tx]", signature);
  console.log("[solscan]", `https://solscan.io/tx/${signature}`);
}

restore().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
