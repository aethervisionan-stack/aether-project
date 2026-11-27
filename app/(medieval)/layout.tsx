import { Cinzel, Lora } from "next/font/google";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PRODUCT_BRANDS, PRODUCT_ROUTES } from "@/lib/products";
import "./medieval.css";

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
  alternates: { canonical: PRODUCT_ROUTES.quizMedieval },
  icons: {
    icon: [{ url: "/images/hero-dragon.jpg", type: "image/jpeg" }],
    apple: "/images/hero-dragon.jpg",
  },
  openGraph: {
    title: "Descubra o Seu Arquétipo Dominante",
    description:
      "12 provas em 3 etapas. Resultado com desejo central, forças, medo, sombra e pontuação.",
    locale: "pt_BR",
    type: "website",
    url: PRODUCT_ROUTES.quizMedieval,
    siteName: PRODUCT_BRANDS.quizMedieval,
    images: [{ url: "/images/hero-dragon.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Descubra o Seu Arquétipo Dominante",
    description:
      "12 provas em 3 etapas. Resultado com desejo central, forças, medo, sombra e pontuação.",
    images: ["/images/hero-dragon.jpg"],
  },
};

export default function MedievalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      lang="pt-BR"
      className={`medieval-shell ${display.variable} ${body.variable} font-[family-name:var(--font-arq-sans)] antialiased`}
    >
      {children}
    </div>
  );
}
