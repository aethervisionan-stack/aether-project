"use client";

type Props = {
  onStartQuiz: () => void;
  compact?: boolean;
};

const NAV = [
  { href: "#beneficios", label: "Provations" },
  { href: "#como-funciona", label: "Reinos" },
  { href: "#teste", label: "Grimório" },
] as const;

export function LandingHeader({ onStartQuiz, compact = false }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--grim-border-soft)] bg-[color:var(--grim-obsidian)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:h-16">
        <a
          href="#topo"
          className="grim-display text-xl tracking-[0.12em] text-[color:var(--grim-gold-bright)] sm:text-2xl"
        >
          Arquétipo
        </a>
        {!compact && (
          <nav className="hidden items-center gap-6 md:flex" aria-label="Seções">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-[color:var(--grim-stone)] transition hover:text-[color:var(--grim-gold)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <button
          type="button"
          onClick={onStartQuiz}
          className="grim-cta rounded-sm px-3.5 py-2 text-xs font-semibold sm:px-4 sm:text-sm"
        >
          Começar Teste
        </button>
      </div>
    </header>
  );
}
