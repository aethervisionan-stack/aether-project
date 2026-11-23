"use client";

import { ArrowRight } from "lucide-react";

type Props = {
  onStart: () => void;
};

export function QuizHero({ onStart }: Props) {
  return (
    <section
      id="topo"
      className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden px-5 pb-16 pt-28 sm:justify-center sm:pb-24 sm:pt-28"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[#07070b]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_70%_-10%,rgba(79,70,229,0.28),transparent_55%),radial-gradient(ellipse_90%_70%_at_10%_100%,rgba(201,162,39,0.16),transparent_50%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl">
        <p className="font-[family-name:var(--font-arq-display)] text-[clamp(2.75rem,12vw,5.5rem)] leading-[0.9] tracking-[-0.03em] text-[#F3EDE0]">
          Arquétipo
        </p>
        <h1 className="mt-6 max-w-2xl font-[family-name:var(--font-arq-display)] text-[clamp(1.55rem,4.5vw,2.35rem)] font-medium leading-[1.15] tracking-[-0.02em] text-[#F3EDE0]/95">
          Descubra o Seu Arquétipo Dominante
        </h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-[#F3EDE0]/55">
          Doze perguntas em três etapas — Motivação, Comportamento e Legado.
          Baseado nos 12 arquétipos de Carol Pearson / Jung. Resultado com
          dominante, sub-arquétipo ou perfil híbrido.
        </p>
        <div className="mt-10">
          <button
            type="button"
            onClick={onStart}
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-[#C9A227] via-[#E0B84A] to-[#C9A227] bg-[length:200%_100%] px-7 py-3.5 text-sm font-semibold tracking-wide text-[#0a0a0c] transition-[background-position] duration-500 hover:bg-[position:100%_0]"
          >
            Começar Teste
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </button>
        </div>
      </div>
    </section>
  );
}
