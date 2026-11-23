"use client";

type Props = {
  onStartQuiz: () => void;
  compact?: boolean;
};

const NAV = [
  { href: "#beneficios", label: "Benefícios" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#prova", label: "Resultados" },
  { href: "#teste", label: "Teste" },
] as const;

export function LandingHeader({ onStartQuiz, compact = false }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-[#07070b]/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:h-16">
        <a
          href="#topo"
          className="font-[family-name:var(--font-arq-display)] text-xl tracking-tight text-[#F3EDE0] sm:text-2xl"
        >
          Arquétipo
        </a>
        {!compact && (
          <nav className="hidden items-center gap-6 md:flex" aria-label="Seções">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-[#F3EDE0]/55 transition hover:text-[#E8C547]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <button
          type="button"
          onClick={onStartQuiz}
          className="bg-gradient-to-r from-[#C9A227] to-[#E8C547] px-3.5 py-2 text-xs font-semibold tracking-wide text-[#0a0a0c] transition hover:brightness-110 sm:px-4 sm:text-sm"
        >
          Iniciar Teste
        </button>
      </div>
    </header>
  );
}
