import { Cinzel, Lora } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { ArchetypeQuizApp } from "@/components/arquetipos/ArchetypeQuizApp";

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
  themeColor: "#0a0c0f",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "Arquétipo — Mapa da Expedição Interior",
  description:
    "Teste gratuito dos 12 arquétipos de Carol Pearson / Jung. Doze marcos em três etapas: dominante, sub-arquétipo ou perfil híbrido.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Descubra o Seu Arquétipo Dominante",
    description:
      "12 marcos em 3 etapas. Relatório de expedição com desejo, forças, medos e perigos do terreno.",
    locale: "pt_BR",
    type: "website",
    url: "/",
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
