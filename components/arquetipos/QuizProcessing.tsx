"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";

export function QuizProcessing() {
  const reduce = useReducedMotion();

  return (
    <section className="cart-atmosphere cart-topo relative flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center">
      <motion.div
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        className="text-[color:var(--cart-copper)]"
      >
        <Compass size={40} aria-hidden />
      </motion.div>
      <p className="cart-display mt-8 text-xl tracking-wide text-[color:var(--cart-copper-bright)]">
        Traçando o mapa...
      </p>
      <p className="mt-3 max-w-xs text-sm text-[color:var(--cart-muted)]">
        Cruzando marcos, territórios e o pergaminho que emerge das suas
        respostas.
      </p>
    </section>
  );
}
