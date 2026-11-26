import { Instrument_Sans, Fraunces } from "next/font/google";
import type { ReactNode } from "react";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-iq-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-iq-display",
  display: "swap",
});

export default function TesteQiLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${instrument.variable} ${fraunces.variable} min-h-screen bg-[#09090B] text-zinc-100 antialiased`}
      style={{
        fontFamily: "var(--font-iq-sans), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <style>{`
        .font-iq-display {
          font-family: var(--font-iq-display), ui-serif, Georgia, serif;
          font-optical-sizing: auto;
        }
        .iq-shell {
          color-scheme: dark;
        }
      `}</style>
      {children}
    </div>
  );
}
