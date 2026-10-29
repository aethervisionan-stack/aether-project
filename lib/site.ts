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

export type WalletSessionAction = "modal" | "phantom-app" | "download";

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

export function isMobileSolanaClient(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(ua) || iPadOs;
}

export function phantomUniversalBrowseUrl(href?: string): string {
  const target =
    href ?? (typeof window !== "undefined" ? window.location.href : SITE_URL);
  const encoded = encodeURIComponent(target);
  return `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`;
}

export function requestWalletSession(openModal?: () => void): WalletSessionAction {
  if (hasInjectedSolanaWallet()) {
    openModal?.();
    return "modal";
  }

  if (isMobileSolanaClient()) {
    window.location.assign(phantomUniversalBrowseUrl());
    return "phantom-app";
  }

  const popup = window.open(PHANTOM_DOWNLOAD, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(PHANTOM_DOWNLOAD);
    return "download";
  }
  openModal?.();
  return "download";
}
