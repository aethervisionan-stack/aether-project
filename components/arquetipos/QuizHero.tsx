"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  onStart: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function QuizHero({ onStart }: Props) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const animateIn = ready && !reduce;

  return (
    <section
      id="topo"
      className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden px-5 pb-16 pt-28 sm:justify-center sm:pb-24 sm:pt-28"
    >
      {/* Atmosphere — full-bleed gradient plane */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[#07070b]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_70%_-10%,rgba(79,70,229,0.28),transparent_55%),radial-gradient(ellipse_90%_70%_at_10%_100%,rgba(201,162,39,0.16),transparent_50%),radial-gradient(ellipse_60%_40%_at_90%_80%,rgba(99,102,241,0.12),transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
            backgroundSize: "180px 180px",
            mixBlendMode: "overlay",
          }}
        />
        <motion.div
          className="absolute -left-1/4 top-1/4 h-[55vmin] w-[55vmin] rounded-full bg-[#4F46E5]/20 blur-[100px]"
          animate={
            reduce
              ? undefined
              : { x: [0, 40, 0], y: [0, -30, 0], opacity: [0.35, 0.55, 0.35] }
          }
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-1/5 bottom-0 h-[50vmin] w-[50vmin] rounded-full bg-[#C9A227]/15 blur-[90px]"
          animate={
            reduce
              ? undefined
              : { x: [0, -35, 0], y: [0, 25, 0], opacity: [0.25, 0.45, 0.25] }
          }
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-3xl">
        <motion.p
          initial={animateIn ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="font-[family-name:var(--font-arq-display)] text-[clamp(2.75rem,12vw,5.5rem)] leading-[0.9] tracking-[-0.03em] text-[#F3EDE0]"
        >
          Arquétipo
        </motion.p>

        <motion.h1
          initial={animateIn ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE, delay: 0.08 }}
          className="mt-6 max-w-2xl font-[family-name:var(--font-arq-display)] text-[clamp(1.45rem,4.2vw,2.15rem)] font-medium leading-[1.2] tracking-[-0.02em] text-[#F3EDE0]/92"
        >
          Descubra o arquétipo que guia suas decisões e sua essência
        </motion.h1>

        <motion.p
          initial={animateIn ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
          className="mt-5 max-w-md text-base leading-relaxed text-[#F3EDE0]/55"
        >
          Doze perguntas situacionais. Menos de 2 minutos. Um mapa claro do que
          move a sua identidade — e como posicioná-la.
        </motion.p>

        <motion.div
          initial={animateIn ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.24 }}
          className="mt-10"
        >
          <button
            type="button"
            onClick={onStart}
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-[#C9A227] via-[#E0B84A] to-[#C9A227] bg-[length:200%_100%] px-7 py-3.5 text-sm font-semibold tracking-wide text-[#0a0a0c] transition-[background-position] duration-500 hover:bg-[position:100%_0]"
          >
            Iniciar Teste Gratuito
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
