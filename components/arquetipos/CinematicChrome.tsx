"use client";

import type { ReactNode } from "react";

/** Horizontal medieval flourish between sections */
export function MedievalDivider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`mx-auto flex max-w-md items-center justify-center gap-3 py-2 ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 320 24"
        className="h-5 w-full max-w-sm text-[color:var(--cine-amber)]/55"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 12H118M202 12H312"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M128 12 L160 4 L192 12 L160 20 Z"
          stroke="currentColor"
          strokeWidth="1"
          fill="rgba(201,137,74,0.12)"
        />
        <circle cx="160" cy="12" r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Ornate corner brackets on a card */
export function OrnateCorners({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`cine-ornate relative ${className}`}>
      <span className="cine-corner cine-corner-tl" aria-hidden />
      <span className="cine-corner cine-corner-tr" aria-hidden />
      <span className="cine-corner cine-corner-bl" aria-hidden />
      <span className="cine-corner cine-corner-br" aria-hidden />
      {children}
    </div>
  );
}

/** Floating ember particles (CSS-only) */
export function EmberField({ className = "" }: { className?: string }) {
  return (
    <div className={`cine-embers pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className={`cine-ember cine-ember-${i + 1}`} />
      ))}
    </div>
  );
}

/** Sanctuary rune backdrop with opacity + vignette + top fade */
export function SanctuaryBackdrop({
  opacity = 0.45,
  className = "",
}: {
  opacity?: number;
  className?: string;
}) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url(/images/sanctuary-runes.jpg)",
          opacity,
        }}
      />
      {/* Top fade-in into solid void */}
      <div
        className="absolute inset-x-0 top-0 h-32 sm:h-40"
        style={{
          background:
            "linear-gradient(180deg, #070709 0%, rgba(7,7,9,0.75) 45%, transparent 100%)",
        }}
      />
      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 20%, rgba(7,7,9,0.55) 70%, rgba(7,7,9,0.92) 100%)",
        }}
      />
    </div>
  );
}

/** Octagon / lozenge icon medallion for Reinos */
export function RealmMedallion({
  children,
  accent,
  shape = "octagon",
}: {
  children: ReactNode;
  accent: string;
  shape?: "octagon" | "lozenge";
}) {
  return (
    <div
      className={
        shape === "lozenge" ? "cine-medallion-lozenge" : "cine-medallion-octagon"
      }
      style={{
        borderColor: accent,
        boxShadow: `0 0 18px ${accent}33, inset 0 0 12px ${accent}18`,
      }}
    >
      <span style={{ color: accent }}>{children}</span>
    </div>
  );
}
