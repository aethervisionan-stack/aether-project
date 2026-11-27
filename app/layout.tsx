import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * Minimal multi-product host shell.
 * Public routes (stable — do not rename without redirects):
 * - `/`          Quiz Medieval (ARCANUM) — `(medieval)`
 * - `/aether`    Aether Vision — `(aether)/aether`
 * - `/teste-qi`  TestLineQi — `(teste-qi)/teste-qi`
 *
 * Product metadata, favicons, fonts, and CSS live in route-group layouts.
 */

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "aether-project",
    template: "%s",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
