/**
 * Registers / updates on-chain Metaplex metadata for the $VISION SPL token
 * (Create Metadata Account v3 via @metaplex-foundation/js) so Phantom can
 * display name, symbol, image and the 1,000,000,000 UI balance.
 *
 * Install:
 *   npm install @solana/web3.js @solana/spl-token @metaplex-foundation/js dotenv
 *   npm install -D tsx
 *
 * Run:
 *   cp .env.example .env
 *   npm run token:metadata
 */
import "dotenv/config";

import {
  Connection,
  clusterApiUrl,
  type Cluster,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  mintTo,
} from "@solana/spl-token";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { assertMetadataUri, parseMintAddress } from "../lib/token-guard";
import { loadSecretKeypair } from "./load-keypair";

const TOKEN_NAME = "Aether Vision";
const TOKEN_SYMBOL = "VISION";
const SELLER_FEE_BASIS_POINTS = 0;
const EXPECTED_UI_SUPPLY = Number(
  process.env.EXPECTED_UI_SUPPLY ?? 1_000_000_000,
);

function solscanClusterQuery(cluster: string): string {
  return cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
}

function solscanTx(signature: string, cluster: string): string {
  return `https://solscan.io/tx/${signature}${solscanClusterQuery(cluster)}`;
}

function solscanToken(mint: string, cluster: string): string {
  return `https://solscan.io/token/${mint}${solscanClusterQuery(cluster)}`;
}

function solscanAccount(address: string, cluster: string): string {
  return `https://solscan.io/account/${address}${solscanClusterQuery(cluster)}`;
}

function loadMintAuthority() {
  return loadSecretKeypair(
    process.env.MINT_AUTHORITY_KEYPAIR,
    process.env.MINT_AUTHORITY_SECRET,
  );
}

function clusterFromEnv(): Cluster | "mainnet-beta" | "devnet" | "testnet" {
  const cluster = (process.env.SOLANA_CLUSTER ?? "mainnet-beta").trim();
  if (cluster === "mainnet-beta" || cluster === "devnet" || cluster === "testnet") {
    return cluster;
  }
  throw new Error(`Unsupported SOLANA_CLUSTER: ${cluster}`);
}

function uiAmount(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

export async function registerVisionMetadata() {
  const cluster = clusterFromEnv();
  const rpc =
    process.env.SOLANA_RPC_URL?.trim() || clusterApiUrl(cluster);
  const mintAddress = parseMintAddress(process.env.TOKEN_MINT);
  const metadataUri = assertMetadataUri(process.env.METADATA_URI);
  const payer = loadMintAuthority();

  const connection = new Connection(rpc, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
  });

  console.log("[rpc]", rpc);
  console.log("[cluster]", cluster);
  console.log("[payer]", payer.publicKey.toBase58());
  console.log("[mint]", mintAddress.toBase58());
  console.log("[uri]", metadataUri);

  const mint = await getMint(connection, mintAddress, "confirmed", TOKEN_PROGRAM_ID);
  console.log("[mint.decimals]", mint.decimals);
  console.log("[mint.supply.raw]", mint.supply.toString());
  console.log(
    "[mint.supply.ui]",
    uiAmount(BigInt(mint.supply.toString()), mint.decimals),
  );
  console.log("[mint.mintAuthority]", mint.mintAuthority?.toBase58() ?? "none");

  if (
    mint.mintAuthority &&
    !mint.mintAuthority.equals(payer.publicKey)
  ) {
    console.warn(
      "[warn] Loaded keypair is not the mint authority. Metadata create/update still needs this key to be update/mint authority.",
    );
  }

  const ata = await getAssociatedTokenAddress(
    mintAddress,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );
  console.log("[ata]", ata.toBase58());

  let ataRaw = BigInt(0);
  try {
    const account = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
    ataRaw = BigInt(account.amount.toString());
    console.log("[ata.amount.raw]", ataRaw.toString());
    console.log("[ata.amount.ui]", uiAmount(ataRaw, mint.decimals));
  } catch {
    console.warn(
      "[warn] ATA not found for the creator wallet. Phantom shows the token after the ATA exists and holds balance.",
    );
  }

  const expectedRaw =
    BigInt(EXPECTED_UI_SUPPLY) * BigInt(10) ** BigInt(mint.decimals);
  const allowMint = process.env.ALLOW_MINT_TO_TARGET === "true";

  if (ataRaw < expectedRaw) {
    console.warn(
      `[warn] ATA UI balance ${uiAmount(ataRaw, mint.decimals)} < target ${EXPECTED_UI_SUPPLY}.`,
    );
    if (allowMint && mint.mintAuthority?.equals(payer.publicKey)) {
      const delta = expectedRaw - ataRaw;
      console.log("[mintTo.delta.raw]", delta.toString());
      const mintSig = await mintTo(
        connection,
        payer,
        mintAddress,
        ata,
        payer,
        delta,
      );
      console.log("[mintTo.signature]", mintSig);
      console.log("[mintTo.solscan]", solscanTx(mintSig, cluster));
    } else if (allowMint) {
      throw new Error("ALLOW_MINT_TO_TARGET=true but this keypair is not mint authority.");
    }
  } else {
    console.log("[ata] target supply already covered for Phantom display.");
  }

  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));
  const metadataPda = metaplex.nfts().pdas().metadata({ mint: mintAddress });
  console.log("[metadata.pda]", metadataPda.toBase58());

  let signature: string;
  let action: "create" | "update";

  const metadataAccount = await connection.getAccountInfo(metadataPda, "confirmed");
  if (metadataAccount) {
    const existing = await metaplex.nfts().findByMint({ mintAddress });
    console.log("[metadata] existing — updating on-chain fields.");
    const { response } = await metaplex.nfts().update({
      nftOrSft: existing,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      uri: metadataUri,
      sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS,
      isMutable: true,
    });
    signature = response.signature;
    action = "update";
  } else {
    console.log("[metadata] none — creating Metadata Account v3 via createSft.");
    const { response } = await metaplex.nfts().createSft({
      uri: metadataUri,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS,
      useExistingMint: mintAddress,
      updateAuthority: payer,
      mintAuthority: payer,
      tokenStandard: TokenStandard.Fungible,
      decimals: mint.decimals,
      isMutable: true,
      tokenOwner: payer.publicKey,
    });
    signature = response.signature;
    action = "create";
  }

  const confirmation = await connection.confirmTransaction(signature, "confirmed");
  if (confirmation.value.err) {
    throw new Error(
      `Metadata ${action} confirmed with error: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  const refreshed = await metaplex.nfts().findByMint({ mintAddress });
  const refreshedAta = await getAccount(
    connection,
    ata,
    "confirmed",
    TOKEN_PROGRAM_ID,
  ).catch(() => null);

  const result = {
    action,
    name: refreshed.name,
    symbol: refreshed.symbol,
    uri: refreshed.uri,
    tokenStandard: refreshed.tokenStandard,
    mint: mintAddress.toBase58(),
    metadata: metadataPda.toBase58(),
    ata: ata.toBase58(),
    ataUi: refreshedAta
      ? uiAmount(BigInt(refreshedAta.amount.toString()), mint.decimals)
      : 0,
    signature,
    solscan: {
      transaction: solscanTx(signature, cluster),
      token: solscanToken(mintAddress.toBase58(), cluster),
      metadata: solscanAccount(metadataPda.toBase58(), cluster),
      ata: solscanAccount(ata.toBase58(), cluster),
    },
  };

  console.log("[done]", JSON.stringify(result, null, 2));
  console.log(
    "[phantom] Restart Phantom after confirmation. The token list uses on-chain name/symbol/uri.",
  );
  return result;
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  /register-vision-metadata/.test(process.argv[1].replaceAll("\\", "/"));

if (isDirectRun) {
  registerVisionMetadata().catch((error) => {
    console.error("[error]", error);
    process.exitCode = 1;
  });
}

