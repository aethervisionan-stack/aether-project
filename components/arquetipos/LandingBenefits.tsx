"use client";

import { Compass, Eye, Sparkles } from "lucide-react";

const BENEFITS = [
  {
    icon: Eye,
    title: "Arquétipo Dominante",
    body: "Um líder claro entre os 12 arquétipos de Jung — com desejo central, forças, medo e sombra.",
  },
  {
    icon: Compass,
    title: "Sub-arquétipo ou Híbrido",
    body: "Segundo lugar combina descrições; empate no topo vira Perfil Híbrido com os dois.",
  },
  {
    icon: Sparkles,
    title: "Mapa de pontuação",
    body: "Gráfico simples 0–12 por arquétipo pontuado — fácil de copiar e compartilhar.",
  },
] as const;

export function LandingBenefits() {
  return (
    <section
      id="beneficios"
      className="scroll-mt-20 border-t border-white/8 px-5 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#C9A227]">
          Por que fazer
        </p>
        <h2 className="mt-3 max-w-xl font-[family-name:var(--font-arq-display)] text-3xl tracking-tight text-[#F3EDE0] sm:text-4xl">
          Clareza arquetípica em menos de dois minutos
        </h2>
        <p className="mt-4 max-w-lg text-base text-[#F3EDE0]/55">
          Os 12 arquétipos de Jung organizam motivação, medo e legado — para
          você se ver com mais precisão.
        </p>
        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {BENEFITS.map((item) => (
            <li
              key={item.title}
              className="border border-white/10 bg-white/[0.02] p-6"
            >
              <item.icon size={22} className="text-[#C9A227]" aria-hidden />
              <h3 className="mt-4 text-lg text-[#F3EDE0]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#F3EDE0]/55">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
