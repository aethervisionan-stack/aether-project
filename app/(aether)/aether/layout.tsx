import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import { PRODUCT_ROUTES } from "@/lib/products";
import { AetherProviders } from "./providers";
import "./aether.css";

export const viewport: Viewport = {
  themeColor: "#030305",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "Aether Vision",
    "Vision 1.0",
    "AI glasses",
    "Solana presale",
    "Squads Multisig",
    "$VISION",
    "DePIN",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  alternates: { canonical: PRODUCT_ROUTES.aetherVision },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}${PRODUCT_ROUTES.aetherVision}`,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "Aether Vision - Real-time Edge AI hardware on Solana",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@VISIONAETH",
    creator: "@VISIONAETH",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "Aether Vision - Real-time Edge AI hardware on Solana",
      },
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  sameAs: ["https://x.com/VISIONAETH"],
  description: SITE_DESCRIPTION,
};

export default function AetherLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="aether-shell bg-onyx text-ink antialiased font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AetherProviders>{children}</AetherProviders>
    </div>
  );
}
