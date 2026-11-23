"use client";

import { motion, useReducedMotion } from "framer-motion";

export function QuizProcessing() {
  const reduce = useReducedMotion();

  return (
    <section className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.18),transparent_55%)]" />
      <motion.div
        className="relative h-16 w-16 rounded-full border border-[#C9A227]/30"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute inset-1 rounded-full border border-transparent border-t-[#C9A227] border-r-[#4F46E5]/80" />
      </motion.div>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative mt-8 font-[family-name:var(--font-arq-display)] text-xl text-[#F3EDE0]"
      >
        Analisando seu perfil psicológico...
      </motion.p>
      <p className="relative mt-3 max-w-xs text-sm text-white/45">
        Cruzando padrões de decisão, motivação e sombra arquetípica.
      </p>
    </section>
  );
}
