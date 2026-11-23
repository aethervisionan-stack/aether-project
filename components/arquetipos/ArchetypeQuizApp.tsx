"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  QUESTIONS,
  calculateResult,
  scoreAnswers,
} from "@/src/data/archetypes";
import {
  readIsUnlocked,
  writeIsUnlocked,
} from "@/src/utils/archetypeUnlock";
import { playRevealChord, playStageChime } from "@/src/utils/soundEffects";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { MedievalAudioPlayer } from "./MedievalAudioPlayer";
import { PaywallScreen } from "./PaywallScreen";
import { QuizFlow } from "./QuizFlow";
import { QuizHero } from "./QuizHero";
import { QuizProcessing } from "./QuizProcessing";
import { QuizResult } from "./QuizResult";
import "./cartographic.css";

/** welcome | quiz | paywall | result (+ brief processing after quiz) */
type Stage = "welcome" | "quiz" | "processing" | "paywall" | "result";

const PROCESSING_MS = 1200;
const ADVANCE_MS = 300;

export function ArchetypeQuizApp() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [stage, setStage] = useState<Stage>("welcome");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    setUnlocked(readIsUnlocked());
  }, []);

  const result = useMemo(
    () => calculateResult(scoreAnswers(answers)),
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
      if (unlocked) {
        playRevealChord();
        setStage("result");
      } else {
        setStage("paywall");
      }
    }, PROCESSING_MS);
    return () => window.clearTimeout(t);
  }, [stage, unlocked]);

  function handleSelect(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    window.setTimeout(() => {
      if (index >= QUESTIONS.length - 1) {
        finishQuiz();
      } else {
        const next = index + 1;
        if (next === 4 || next === 8) {
          playStageChime();
        }
        setIndex(next);
      }
    }, ADVANCE_MS);
  }

  function handleBack() {
    if (stage === "quiz" && index > 0) {
      setIndex((i) => i - 1);
      return;
    }
    if (stage === "quiz" && index === 0) {
      setStage("welcome");
    }
  }

  function handleRestart() {
    setAnswers({});
    setIndex(0);
    setStage("welcome");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleUnlocked() {
    writeIsUnlocked(true);
    setUnlocked(true);
    setStage("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fade = !mounted || reduce;
  const inFlow =
    stage === "quiz" ||
    stage === "processing" ||
    stage === "paywall" ||
    stage === "result";

  return (
    <div className="arquetipo-root min-h-[100dvh]">
      <LandingHeader onStartQuiz={startQuiz} compact={inFlow} />
      <MedievalAudioPlayer />

      <AnimatePresence mode="wait">
        {stage === "welcome" && (
          <motion.div
            key="welcome"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <QuizHero onStart={startQuiz} />
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

        {stage === "paywall" && (
          <motion.div
            key="paywall"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pt-14 sm:pt-16"
          >
            <PaywallScreen onUnlocked={handleUnlocked} />
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
            <QuizResult result={result} onRestart={handleRestart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
