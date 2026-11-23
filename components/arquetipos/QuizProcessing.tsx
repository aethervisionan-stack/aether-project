"use client";

import { motion, useReducedMotion } from "framer-motion";

export function QuizProcessing() {
  const reduce = useReducedMotion();

  return (
    <section className="grim-atmosphere relative flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <motion.div
        className="relative h-16 w-16 rounded-full border border-[color:var(--grim-border)]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute inset-1 rounded-full border border-transparent border-t-[color:var(--grim-gold)] border-r-[color:var(--grim-purple)]" />
      </motion.div>
      <p className="grim-display mt-8 text-xl tracking-wide text-[color:var(--grim-gold-bright)]">
        Consultando o grimório...
      </p>
      <p className="mt-3 max-w-xs text-sm text-[color:var(--grim-stone)]">
        Cruzando motivações, sombras e o brasão que emerge das suas respostas.
      </p>
    </section>
  );
}
