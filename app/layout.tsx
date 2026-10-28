import type { Metadata } from "next";
import { IBM_Plex_Sans, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const ibm = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aether Vision — Wearable IA, $VISION e $AETH",
  description:
    "Óculos Aether Vision, App Bridge e pré-venda de vouchers. Tesouraria Squads transparente. Tokens $VISION e $AETH para o app de IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${ibm.variable}`}>
      <body className="min-h-screen bg-onyx antialiased">{children}</body>
    </html>
  );
}
