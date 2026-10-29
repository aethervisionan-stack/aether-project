import type { Metadata, Viewport } from "next";
import { AppProviders } from "./providers";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#030305",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
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
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og.jpg",
        width: 1376,
        height: 768,
        alt: "Aether Vision — Vision 1.0 to 4.0, on-chain AI glasses presale",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@VISIONAETH",
    creator: "@VISIONAETH",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="bg-onyx text-ink antialiased font-sans"
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
