import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Karla } from "next/font/google";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arq-display",
  display: "swap",
});

const sans = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arq-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "Arquétipo — Descubra o arquétipo que guia sua essência",
  description:
    "Teste gratuito dos 12 arquétipos junguianos em português. Em menos de 2 minutos, descubra seu arquétipo dominante e como posicioná-lo na vida e nos negócios.",
  alternates: { canonical: "/arquetipos" },
  openGraph: {
    title: "Arquétipo — Quiz dos 12 arquétipos junguianos",
    description:
      "Descubra o arquétipo que guia suas decisões e sua essência. Teste gratuito em menos de 2 minutos.",
    locale: "pt_BR",
    type: "website",
    url: "/arquetipos",
  },
};

export default function ArquetiposLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      lang="pt-BR"
      className={`${display.variable} ${sans.variable} font-[family-name:var(--font-arq-sans)] antialiased`}
    >
      {children}
    </div>
  );
}
