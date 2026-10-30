import { PublicKey } from "@solana/web3.js";
import { RECEIVE_TREASURY, SQUADS_VAULT } from "./presale";

/** Addresses that are wallets/vaults, never an SPL mint. */
export const KNOWN_NON_MINTS = [SQUADS_VAULT, RECEIVE_TREASURY] as const;

export function isKnownNonMint(value: string): boolean {
  const trimmed = value.trim();
  return KNOWN_NON_MINTS.some((item) => item === trimmed);
}

export function parseMintAddress(raw: string | undefined): PublicKey {
  const value = raw?.trim() ?? "";
  if (!value) {
    throw new Error(
      "TOKEN_MINT is empty. Paste the SPL mint from Phantom/Solscan, not the Squads vault.",
    );
  }
  if (isKnownNonMint(value)) {
    throw new Error(
      `TOKEN_MINT ${value} is a wallet/vault, not an SPL mint. Replace it with the $VISION mint address.`,
    );
  }
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`TOKEN_MINT is not a valid Solana public key: ${value}`);
  }
}

export function parseOwnerAddress(
  raw: string | undefined,
  label: string,
): PublicKey {
  const value = raw?.trim() ?? "";
  if (!value) {
    throw new Error(`${label} is empty.`);
  }
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a valid Solana public key.`);
  }
}

export function assertMetadataUri(uri: string | undefined): string {
  const value = uri?.trim() ?? "";
  if (!value) {
    throw new Error("METADATA_URI is empty.");
  }
  if (!/^https:\/\//i.test(value)) {
    throw new Error("METADATA_URI must be an https URL.");
  }
  return value;
}
