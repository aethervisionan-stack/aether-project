"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LEAD_CAPTURE_ENABLED,
  QUESTIONS,
  rankArchetypes,
  scoreAnswers,
} from "@/src/data/archetypes";
import { LeadCaptureModal } from "./LeadCaptureModal";
import { QuizFlow } from "./QuizFlow";
import { QuizHero } from "./QuizHero";
import { QuizProcessing } from "./QuizProcessing";
import { QuizResult } from "./QuizResult";

type Stage = "hero" | "quiz" | "processing" | "result";

const PROCESSING_MS = 1500;

export function ArchetypeQuizApp() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("hero");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadDone, setLeadDone] = useState(!LEAD_CAPTURE_ENABLED);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ranked = useMemo(() => rankArchetypes(scoreAnswers(answers)), [answers]);

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
      setStage("hero");
    }
  }

  function handleRestart() {
    setAnswers({});
    setIndex(0);
    setLeadOpen(false);
    setLeadDone(!LEAD_CAPTURE_ENABLED);
    setStage("hero");
  }

  function closeLead() {
    setLeadOpen(false);
    setLeadDone(true);
    setStage("result");
  }

  const fade = !mounted || reduce;

  return (
    <div className="arquetipo-root min-h-[100dvh] bg-[#07070b] text-[#F3EDE0]">
      <AnimatePresence mode="wait">
        {stage === "hero" && (
          <motion.div
            key="hero"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <QuizHero
              onStart={() => {
                setIndex(0);
                setStage("quiz");
              }}
            />
          </motion.div>
        )}
        {stage === "quiz" && (
          <motion.div
            key="quiz"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
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
          >
            <QuizResult ranked={ranked} onRestart={handleRestart} />
          </motion.div>
        )}
      </AnimatePresence>

      <LeadCaptureModal
        open={leadOpen}
        onSkip={closeLead}
        onSubmit={() => {
          // Hook CRM / webhook here when LEAD_CAPTURE_ENABLED is true.
          closeLead();
        }}
      />
    </div>
  );
}
