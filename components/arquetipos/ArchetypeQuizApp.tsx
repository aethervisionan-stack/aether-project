"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  QUESTIONS,
  resolveOutcome,
  scoreAnswers,
} from "@/src/data/archetypes";
import { LandingBenefits } from "./LandingBenefits";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { LandingHowItWorks } from "./LandingHowItWorks";
import { LandingProof } from "./LandingProof";
import { QuizFlow } from "./QuizFlow";
import { QuizHero } from "./QuizHero";
import { QuizProcessing } from "./QuizProcessing";
import { QuizResult } from "./QuizResult";

type Stage = "landing" | "quiz" | "processing" | "result";

const PROCESSING_MS = 1200;
const ADVANCE_MS = 300;

export function ArchetypeQuizApp() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("landing");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const outcome = useMemo(
    () => resolveOutcome(scoreAnswers(answers)),
    [answers],
  );

  const startQuiz = useCallback(() => {
    setIndex(0);
    setStage("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const finishQuiz = useCallback(() => {
    setStage("processing");
  }, []);

  useEffect(() => {
    if (stage !== "processing") return;
    const t = window.setTimeout(() => setStage("result"), PROCESSING_MS);
    return () => window.clearTimeout(t);
  }, [stage]);

  function handleSelect(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    window.setTimeout(() => {
      if (index >= QUESTIONS.length - 1) {
        finishQuiz();
      } else {
        setIndex((i) => i + 1);
      }
    }, ADVANCE_MS);
  }

  function handleBack() {
    if (stage === "quiz" && index > 0) {
      setIndex((i) => i - 1);
      return;
    }
    if (stage === "quiz" && index === 0) {
      setStage("landing");
    }
  }

  function handleRestart() {
    setAnswers({});
    setIndex(0);
    setStage("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fade = !mounted || reduce;
  const inFlow =
    stage === "quiz" || stage === "processing" || stage === "result";

  return (
    <div className="arquetipo-root min-h-[100dvh] bg-[#07070b] text-[#F3EDE0]">
      <LandingHeader onStartQuiz={startQuiz} compact={inFlow} />

      <AnimatePresence mode="wait">
        {stage === "landing" && (
          <motion.div
            key="landing"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <QuizHero onStart={startQuiz} />
            <LandingBenefits />
            <LandingHowItWorks />
            <LandingProof />
            <section
              id="teste"
              className="scroll-mt-20 border-t border-white/8 px-5 py-20 sm:py-24"
            >
              <div className="mx-auto max-w-xl text-center">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#C9A227]">
                  O teste
                </p>
                <h2 className="mt-3 font-[family-name:var(--font-arq-display)] text-3xl tracking-tight text-[#F3EDE0] sm:text-4xl">
                  Descubra o Seu Arquétipo Dominante
                </h2>
                <p className="mt-4 text-base text-[#F3EDE0]/55">
                  12 perguntas em 3 etapas. Sem cadastro. Resultado com
                  dominante + sub-arquétipo ou perfil híbrido.
                </p>
                <button
                  type="button"
                  onClick={startQuiz}
                  className="mt-8 bg-gradient-to-r from-[#C9A227] to-[#E8C547] px-7 py-3.5 text-sm font-semibold tracking-wide text-[#0a0a0c] transition hover:brightness-110"
                >
                  Começar Teste
                </button>
              </div>
            </section>
            <LandingFooter onStartQuiz={startQuiz} />
          </motion.div>
        )}

        {stage === "quiz" && (
          <motion.div
            key="quiz"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pt-14 sm:pt-16"
          >
            <QuizFlow
              index={index}
              answers={answers}
              onSelect={handleSelect}
              onBack={handleBack}
            />
          </motion.div>
        )}

        {stage === "processing" && (
          <motion.div
            key="processing"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pt-14 sm:pt-16"
          >
            <QuizProcessing />
          </motion.div>
        )}

        {stage === "result" && (
          <motion.div
            key="result"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pt-14 sm:pt-16"
          >
            <QuizResult outcome={outcome} onRestart={handleRestart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
