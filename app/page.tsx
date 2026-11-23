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
  title: "Arquétipo — Descubra o Seu Arquétipo Dominante",
  description:
    "Teste gratuito dos 12 arquétipos de Carol Pearson / Jung. Doze perguntas em três etapas: dominante, sub-arquétipo ou perfil híbrido.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Descubra o Seu Arquétipo Dominante",
    description:
      "12 perguntas em 3 etapas. Resultado com desejo central, forças, medo, sombra e gráfico de pontuação.",
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
