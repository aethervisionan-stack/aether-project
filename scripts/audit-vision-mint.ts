/**
 * Read-only audit of the $VISION mint, authorities, supply and ATAs.
 * Sends no transactions.
 *
 *   npm run token:audit
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
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { Metaplex } from "@metaplex-foundation/js";
import {
  assertMetadataUri,
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

async function readAta(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
) {
  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
  );
  try {
    const account = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
    return {
      ata: ata.toBase58(),
      exists: true,
      raw: account.amount.toString(),
      ui: uiAmount(BigInt(account.amount.toString()), 0),
      amount: account.amount,
    };
  } catch {
    return {
      ata: ata.toBase58(),
      exists: false,
      raw: "0",
      ui: 0,
      amount: BigInt(0),
    };
  }
}

async function audit() {
  const cluster = clusterFromEnv();
  const rpc = process.env.SOLANA_RPC_URL?.trim() || clusterApiUrl(cluster);
  const mintAddress = parseMintAddress(process.env.TOKEN_MINT);
  const metadataUri = process.env.METADATA_URI
    ? assertMetadataUri(process.env.METADATA_URI)
    : null;
  const expectedUi = Number(process.env.EXPECTED_UI_SUPPLY ?? 1_000_000_000);

  const connection = new Connection(rpc, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
  });

  console.log("[mode] read-only audit — no transactions");
  console.log("[rpc]", rpc);
  console.log("[cluster]", cluster);
  console.log("[mint]", mintAddress.toBase58());
  if (metadataUri) console.log("[metadataUri]", metadataUri);

  const mint = await getMint(connection, mintAddress, "confirmed", TOKEN_PROGRAM_ID);
  const supplyUi = uiAmount(BigInt(mint.supply.toString()), mint.decimals);

  const report: Record<string, unknown> = {
    mint: mintAddress.toBase58(),
    decimals: mint.decimals,
    supplyRaw: mint.supply.toString(),
    supplyUi,
    expectedUi,
    supplyMatchesExpected: supplyUi === expectedUi,
    mintAuthority: mint.mintAuthority?.toBase58() ?? null,
    freezeAuthority: mint.freezeAuthority?.toBase58() ?? null,
    isInitialized: mint.isInitialized,
  };

  let localPayer: PublicKey | null = null;
  try {
    const keypair = loadSecretKeypair(
      process.env.MINT_AUTHORITY_KEYPAIR,
      process.env.MINT_AUTHORITY_SECRET,
    );
    localPayer = keypair.publicKey;
    report.localKeypairPubkey = localPayer.toBase58();
    report.localKeypairIsMintAuthority = mint.mintAuthority
      ? mint.mintAuthority.equals(localPayer)
      : false;
  } catch (error) {
    report.localKeypair = error instanceof Error ? error.message : String(error);
  }

  if (localPayer) {
    const localAta = await readAta(connection, mintAddress, localPayer);
    const account = await getAccount(
      connection,
      new PublicKey(localAta.ata),
      "confirmed",
      TOKEN_PROGRAM_ID,
    ).catch(() => null);
    report.localAta = {
      ...localAta,
      ui: account
        ? uiAmount(BigInt(account.amount.toString()), mint.decimals)
        : 0,
    };
  }

  const phantomRaw = process.env.PHANTOM_OWNER?.trim();
  if (phantomRaw) {
    const phantom = parseOwnerAddress(phantomRaw, "PHANTOM_OWNER");
    const phantomAta = await readAta(connection, mintAddress, phantom);
    const account = phantomAta.exists
      ? await getAccount(
          connection,
          new PublicKey(phantomAta.ata),
          "confirmed",
          TOKEN_PROGRAM_ID,
        )
      : null;
    report.phantomOwner = phantom.toBase58();
    report.phantomAta = {
      ata: phantomAta.ata,
      exists: phantomAta.exists,
      raw: account?.amount.toString() ?? "0",
      ui: account
        ? uiAmount(BigInt(account.amount.toString()), mint.decimals)
        : 0,
    };
  } else {
    report.phantomOwner = "unset — set PHANTOM_OWNER to audit the main wallet ATA";
  }

  const metaplex = Metaplex.make(connection);
  const metadataPda = metaplex.nfts().pdas().metadata({ mint: mintAddress });
  const metadataAccount = await connection.getAccountInfo(metadataPda, "confirmed");
  report.metadataPda = metadataPda.toBase58();
  report.metadataExists = Boolean(metadataAccount);
  if (metadataAccount) {
    try {
      const nft = await metaplex.nfts().findByMint({ mintAddress });
      report.metadata = {
        name: nft.name,
        symbol: nft.symbol,
        uri: nft.uri,
        tokenStandard: nft.tokenStandard,
      };
    } catch (error) {
      report.metadataError = error instanceof Error ? error.message : String(error);
    }
  }

  const gaps: string[] = [];
  if (supplyUi !== expectedUi) {
    gaps.push(
      `On-chain supply UI ${supplyUi} != expected ${expectedUi}. Do not mint until this is reviewed.`,
    );
  }
  const phantomAta = report.phantomAta as { ui?: number; exists?: boolean } | undefined;
  if (phantomRaw && phantomAta && (!phantomAta.exists || (phantomAta.ui ?? 0) === 0)) {
    gaps.push(
      "Phantom ATA missing or zero. Restoration requires a gated transfer/mintTo (npm run token:restore -- dry-run first).",
    );
  }
  if (!report.metadataExists) {
    gaps.push("No Metaplex metadata account. Run token:metadata only after mint + authority are verified.");
  }
  report.gaps = gaps;

  console.log("[report]", JSON.stringify(report, null, 2));
  if (gaps.length) {
    console.log("[gaps]");
    for (const gap of gaps) console.log(" -", gap);
  } else {
    console.log("[ok] Mint, supply and metadata look consistent with the audit checks.");
  }
}

audit().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
