"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { QUESTIONS, type Question } from "@/src/data/archetypes";

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
  const total = QUESTIONS.length;
  const progress = ((index + 1) / total) * 100;
  const selected = answers[question.id];

  return (
    <section className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-8 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={index === 0}
          className="flex h-10 w-10 items-center justify-center border border-white/10 text-[#F3EDE0]/70 transition enabled:hover:border-[#C9A227]/40 enabled:hover:text-[#E8C547] disabled:opacity-30"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#C9A227]/90">
              Pergunta {index + 1} de {total}
            </p>
            <span className="tabular text-xs text-white/35">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-[3px] overflow-hidden bg-white/8">
            <motion.div
              className="h-full origin-left bg-gradient-to-r from-[#4F46E5] to-[#C9A227]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.45, ease: EASE }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={reduce ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -20 }}
            transition={{ duration: 0.38, ease: EASE }}
            className="flex flex-col"
          >
            <h2 className="font-[family-name:var(--font-arq-display)] text-[1.45rem] leading-snug tracking-[-0.02em] text-[#F3EDE0] sm:text-[1.65rem]">
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
                      className={`w-full border px-4 py-4 text-left text-[0.95rem] leading-snug transition ${
                        isSelected
                          ? "border-[#C9A227]/55 bg-[#C9A227]/12 text-[#F3EDE0]"
                          : "border-white/10 bg-white/[0.02] text-[#F3EDE0]/82 hover:border-white/25 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="mr-3 inline-block font-[family-name:var(--font-arq-display)] text-sm text-[#C9A227]/80">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {option.text}
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
