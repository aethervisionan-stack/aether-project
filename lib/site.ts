export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://aether-project-eight.vercel.app");

export const SITE_NAME = "Aether Vision";
export const SITE_TITLE =
  "Aether Vision — Vision 1.0 a 4.0 | Pré-venda on-chain de óculos de IA";
export const SITE_DESCRIPTION =
  "Pré-venda dos óculos inteligentes Vision 1.0 a 4.0. Aporte em SOL na tesouraria Squads Multisig, tokens $VISION e $AETH, App Bridge e IA descentralizada na Solana.";

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
