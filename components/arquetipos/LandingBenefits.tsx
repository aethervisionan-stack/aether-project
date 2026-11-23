"use client";

import { Compass, Eye, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const BENEFITS = [
  {
    icon: Eye,
    title: "Clareza de identidade",
    body: "Entenda o padrão que guia suas decisões — e o que você evita sem perceber.",
  },
  {
    icon: Compass,
    title: "Posicionamento prático",
    body: "Traduza o arquétipo dominante em linguagem de marca, carreira e relacionamento.",
  },
  {
    icon: Sparkles,
    title: "Green e red flags",
    body: "Veja onde a força vira excesso: burnout, fuga, controle ou se apagar pra caber no algoritmo.",
  },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export function LandingBenefits() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

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
          Um espelho psicológico em linguagem de decisão
        </h2>
        <p className="mt-4 max-w-lg text-base text-[#F3EDE0]/55">
          Os 12 arquétipos junguianos organizam motivação, desejo e sombra — para
          você se posicionar com mais precisão.
        </p>

        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {BENEFITS.map((item, i) => (
            <motion.li
              key={item.title}
              initial={ready && !reduce ? { opacity: 0, y: 16 } : false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.06 }}
              className="border border-white/10 bg-white/[0.02] p-6"
            >
              <item.icon className="text-[#C9A227]" size={22} strokeWidth={1.5} />
              <h3 className="mt-4 font-[family-name:var(--font-arq-display)] text-xl text-[#F3EDE0]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#F3EDE0]/55">
                {item.body}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
