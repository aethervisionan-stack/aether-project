import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import { ArchetypeQuizApp } from "@/components/arquetipos/ArchetypeQuizApp";

const display = localFont({
  src: "./fonts/CormorantGaramond-Regular.ttf",
  variable: "--font-arq-display",
  display: "swap",
  weight: "400 700",
});

const sans = localFont({
  src: "./fonts/Karla-Regular.ttf",
  variable: "--font-arq-sans",
  display: "swap",
  weight: "400 700",
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
    "Landing e teste gratuito dos 12 arquétipos junguianos em português. Em menos de 2 minutos, descubra seu arquétipo dominante e como posicioná-lo na vida e nos negócios.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Arquétipo — Quiz dos 12 arquétipos junguianos",
    description:
      "Descubra o arquétipo que guia suas decisões e sua essência. Teste gratuito em menos de 2 minutos.",
    locale: "pt_BR",
    type: "website",
    url: "/",
  },
};

export default function Page() {
  return (
    <div
      lang="pt-BR"
      className={`${display.variable} ${sans.variable} font-[family-name:var(--font-arq-sans)] antialiased`}
    >
      <ArchetypeQuizApp />
    </div>
  );
}
