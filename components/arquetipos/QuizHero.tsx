"use client";

import {
  BookOpen,
  Compass,
  Crown,
  Flame,
  Heart,
  Scroll,
  Shield,
  Sparkles,
  Sword,
} from "lucide-react";

type Props = {
  onStart: () => void;
};

const PROVATIONS = [
  {
    n: "I",
    title: "Motivação e Propósito",
    body: "O que te realiza, o que te frustra, e como você enfrenta a crise.",
    icon: Flame,
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
    icon: BookOpen,
  },
] as const;

const REALMS = [
  {
    title: "Buscar Liberdade",
    seal: "I",
    body: "Inocente · Explorador · Sábio",
    icon: Compass,
    accent: "#a78bfa",
  },
  {
    title: "Deixar uma Marca",
    seal: "II",
    body: "Herói · Rebelde · Mago",
    icon: Sword,
    accent: "#f0a500",
  },
  {
    title: "Conectar-se",
    seal: "III",
    body: "Pessoa Comum · Amante · Bobo da Corte",
    icon: Heart,
    accent: "#f472b6",
  },
  {
    title: "Prover Estrutura",
    seal: "IV",
    body: "Cuidador · Criador · Governante",
    icon: Crown,
    accent: "#d4af37",
  },
] as const;

export function QuizHero({ onStart }: Props) {
  return (
    <div className="relative">
      {/* Hero */}
      <section
        id="topo"
        className="grim-atmosphere relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-5 pb-20 pt-28"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          aria-hidden
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
            backgroundSize: "200px 200px",
            mixBlendMode: "overlay",
          }}
        />

        <div className="relative mx-auto w-full max-w-3xl text-center sm:text-left">
          <p className="grim-badge grim-display inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-[10px]">
            <Sparkles size={12} aria-hidden />
            Grimório Arquetípico
          </p>

          <h1 className="grim-display grim-title-gold mt-8 text-[clamp(2rem,7vw,3.6rem)] font-semibold leading-[1.08] tracking-[0.02em]">
            Descubra o Seu Arquétipo Dominante
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[color:var(--grim-stone)] sm:mx-0">
            Doze provas em três etapas revelam o brasão que guia sua jornada —
            entre os 12 arquétipos de Carol Pearson. O grimório responde com
            dominante, sub-arquétipo ou perfil híbrido.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="grim-cta inline-flex items-center gap-3 rounded-sm px-8 py-3.5 text-sm font-semibold"
            >
              <Shield size={16} aria-hidden />
              Começar Teste
            </button>
            <p className="text-xs tracking-wide text-[color:var(--grim-stone-dim)]">
              Sem cadastro · resultado imediato
            </p>
          </div>
        </div>
      </section>

      {/* Provations */}
      <section
        id="beneficios"
        className="scroll-mt-20 border-t border-[color:var(--grim-border-soft)] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="grim-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--grim-gold)]">
            As Três Provations
          </p>
          <h2 className="grim-display mt-3 max-w-xl text-3xl tracking-wide text-[color:var(--grim-ink)] sm:text-4xl">
            O caminho pelo grimório
          </h2>
          <ul className="mt-12 grid gap-5 sm:grid-cols-3">
            {PROVATIONS.map((item) => (
              <li key={item.n} className="grim-card rounded-sm p-6">
                <div className="flex items-center justify-between">
                  <item.icon
                    size={20}
                    className="text-[color:var(--grim-gold)]"
                    aria-hidden
                  />
                  <span className="grim-display text-2xl text-[color:var(--grim-gold)]/70">
                    {item.n}
                  </span>
                </div>
                <h3 className="grim-display mt-5 text-lg tracking-wide text-[color:var(--grim-ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--grim-stone)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Realms / brasões */}
      <section
        id="como-funciona"
        className="scroll-mt-20 border-t border-[color:var(--grim-border-soft)] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="grim-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--grim-gold)]">
            Os Quatro Reinos
          </p>
          <h2 className="grim-display mt-3 max-w-xl text-3xl tracking-wide text-[color:var(--grim-ink)] sm:text-4xl">
            Brasões do mapa interior
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[color:var(--grim-stone)]">
            Cada arquétipo pertence a um reino. Seu resultado revela qual selo
            carrega mais peso — e quais o equilibram.
          </p>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {REALMS.map((realm) => (
              <li
                key={realm.title}
                className="grim-brasao flex min-h-[220px] flex-col items-center px-5 pb-10 pt-8 text-center"
              >
                <realm.icon
                  size={22}
                  style={{ color: realm.accent }}
                  aria-hidden
                />
                <p
                  className="grim-display mt-4 text-xs tracking-[0.28em]"
                  style={{ color: realm.accent }}
                >
                  SELO {realm.seal}
                </p>
                <h3 className="grim-display mt-3 text-lg tracking-wide text-[color:var(--grim-gold-bright)]">
                  {realm.title}
                </h3>
                <p className="mt-3 text-xs leading-relaxed text-[color:var(--grim-stone)]">
                  {realm.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section
        id="teste"
        className="scroll-mt-20 border-t border-[color:var(--grim-border-soft)] px-5 py-20"
      >
        <div className="grim-card mx-auto max-w-xl rounded-sm px-6 py-12 text-center">
          <p className="grim-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--grim-gold)]">
            Abrir o grimório
          </p>
          <h2 className="grim-display grim-title-gold mt-4 text-3xl tracking-wide">
            Pronto para a revelação?
          </h2>
          <p className="mt-4 text-sm text-[color:var(--grim-stone)]">
            Doze perguntas. Três etapas. Um brasão dominante.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="grim-cta mt-8 inline-flex items-center gap-3 rounded-sm px-8 py-3.5 text-sm font-semibold"
          >
            <Shield size={16} aria-hidden />
            Começar Teste
          </button>
        </div>
      </section>
    </div>
  );
}
