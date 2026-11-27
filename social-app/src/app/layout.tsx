import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { DebugPanel } from "@/components/DebugPanel";
import { PrototypeBanner } from "@/components/PrototypeBanner";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Chama — Aether Social (protótipo)",
  description:
    "Protótipo local de interação social com créditos, verificação facial simulada e VIP dual.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <AuthProvider>
          <PrototypeBanner />
          <AppShell>{children}</AppShell>
          <DebugPanel />
        </AuthProvider>
      </body>
    </html>
  );
}
