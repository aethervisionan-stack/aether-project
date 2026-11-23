"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { QUESTIONS, TOTAL_QUESTIONS, type Question } from "@/src/data/archetypes";
import { OrnateCorners, SanctuaryBackdrop } from "./CinematicChrome";

type Props = {
  index: number;
  answers: Record<string, string>;
  onSelect: (questionId: string, optionId: string) => void;
  onBack: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function QuizFlow({ index, answers, onSelect, onBack }: Props) {
  const reduce = useReducedMotion();
  const question: Question = QUESTIONS[index];
  const progress = ((index + 1) / TOTAL_QUESTIONS) * 100;
  const selected = answers[question.id];

  return (
    <section className="cine-sanctuary-band relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-8 pt-6">
      <SanctuaryBackdrop opacity={0.25} />
      <div className="relative z-10 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center border border-[color:var(--cart-border-soft)] text-[color:var(--cart-muted)] transition hover:border-[color:var(--cart-copper)] hover:text-[color:var(--cart-copper-bright)]"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="cart-display text-[11px] uppercase tracking-[0.22em] text-[color:var(--cart-copper)]">
              Trilha de Exploração · Etapa {question.stage}/3
            </p>
            <span className="tabular text-xs text-[color:var(--cart-dim)]">
              Marco {index + 1} de {TOTAL_QUESTIONS}
            </span>
          </div>
          <p className="mb-2 text-xs text-[color:var(--cart-muted)]">
            {question.stageTitle}
          </p>
          <div className="cart-trail">
            <motion.div
              className="cart-trail-fill origin-left"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.45, ease: EASE }}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={reduce ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -20 }}
            transition={{ duration: 0.38, ease: EASE }}
          >
            <OrnateCorners className="cart-card flex flex-col rounded-sm p-5 sm:p-6">
              <h2 className="cart-display text-[1.35rem] leading-snug tracking-wide text-[color:var(--cart-ink)] sm:text-[1.55rem]">
                {question.text}
              </h2>

              <ul className="mt-8 flex flex-col gap-3">
                {question.options.map((option, i) => {
                  const isSelected = selected === option.id;
                  return (
                    <li key={option.id}>
                      <motion.button
                        type="button"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.35,
                          ease: EASE,
                          delay: reduce ? 0 : 0.05 + i * 0.04,
                        }}
                        onClick={() => onSelect(question.id, option.id)}
                        className={`cart-option w-full rounded-sm px-4 py-4 text-left text-[0.95rem] leading-snug ${
                          isSelected ? "cart-option-active" : ""
                        }`}
                      >
                        <span className="cart-display mr-3 inline-block text-sm text-[color:var(--cart-copper)]">
                          {option.letter}
                        </span>
                        {option.text}
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            </OrnateCorners>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
