import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Keypair } from "@solana/web3.js";

function keypairFromJson(json: unknown, label: string): Keypair {
  if (!Array.isArray(json) || json.length !== 64) {
    throw new Error(
      `${label} must be a JSON array of exactly 64 bytes. Got ${Array.isArray(json) ? json.length : typeof json}.`,
    );
  }
  const bytes = json.map((item) => Number(item));
  if (bytes.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
    throw new Error(`${label} contains values outside 0–255.`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function loadSecretKeypair(
  filePath: string | undefined,
  secretEnv: string | undefined,
): Keypair {
  if (filePath?.trim()) {
    const absolute = resolve(process.cwd(), filePath.trim());
    if (!existsSync(absolute)) {
      throw new Error(`Keypair file not found: ${absolute}`);
    }
    const json = JSON.parse(readFileSync(absolute, "utf8")) as unknown;
    return keypairFromJson(json, absolute);
  }

  if (secretEnv?.trim()) {
    return keypairFromJson(JSON.parse(secretEnv) as unknown, "secret env");
  }

  throw new Error(
    "Set MINT_AUTHORITY_KEYPAIR (JSON file) or MINT_AUTHORITY_SECRET / DISTRIBUTION_SECRET.",
  );
}

/** Phantom / mint authority used to send $VISION after a confirmed payment. Never log the secret. */
export function loadDistributionKeypair(): Keypair {
  const distribution = process.env.DISTRIBUTION_SECRET?.trim();
  if (distribution) {
    return keypairFromJson(JSON.parse(distribution) as unknown, "DISTRIBUTION_SECRET");
  }
  return loadSecretKeypair(
    process.env.MINT_AUTHORITY_KEYPAIR?.trim() || "./secrets/mint-authority.json",
    process.env.MINT_AUTHORITY_SECRET,
  );
}
