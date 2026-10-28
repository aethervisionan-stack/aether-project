import type { Metadata } from "next";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aether Vision — A ponte entre hardware e inteligência artificial",
  description:
    "Óculos inteligentes Aether Vision, App Bridge e pré-venda on-chain. Tesouraria Squads transparente. Tokens $VISION e $AETH para o app de IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-onyx text-ink antialiased font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
