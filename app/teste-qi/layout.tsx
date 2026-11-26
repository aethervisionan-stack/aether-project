import { IBM_Plex_Sans, Outfit } from "next/font/google";
import type { ReactNode } from "react";

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

export default function TesteQiLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${ibmPlex.variable} ${outfit.variable} min-h-screen overflow-x-hidden bg-[#06070A] text-zinc-100 antialiased`}
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
