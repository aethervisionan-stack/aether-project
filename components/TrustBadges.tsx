"use client";

import { useI18n } from "@/lib/i18n";
import { ShieldCheck } from "lucide-react";

function SolanaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
    >
      <path
        d="M5.2 16.7c.2-.2.5-.3.8-.3h14.3c.5 0 .8.6.4 1l-2.7 2.7c-.2.2-.5.3-.8.3H3.9c-.5 0-.8-.6-.4-1l2.7-2.7Z"
        fill="currentColor"
      />
      <path
        d="M5.2 3.3c.2-.2.5-.3.8-.3h14.3c.5 0 .8.6.4 1l-2.7 2.7c-.2.2-.5.3-.8.3H3.9c-.5 0-.8-.6-.4-1L5.2 3.3Z"
        fill="currentColor"
      />
      <path
        d="M18.8 10c-.2-.2-.5-.3-.8-.3H3.7c-.5 0-.8.6-.4 1l2.7 2.7c.2.2.5.3.8.3h14.3c.5 0 .8-.6.4-1L18.8 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TrustBadges({ className = "" }: { className?: string }) {
  const { t } = useI18n();

  return (
    <ul
      className={`flex flex-wrap gap-2 ${className}`.trim()}
      aria-label={t.trust.label}
    >
      <li className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
        <SolanaMark className="h-3.5 w-3.5 text-cyan" />
        <span>{t.trust.solana}</span>
      </li>
      <li className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-cyan" />
        <span>{t.trust.squads}</span>
      </li>
    </ul>
  );
}
