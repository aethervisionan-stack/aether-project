export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://aether-project-eight.vercel.app");

export const SITE_NAME = "Aether Vision";
export const SITE_TITLE =
  "Aether Vision — Vision 1.0 to 4.0 | On-chain AI glasses presale";
export const SITE_DESCRIPTION =
  "Presale of Vision 1.0 to 4.0 smart glasses. Contribute SOL to the Squads Multisig treasury, $VISION and $AETH tokens, App Bridge and decentralized AI on Solana.";

export const PHANTOM_DOWNLOAD = "https://phantom.app/download";
export const BACKPACK_DOWNLOAD = "https://www.backpack.app/";

export function hasInjectedSolanaWallet(): boolean {
  if (typeof window === "undefined") return false;
  const injected = window as Window & {
    solana?: { isPhantom?: boolean };
    phantom?: { solana?: unknown };
    backpack?: unknown;
  };
  return Boolean(
    injected.phantom?.solana ||
      injected.solana?.isPhantom ||
      injected.solana ||
      injected.backpack,
  );
}
