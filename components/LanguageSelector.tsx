"use client";

import { useI18n, type Locale } from "@/lib/i18n";
import { Globe } from "lucide-react";
import { useState } from "react";

const OPTIONS: { id: Locale; label: "en" | "pt" | "es" }[] = [
  { id: "en", label: "en" },
  { id: "pt", label: "pt" },
  { id: "es", label: "es" },
];

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      <div className="relative">
        {open ? (
          <div className="absolute bottom-12 right-0 mb-1 flex overflow-hidden rounded-full border border-white/10 bg-[#030305]/85 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setLocale(option.id);
                  setOpen(false);
                }}
                className={`px-3 py-2 font-mono text-[11px] tracking-[0.14em] transition ${
                  locale === option.id
                    ? "bg-cyan/15 text-cyan"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.lang[option.label]}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          aria-label={t.lang.label}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#030305]/85 px-3 py-2 text-ink shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-cyan/40"
        >
          <Globe size={14} className="text-cyan" />
          <span className="font-mono text-[11px] tracking-[0.16em]">
            {t.lang[locale]}
          </span>
        </button>
      </div>
    </div>
  );
}
