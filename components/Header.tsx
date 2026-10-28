"use client";

import { Mail, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const NAV = [
  { href: "#hardware", label: "Hardware" },
  { href: "#presale", label: "Pré-venda" },
  { href: "#tokenomics", label: "Tokenomics" },
  { href: "#visao", label: "Visão" },
  { href: "#desenvolvimento", label: "Updates" },
] as const;

const X_URL = "https://x.com/VISIONAETH";
const SUPPORT_EMAIL = "aethervision.an@gmail.com";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#030305]/72 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <a
          href="#topo"
          className="font-display text-[13px] font-semibold tracking-[0.34em]"
        >
          <span className="bg-gradient-to-r from-cyan via-neon to-violet bg-clip-text text-transparent">
            AETHER
          </span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
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
            aria-label="E-mail de suporte"
          >
            <Mail size={14} />
          </a>
          <a
            href="#presale"
            className="glow-cta hidden rounded-full bg-gradient-to-r from-cyan to-neon px-4 py-2 text-[13px] font-medium text-onyx transition duration-300 hover:brightness-110 md:inline-flex"
          >
            Garantir Kit
          </a>
          <button
            type="button"
            className="inline-flex rounded-full border border-white/10 p-2 text-ink lg:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
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
              {NAV.map((item) => (
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
                className="glow-cta mt-2 inline-flex w-fit rounded-full bg-gradient-to-r from-cyan to-neon px-4 py-2 text-sm font-medium text-onyx"
                onClick={() => setMenuOpen(false)}
              >
                Garantir Kit
              </a>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
