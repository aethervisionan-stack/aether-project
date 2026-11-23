"use client";

import { motion, useReducedMotion } from "framer-motion";

export function QuizProcessing() {
  const reduce = useReducedMotion();

  return (
    <section className="cart-atmosphere relative flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <motion.div
        className="relative h-14 w-14 rounded-full border border-[color:var(--cine-border)]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute inset-1 rounded-full border border-transparent border-t-[color:var(--cine-amber)] border-r-[color:var(--cine-carmine-bright)]" />
      </motion.div>
      <p className="cart-display mt-8 text-xl tracking-wide text-[color:var(--cine-amber-soft)]">
        Consultando o grimório...
      </p>
      <p className="mt-3 max-w-xs text-sm text-[color:var(--cine-muted)]">
        Cruzando motivações, sombras e o brasão que emerge das suas respostas.
      </p>
    </section>
  );
}
