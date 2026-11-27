import { IBM_Plex_Sans, Outfit } from "next/font/google";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import { PRODUCT_BRANDS, PRODUCT_ROUTES } from "@/lib/products";
import "./teste-qi.css";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-iq-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-iq-display",
  display: "swap",
});

const IQ_TITLE = "Teste de QI Profissional";
const IQ_DESCRIPTION =
  "Avaliação cognitiva digital de raciocínio abstrato-lógico (média 100, DP 15), com intervalo de confiança, percentil em linguagem clara e aviso: não substitui avaliação neuropsicológica presencial.";

export const viewport: Viewport = {
  themeColor: "#06070A",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

/** Exclusive TestLineQi metadata / OG — does not inherit Aether Vision social cards. */
export const metadata: Metadata = {
  title: IQ_TITLE,
  description: IQ_DESCRIPTION,
  applicationName: PRODUCT_BRANDS.testlineqi,
  robots: { index: false, follow: false },
  alternates: { canonical: PRODUCT_ROUTES.testlineqi },
  icons: {
    icon: [
      { url: "/testlineqi-brain-icon.png", type: "image/png" },
      { url: "/testlineqi-logo.png", type: "image/png" },
    ],
    apple: "/testlineqi-brain-icon.png",
  },
  openGraph: {
    title: IQ_TITLE,
    description: IQ_DESCRIPTION,
    locale: "pt_BR",
    type: "website",
    url: `${SITE_URL}${PRODUCT_ROUTES.testlineqi}`,
    siteName: PRODUCT_BRANDS.testlineqi,
    images: [
      {
        url: "/testlineqi-logo.png",
        width: 1200,
        height: 630,
        alt: "TestLineQi — Teste de QI Profissional",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: IQ_TITLE,
    description: IQ_DESCRIPTION,
    images: ["/testlineqi-logo.png"],
  },
};

export default function TesteQiLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${ibmPlex.variable} ${outfit.variable} iq-shell min-h-screen overflow-x-hidden bg-[#06070A] text-zinc-100 antialiased`}
      style={{
        fontFamily: "var(--font-iq-sans), ui-sans-serif, system-ui, sans-serif",
        colorScheme: "dark",
      }}
    >
      <style>{`
        .font-iq-display {
          font-family: var(--font-iq-display), ui-sans-serif, system-ui, sans-serif;
          font-optical-sizing: auto;
          letter-spacing: -0.02em;
        }
        .iq-shell {
          color-scheme: dark;
        }
        .iq-shell :where(input, button, a, [role="tab"]) {
          -webkit-tap-highlight-color: transparent;
        }
        @media (prefers-reduced-motion: reduce) {
          .iq-shell * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
