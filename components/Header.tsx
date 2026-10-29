"use client";

import { useI18n } from "@/lib/i18n";
import { Mail, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useMemo, useState } from "react";

const X_URL = "https://x.com/VISIONAETH";
const SUPPORT_EMAIL = "aethervision.an@gmail.com";

export function Header() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useMemo(
    () =>
      [
        { href: "#hardware", label: t.nav.hardware },
        { href: "#presale", label: t.nav.presale },
        { href: "#tokenomics", label: t.nav.tokenomics },
        { href: "#visao", label: t.nav.vision },
        { href: "#desenvolvimento", label: t.nav.updates },
      ] as const,
    [t],
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#030305]/72 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <a
          href="#topo"
          className="group inline-flex items-center gap-2.5"
          aria-label="Aether Vision"
        >
          <Image
            src="/logo.png"
            alt=""
            width={80}
            height={36}
            priority
            className="h-9 w-auto object-contain transition duration-500 ease-out group-hover:brightness-110 group-hover:drop-shadow-[0_0_14px_rgba(34,211,238,0.55)]"
          />
          <span className="font-display text-[13px] font-semibold tracking-[0.34em] bg-gradient-to-r from-cyan via-neon to-violet bg-clip-text text-transparent">
            AETHER
          </span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex" aria-label={t.nav.primary}>
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[13px] text-muted transition-colors duration-300 hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-white/10 p-2 text-muted transition duration-300 hover:border-cyan/40 hover:text-cyan sm:inline-flex"
            aria-label="X @VISIONAETH"
          >
            <X size={14} />
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="hidden rounded-full border border-white/10 p-2 text-muted transition duration-300 hover:border-cyan/40 hover:text-cyan sm:inline-flex"
            aria-label={SUPPORT_EMAIL}
          >
            <Mail size={14} />
          </a>
          <a
            href="#presale"
            className="cta-pulse glow-cta hidden rounded-full bg-gradient-to-r from-cyan to-neon px-4 py-2 text-[13px] font-medium text-onyx transition duration-300 hover:brightness-110 md:inline-flex"
          >
            {t.nav.secureKit}
          </a>
          <button
            type="button"
            className="inline-flex rounded-full border border-white/10 p-2 text-ink lg:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/10 lg:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-col gap-3 px-5 py-5">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#presale"
                className="cta-pulse glow-cta mt-2 inline-flex w-fit rounded-full bg-gradient-to-r from-cyan to-neon px-4 py-2 text-sm font-medium text-onyx"
                onClick={() => setMenuOpen(false)}
              >
                {t.nav.secureKit}
              </a>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
