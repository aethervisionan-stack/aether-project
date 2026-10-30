import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Keypair } from "@solana/web3.js";

function parseSecretEnv(raw: string, label: string): Keypair {
  let parsed: unknown = JSON.parse(raw.trim());
  if (typeof parsed === "string") {
    parsed = JSON.parse(parsed);
  }
  return keypairFromJson(parsed, label);
}

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
  const pathValue = filePath?.trim();
  if (pathValue) {
    const absolute = resolve(process.cwd(), pathValue);
    if (existsSync(absolute)) {
      const json = JSON.parse(readFileSync(absolute, "utf8")) as unknown;
      return keypairFromJson(json, absolute);
    }
  }

  if (secretEnv?.trim()) {
    return parseSecretEnv(secretEnv, "secret env");
  }

  throw new Error(
    "Set MINT_AUTHORITY_KEYPAIR (JSON file) or MINT_AUTHORITY_SECRET / DISTRIBUTION_SECRET.",
  );
}

/** Phantom / mint authority used to send $VISION after a confirmed payment. Never log the secret. */
export function loadDistributionKeypair(): Keypair {
  const distribution = process.env.DISTRIBUTION_SECRET?.trim();
  if (distribution) {
    return parseSecretEnv(distribution, "DISTRIBUTION_SECRET");
  }
  return loadSecretKeypair(
    process.env.MINT_AUTHORITY_KEYPAIR?.trim() || "./secrets/mint-authority.json",
    process.env.MINT_AUTHORITY_SECRET,
  );
}
