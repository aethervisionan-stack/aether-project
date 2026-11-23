"use client";

type Props = {
  onStartQuiz: () => void;
  compact?: boolean;
};

const NAV = [
  { href: "#provacoes", label: "Provações" },
  { href: "#reinos", label: "Reinos" },
  { href: "#teste", label: "Teste" },
] as const;

export function LandingHeader({ onStartQuiz, compact = false }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="cine-glass mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 rounded-sm px-4 sm:h-14 sm:px-5">
        <a
          href="#topo"
          className="cine-display text-sm tracking-[0.28em] text-[color:var(--cine-ink)] sm:text-base"
        >
          ARCANUM <span className="text-[color:var(--cine-amber)]">•</span> XII
        </a>
        {!compact && (
          <nav className="hidden items-center gap-6 md:flex" aria-label="Seções">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-xs tracking-wide text-[color:var(--cine-muted)] transition hover:text-[color:var(--cine-amber-soft)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <button
          type="button"
          onClick={onStartQuiz}
          className="cine-cta rounded-sm px-3 py-1.5 text-[10px] font-semibold sm:px-4 sm:text-xs"
        >
          Começar
        </button>
      </div>
    </header>
  );
}
