"use client";

import {
  Compass,
  Crown,
  Flag,
  Heart,
  Map,
  Mountain,
  Scroll,
  Sword,
} from "lucide-react";

type Props = {
  onStart: () => void;
};

const MARCOS = [
  {
    n: "I",
    title: "Motivação e Propósito",
    body: "O que te realiza, o que te frustra, e como você enfrenta a crise.",
    icon: Flag,
  },
  {
    n: "II",
    title: "Comportamento e Decisões",
    body: "Seu papel no grupo, seu lema, vínculos e o chamado da liberdade.",
    icon: Scroll,
  },
  {
    n: "III",
    title: "Medos e Legado",
    body: "O medo interno, o orgulho do trabalho e a marca que deseja deixar.",
    icon: Mountain,
  },
] as const;

const TERRITORIES = [
  {
    title: "Buscar Liberdade",
    seal: "I",
    body: "Inocente · Explorador · Sábio",
    icon: Compass,
    accent: "#8a9bb0",
  },
  {
    title: "Deixar uma Marca",
    seal: "II",
    body: "Herói · Rebelde · Mago",
    icon: Sword,
    accent: "#c4783a",
  },
  {
    title: "Conectar-se",
    seal: "III",
    body: "Pessoa Comum · Amante · Bobo da Corte",
    icon: Heart,
    accent: "#b87333",
  },
  {
    title: "Prover Estrutura",
    seal: "IV",
    body: "Cuidador · Criador · Governante",
    icon: Crown,
    accent: "#a65d2e",
  },
] as const;

export function QuizHero({ onStart }: Props) {
  return (
    <div className="relative">
      <section
        id="topo"
        className="cart-atmosphere cart-topo relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 pb-20 pt-28"
      >
        <div className="relative mx-auto w-full max-w-3xl text-center sm:text-left">
          <p className="cart-badge cart-display inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-[10px]">
            <Compass size={12} aria-hidden />
            Carta de Expedição
          </p>

          <h1 className="cart-display cart-title-torch mt-8 text-[clamp(2rem,7vw,3.5rem)] font-semibold leading-[1.08] tracking-[0.02em]">
            Descubra o Seu Arquétipo Dominante
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[color:var(--cart-muted)] sm:mx-0">
            Doze marcos em três etapas traçam o mapa da sua jornada — entre os
            12 arquétipos de Carol Pearson. A expedição revela dominante,
            sub-arquétipo ou perfil híbrido.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="cart-cta inline-flex items-center gap-3 rounded-sm px-8 py-3.5 text-sm font-semibold"
            >
              <Map size={16} aria-hidden />
              Iniciar Expedição
            </button>
            <p className="text-xs tracking-wide text-[color:var(--cart-dim)]">
              Sem cadastro · relatório imediato
            </p>
          </div>
        </div>
      </section>

      <section
        id="beneficios"
        className="scroll-mt-20 border-t border-[color:var(--cart-border-soft)] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="cart-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]">
            Os Três Marcos
          </p>
          <h2 className="cart-display mt-3 max-w-xl text-3xl tracking-wide text-[color:var(--cart-ink)] sm:text-4xl">
            Etapas no mapa
          </h2>
          <ul className="mt-12 grid gap-5 sm:grid-cols-3">
            {MARCOS.map((item) => (
              <li key={item.n} className="cart-card rounded-sm p-6">
                <div className="flex items-center justify-between">
                  <item.icon
                    size={20}
                    className="text-[color:var(--cart-copper)]"
                    aria-hidden
                  />
                  <span className="cart-display text-2xl text-[color:var(--cart-copper)]/70">
                    {item.n}
                  </span>
                </div>
                <h3 className="cart-display mt-5 text-lg tracking-wide text-[color:var(--cart-ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--cart-muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="como-funciona"
        className="scroll-mt-20 border-t border-[color:var(--cart-border-soft)] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="cart-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]">
            Os Quatro Territórios
          </p>
          <h2 className="cart-display mt-3 max-w-xl text-3xl tracking-wide text-[color:var(--cart-ink)] sm:text-4xl">
            Regiões do mapa interior
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[color:var(--cart-muted)]">
            Cada arquétipo habita um território. Seu relatório mostra qual
            região carrega mais peso — e quais a equilibram.
          </p>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TERRITORIES.map((t) => (
              <li
                key={t.title}
                className="cart-card flex min-h-[200px] flex-col items-center rounded-sm px-5 py-8 text-center"
              >
                <t.icon size={22} style={{ color: t.accent }} aria-hidden />
                <p
                  className="cart-display mt-4 text-xs tracking-[0.28em]"
                  style={{ color: t.accent }}
                >
                  REGIÃO {t.seal}
                </p>
                <h3 className="cart-display mt-3 text-lg tracking-wide text-[color:var(--cart-copper-bright)]">
                  {t.title}
                </h3>
                <p className="mt-3 text-xs leading-relaxed text-[color:var(--cart-muted)]">
                  {t.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="teste"
        className="scroll-mt-20 border-t border-[color:var(--cart-border-soft)] px-5 py-20"
      >
        <div className="cart-card mx-auto max-w-xl rounded-sm px-6 py-12 text-center">
          <p className="cart-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cart-copper)]">
            Abrir o mapa
          </p>
          <h2 className="cart-display cart-title-torch mt-4 text-3xl tracking-wide">
            Pronto para a expedição?
          </h2>
          <p className="mt-4 text-sm text-[color:var(--cart-muted)]">
            Doze marcos. Três etapas. Um território dominante.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="cart-cta mt-8 inline-flex items-center gap-3 rounded-sm px-8 py-3.5 text-sm font-semibold"
          >
            <Map size={16} aria-hidden />
            Iniciar Expedição
          </button>
        </div>
      </section>
    </div>
  );
}
