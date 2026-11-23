"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LEAD_CAPTURE_ENABLED,
  QUESTIONS,
  rankArchetypes,
  scoreAnswers,
} from "@/src/data/archetypes";
import { LandingBenefits } from "./LandingBenefits";
import { LandingFinalCta } from "./LandingFinalCta";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { LandingHowItWorks } from "./LandingHowItWorks";
import { LandingProof } from "./LandingProof";
import { LeadCaptureModal } from "./LeadCaptureModal";
import { QuizFlow } from "./QuizFlow";
import { QuizHero } from "./QuizHero";
import { QuizProcessing } from "./QuizProcessing";
import { QuizResult } from "./QuizResult";

type Stage = "landing" | "quiz" | "processing" | "result";

const PROCESSING_MS = 1500;

export function ArchetypeQuizApp() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("landing");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadDone, setLeadDone] = useState(!LEAD_CAPTURE_ENABLED);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ranked = useMemo(
    () => rankArchetypes(scoreAnswers(answers)),
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
    const t = window.setTimeout(() => {
      if (LEAD_CAPTURE_ENABLED && !leadDone) {
        setLeadOpen(true);
      } else {
        setStage("result");
      }
    }, PROCESSING_MS);
    return () => window.clearTimeout(t);
  }, [stage, leadDone]);

  function handleSelect(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    window.setTimeout(() => {
      if (index >= QUESTIONS.length - 1) {
        finishQuiz();
      } else {
        setIndex((i) => i + 1);
      }
    }, 280);
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
    setLeadOpen(false);
    setLeadDone(!LEAD_CAPTURE_ENABLED);
    setStage("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeLead() {
    setLeadOpen(false);
    setLeadDone(true);
    setStage("result");
  }

  const fade = !mounted || reduce;
  const inFlow = stage === "quiz" || stage === "processing" || stage === "result";

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
                  Comece agora — 12 perguntas situacionais
                </h2>
                <p className="mt-4 text-base text-[#F3EDE0]/55">
                  Sem cadastro obrigatório. Resultado com arquétipo dominante,
                  secundário e aplicação prática.
                </p>
                <button
                  type="button"
                  onClick={startQuiz}
                  className="mt-8 bg-gradient-to-r from-[#C9A227] to-[#E8C547] px-7 py-3.5 text-sm font-semibold tracking-wide text-[#0a0a0c] transition hover:brightness-110"
                >
                  Iniciar Teste Gratuito
                </button>
              </div>
            </section>
            <LandingFinalCta onStartQuiz={startQuiz} />
            <LandingFooter />
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
            <QuizResult ranked={ranked} onRestart={handleRestart} />
          </motion.div>
        )}
      </AnimatePresence>

      <LeadCaptureModal
        open={leadOpen}
        onSkip={closeLead}
        onSubmit={() => {
          closeLead();
        }}
      />
    </div>
  );
}
