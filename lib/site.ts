function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return (vercel.startsWith("http") ? vercel : `https://${vercel}`).replace(
      /\/$/,
      "",
    );
  }
  return "https://aether-project-eight.vercel.app";
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "Aether Vision";
export const SITE_TITLE =
  "Aether Vision — Vision 1.0 to 4.0 | On-chain AI glasses presale";
export const SITE_DESCRIPTION =
  "Presale of Vision 1.0 to 4.0 smart glasses. Contribute SOL to the Squads Multisig treasury, $VISION and $AETH tokens, App Bridge and decentralized AI on Solana.";

export const PHANTOM_DOWNLOAD = "https://phantom.app/download";
export const BACKPACK_DOWNLOAD = "https://www.backpack.app/";

export type WalletBrand = "phantom" | "backpack";
export type WalletSessionAction = "modal" | "wallet-app" | "download";

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

function currentPageHref(href?: string): string {
  return (
    href ?? (typeof window !== "undefined" ? window.location.href : SITE_URL)
  );
}

export function phantomUniversalBrowseUrl(href?: string): string {
  const encoded = encodeURIComponent(currentPageHref(href));
  return `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`;
}

export function backpackUniversalBrowseUrl(href?: string): string {
  const encoded = encodeURIComponent(currentPageHref(href));
  return `https://backpack.app/ul/v1/browse/${encoded}?ref=${encoded}`;
}

export function requestWalletSession(
  openModal?: () => void,
  preferred: WalletBrand = "phantom",
): WalletSessionAction {
  if (hasInjectedSolanaWallet()) {
    openModal?.();
    return "modal";
  }

  if (isMobileSolanaClient()) {
    const deepLink =
      preferred === "backpack"
        ? backpackUniversalBrowseUrl()
        : phantomUniversalBrowseUrl();
    window.location.assign(deepLink);
    return "wallet-app";
  }

  const installUrl =
    preferred === "backpack" ? BACKPACK_DOWNLOAD : PHANTOM_DOWNLOAD;
  const popup = window.open(installUrl, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.assign(installUrl);
    return "download";
  }
  openModal?.();
  return "download";
}
