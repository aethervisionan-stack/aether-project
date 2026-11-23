"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Compass,
  Crown,
  Flame,
  Heart,
  Scroll,
  Shield,
  Sword,
  BookOpen,
} from "lucide-react";
import Image from "next/image";

type Props = {
  onStart: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const PROVACOES = [
  {
    n: "I",
    title: "Motivação e Propósito",
    body: "O que te realiza, o que te frustra, e como você enfrenta a crise.",
    icon: Flame,
    span: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
  },
  {
    n: "II",
    title: "Comportamento e Decisões",
    body: "Seu papel no grupo, seu lema, vínculos e o chamado da liberdade.",
    icon: Scroll,
    span: "sm:col-span-2 lg:col-span-2",
  },
  {
    n: "III",
    title: "Medos e Legado",
    body: "O medo interno, o orgulho do trabalho e a marca que deseja deixar.",
    icon: BookOpen,
    span: "sm:col-span-2 lg:col-span-2",
  },
] as const;

const REINOS = [
  {
    title: "Buscar Liberdade",
    seal: "I",
    body: "Inocente · Explorador · Sábio",
    icon: Compass,
    accent: "#a39e94",
  },
  {
    title: "Deixar uma Marca",
    seal: "II",
    body: "Herói · Rebelde · Mago",
    icon: Sword,
    accent: "#c43c3c",
  },
  {
    title: "Conectar-se",
    seal: "III",
    body: "Pessoa Comum · Amante · Bobo da Corte",
    icon: Heart,
    accent: "#c9894a",
  },
  {
    title: "Prover Estrutura",
    seal: "IV",
    body: "Cuidador · Criador · Governante",
    icon: Crown,
    accent: "#e0a66a",
  },
] as const;

export function QuizHero({ onStart }: Props) {
  const reduce = useReducedMotion();
  const fade = (delay: number) =>
    reduce
      ? undefined
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <div className="relative">
      {/* Full-bleed cinematic hero */}
      <section
        id="topo"
        className="relative min-h-screen overflow-hidden"
      >
        <Image
          src="/images/hero-dragon.jpg"
          alt="Cavaleiro diante de um dragão sob o castelo nas névoas"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[62%_center] sm:object-center"
        />

        {/* Cinematic overlays: left readable plane, bottom vignette, top soft fade */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: `
              linear-gradient(90deg, rgba(5,6,8,0.92) 0%, rgba(5,6,8,0.72) 28%, rgba(5,6,8,0.28) 52%, transparent 72%),
              linear-gradient(0deg, rgba(5,6,8,0.88) 0%, rgba(5,6,8,0.35) 22%, transparent 48%),
              linear-gradient(180deg, rgba(5,6,8,0.55) 0%, transparent 28%)
            `,
          }}
        />

        <div className="relative z-10 flex min-h-screen flex-col justify-end px-5 pb-16 pt-28 sm:justify-center sm:pb-24 sm:pt-32">
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-2xl">
              <motion.p
                {...fade(0.05)}
                className="cine-display text-[11px] uppercase tracking-[0.36em] text-[color:var(--cine-amber-soft)]"
              >
                ARCANUM
              </motion.p>

              <motion.h1
                {...fade(0.12)}
                className="cine-display cine-title-amber mt-5 text-[clamp(2.15rem,6.5vw,3.75rem)] font-semibold leading-[1.05] tracking-[0.02em]"
              >
                Descubra o Seu Arquétipo Dominante
              </motion.h1>

              <motion.p
                {...fade(0.2)}
                className="mt-5 max-w-lg text-base leading-relaxed text-[color:var(--cine-muted)] sm:text-lg"
              >
                Doze provas revelam o brasão que guia sua jornada — entre os 12
                arquétipos de Carol Pearson.
              </motion.p>

              <motion.div {...fade(0.28)} className="mt-9">
                <button
                  type="button"
                  onClick={onStart}
                  className="cine-cta inline-flex items-center gap-3 rounded-sm px-8 py-3.5 text-sm font-semibold"
                >
                  <Shield size={16} aria-hidden />
                  Começar Teste
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Provações — bento */}
      <section
        id="provacoes"
        className="cine-atmosphere scroll-mt-24 border-t border-[color:var(--cine-border-soft)] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="cine-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cine-amber)]">
            As Três Provações
          </p>
          <h2 className="cine-display mt-3 max-w-xl text-3xl tracking-wide text-[color:var(--cine-ink)] sm:text-4xl">
            O caminho pelo grimório
          </h2>
          <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            {PROVACOES.map((item, i) => (
              <motion.li
                key={item.n}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, ease: EASE, delay: i * 0.06 }}
                className={`cine-card rounded-sm p-6 ${item.span} ${
                  i === 0 ? "lg:flex lg:flex-col lg:justify-between" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <item.icon
                    size={20}
                    className="text-[color:var(--cine-amber)]"
                    aria-hidden
                  />
                  <span className="cine-display text-2xl text-[color:var(--cine-amber)]/65">
                    {item.n}
                  </span>
                </div>
                <div>
                  <h3
                    className={`cine-display mt-5 tracking-wide text-[color:var(--cine-ink)] ${
                      i === 0 ? "text-2xl lg:text-3xl" : "text-lg"
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={`mt-2 leading-relaxed text-[color:var(--cine-muted)] ${
                      i === 0 ? "text-base" : "text-sm"
                    }`}
                  >
                    {item.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reinos */}
      <section
        id="reinos"
        className="scroll-mt-24 border-t border-[color:var(--cine-border-soft)] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl">
          <p className="cine-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cine-amber)]">
            Os Quatro Reinos
          </p>
          <h2 className="cine-display mt-3 max-w-xl text-3xl tracking-wide text-[color:var(--cine-ink)] sm:text-4xl">
            Brasões do mapa interior
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[color:var(--cine-muted)]">
            Cada arquétipo pertence a um reino. Seu resultado revela qual selo
            carrega mais peso — e quais o equilibram.
          </p>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REINOS.map((realm, i) => (
              <motion.li
                key={realm.title}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, ease: EASE, delay: i * 0.05 }}
                className="cine-card flex min-h-[200px] flex-col items-center rounded-sm px-5 py-8 text-center"
              >
                <realm.icon
                  size={22}
                  style={{ color: realm.accent }}
                  aria-hidden
                />
                <p
                  className="cine-display mt-4 text-xs tracking-[0.28em]"
                  style={{ color: realm.accent }}
                >
                  REINO {realm.seal}
                </p>
                <h3 className="cine-display mt-3 text-lg tracking-wide text-[color:var(--cine-amber-soft)]">
                  {realm.title}
                </h3>
                <p className="mt-3 text-xs leading-relaxed text-[color:var(--cine-muted)]">
                  {realm.body}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Glass final CTA */}
      <section
        id="teste"
        className="scroll-mt-24 border-t border-[color:var(--cine-border-soft)] px-5 py-20"
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="cine-glass-strong mx-auto max-w-xl rounded-sm px-6 py-12 text-center"
        >
          <p className="cine-display text-[11px] uppercase tracking-[0.32em] text-[color:var(--cine-amber)]">
            Abrir o grimório
          </p>
          <h2 className="cine-display cine-title-amber mt-4 text-3xl tracking-wide">
            Pronto para a revelação?
          </h2>
          <p className="mt-4 text-sm text-[color:var(--cine-muted)]">
            Doze perguntas. Três provações. Um brasão dominante.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="cine-cta mt-8 inline-flex items-center gap-3 rounded-sm px-8 py-3.5 text-sm font-semibold"
          >
            <Shield size={16} aria-hidden />
            Começar Teste
          </button>
        </motion.div>
      </section>
    </div>
  );
}
