"use client";

type Props = {
  onStartQuiz: () => void;
  compact?: boolean;
};

const NAV = [
  { href: "#beneficios", label: "Marcos" },
  { href: "#como-funciona", label: "Territórios" },
  { href: "#teste", label: "Expedição" },
] as const;

export function LandingHeader({ onStartQuiz, compact = false }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--cart-border-soft)] bg-[color:var(--cart-breu)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:h-16">
        <a
          href="#topo"
          className="cart-display text-xl tracking-[0.12em] text-[color:var(--cart-copper-bright)] sm:text-2xl"
        >
          Arquétipo
        </a>
        {!compact && (
          <nav className="hidden items-center gap-6 md:flex" aria-label="Seções">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-[color:var(--cart-muted)] transition hover:text-[color:var(--cart-copper)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <button
          type="button"
          onClick={onStartQuiz}
          className="cart-cta rounded-sm px-3.5 py-2 text-xs font-semibold sm:px-4 sm:text-sm"
        >
          Iniciar Expedição
        </button>
      </div>
    </header>
  );
}
