/**
 * Local-only: derive Phantom's default Solana keypair from a 12/24-word seed
 * and write secrets/mint-authority.json (gitignored). Never prints the mnemonic.
 *
 *   npx tsx scripts/import-phantom-mnemonic.ts
 *   # or, in this shell only (do not commit):
 *   $env:VISION_MNEMONIC="word1 word2 ... word12"; npx tsx scripts/import-phantom-mnemonic.ts
 *
 * Expected pubkey: 9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911
 */
import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Keypair } from "@solana/web3.js";
import { mnemonicToSeedSync, validateMnemonic } from "bip39";
import { derivePath } from "ed25519-hd-key";

const EXPECTED =
  process.env.PHANTOM_OWNER?.trim() ||
  "9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911";
const OUT_FILE = resolve(
  process.cwd(),
  process.env.MINT_AUTHORITY_KEYPAIR?.trim() || "./secrets/mint-authority.json",
);

const PATHS = [
  "m/44'/501'/0'/0'",
  "m/44'/501'/0'",
  "m/44'/501'/0'/0'/0'",
  "m/44'/501'/1'/0'",
];

function normalizeMnemonic(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function readMnemonic(): Promise<string> {
  const fromEnv = process.env.VISION_MNEMONIC?.trim();
  if (fromEnv) {
    return normalizeMnemonic(fromEnv);
  }

  const rl = createInterface({ input, output });
  try {
    console.log(
      "Paste the 12 (or 24) seed words for the Phantom that holds $VISION.",
    );
    console.log("Input is not echoed to logs. Leave empty to abort.");
    const line = await rl.question("mnemonic> ");
    return normalizeMnemonic(line);
  } finally {
    rl.close();
  }
}

function keypairFromPath(seed: Buffer, path: string): Keypair {
  const derived = derivePath(path, seed.toString("hex"));
  return Keypair.fromSeed(derived.key);
}

function keypairFromSeedHead(seed: Buffer): Keypair {
  return Keypair.fromSeed(seed.subarray(0, 32));
}

async function main() {
  const mnemonic = await readMnemonic();
  if (!mnemonic) {
    console.error("[abort] no mnemonic provided");
    process.exitCode = 1;
    return;
  }

  const words = mnemonic.split(" ");
  if (words.length !== 12 && words.length !== 24) {
    console.error(`[abort] expected 12 or 24 words, got ${words.length}`);
    process.exitCode = 1;
    return;
  }
  if (!validateMnemonic(mnemonic)) {
    console.error("[abort] bip39 checksum failed — check the words");
    process.exitCode = 1;
    return;
  }

  const seed = mnemonicToSeedSync(mnemonic);
  const candidates: Array<{ label: string; keypair: Keypair }> = [
    ...PATHS.map((path) => ({
      label: path,
      keypair: keypairFromPath(seed, path),
    })),
    { label: "bip39-seed[0..32] (solana-keygen style)", keypair: keypairFromSeedHead(seed) },
  ];

  const match = candidates.find((item) => item.keypair.publicKey.toBase58() === EXPECTED);
  const chosen = match ?? candidates[0];

  console.log("[derive] paths tried:");
  for (const item of candidates) {
    const ok = item.keypair.publicKey.toBase58() === EXPECTED;
    console.log(`  ${ok ? "MATCH" : "---- "} ${item.label} → ${item.keypair.publicKey.toBase58()}`);
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  const secret = Array.from(chosen.keypair.secretKey);
  writeFileSync(OUT_FILE, `${JSON.stringify(secret)}\n`, { encoding: "utf8", mode: 0o600 });

  const pubkey = chosen.keypair.publicKey.toBase58();
  const matches = pubkey === EXPECTED;
  console.log("[write]", OUT_FILE);
  console.log("[bytes]", secret.length);
  console.log("[pubkey]", pubkey);
  console.log("[expected]", EXPECTED);
  console.log("[match]", matches ? "YES" : "NO");
  if (!matches) {
    console.error(
      "[abort] derived pubkey does not match the project Phantom. File was still written from the first path — replace only after you confirm the account index in Phantom.",
    );
    process.exitCode = 1;
    return;
  }
  console.log("[ok] mint-authority.json is ready for npm run token:test-fulfillment");
}

main().catch((error) => {
  console.error("[error]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
