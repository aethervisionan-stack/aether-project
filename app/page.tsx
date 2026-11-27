import { Cinzel, Lora } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { ArchetypeQuizApp } from "@/components/arquetipos/ArchetypeQuizApp";

/** Quiz Medieval (`quiz-medieval`) — brand ARCANUM • XII. Canonical route `/`. */

const display = Cinzel({
  subsets: ["latin"],
  variable: "--font-arq-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const body = Lora({
  subsets: ["latin"],
  variable: "--font-arq-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#050608",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "ARCANUM • XII — Descubra o Seu Arquétipo Dominante",
  description:
    "Teste gratuito dos 12 arquétipos de Jung. Doze provas em três etapas: dominante, sub-arquétipo ou perfil híbrido.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Descubra o Seu Arquétipo Dominante",
    description:
      "12 provas em 3 etapas. Resultado com desejo central, forças, medo, sombra e pontuação.",
    locale: "pt_BR",
    type: "website",
    url: "/",
    images: [{ url: "/images/hero-dragon.jpg" }],
  },
};

export default function Page() {
  return (
    <div
      lang="pt-BR"
      className={`${display.variable} ${body.variable} font-[family-name:var(--font-arq-sans)] antialiased`}
    >
      <ArchetypeQuizApp />
    </div>
  );
}
