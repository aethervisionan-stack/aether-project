"use client";

import { useState } from "react";

const links = [
  { href: "#lite", label: "Aether Lite" },
  { href: "#tokenomics", label: "Tokenomics" },
  { href: "#utilidade", label: "Utilidade AETH" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-onyx/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#topo" className="flex items-center gap-2.5 font-display text-lg tracking-tight">
          <svg viewBox="0 0 32 32" width={28} height={28} aria-hidden className="text-neon">
            <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 6.5L24 22H8L16 6.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="16" cy="16" r="2.2" fill="currentColor" />
          </svg>
          <span>
            Aether<span className="text-neon">.</span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-neon">
              {link.label}
            </a>
          ))}
          <a
            href="#waitlist"
            className="rounded-full bg-neon px-4 py-2 font-medium text-onyx transition hover:brightness-110"
          >
            Lista de espera
          </a>
        </nav>
        <button
          type="button"
          className="text-sm text-neon md:hidden"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Fechar" : "Menu"}
        </button>
      </div>
      {open ? (
        <nav className="flex flex-col gap-3 border-t border-line px-5 py-4 text-sm md:hidden">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a href="#waitlist" className="text-neon" onClick={() => setOpen(false)}>
            Lista de espera
          </a>
        </nav>
      ) : null}
    </header>
  );
}
