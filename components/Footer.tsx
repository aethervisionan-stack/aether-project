"use client";

import { useI18n } from "@/lib/i18n";
import { Mail, X } from "lucide-react";

const X_URL = "https://x.com/VISIONAETH";
const SUPPORT_EMAIL = "aethervision.an@gmail.com";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-display text-[13px] tracking-[0.34em] text-cyan">
            AETHER
          </p>
          <p className="mt-3 max-w-sm text-sm text-muted">{t.footer.rights}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors duration-300 hover:text-cyan"
          >
            <X size={15} />
            @VISIONAETH
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors duration-300 hover:text-cyan"
          >
            <Mail size={15} />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
      <p className="mx-auto max-w-6xl px-5 pb-12 text-xs leading-relaxed text-muted/80">
        {t.footer.disclaimer}
      </p>
    </footer>
  );
}
