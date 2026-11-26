"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOM_OPTION_ID } from "@/lib/custom-answer-analyzer";
import { buildNarrativeResult, QUESTIONS } from "@/src/data/scoring";
import {
  readIsUnlocked,
  writeIsUnlocked,
} from "@/src/utils/archetypeUnlock";
import { buildMentorProfile } from "@/lib/mentor/profile";
import {
  applyMentorRestore,
  clearQuizAnswersKeepMentor,
  isMentorPassActive,
  isResultUnlocked,
  readQuizSession,
  unlockByTier,
  writeQuizSession,
  type InfinitePayTier,
} from "@/src/utils/quizSession";
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

type ReturnParams = {
  order_nsu: string | null;
  transaction_nsu: string | null;
  slug: string | null;
  simulated: boolean;
};

function readReturnParams(): ReturnParams | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const paymentReturn =
      params.get("payment_return") === "1" ||
      params.has("order_nsu") ||
      params.has("transaction_nsu");
    if (!paymentReturn) return null;
    return {
      order_nsu: params.get("order_nsu"),
      transaction_nsu: params.get("transaction_nsu"),
      slug: params.get("slug"),
      simulated:
        params.get("simulated") === "1" ||
        Boolean(params.get("transaction_nsu")?.startsWith("SIM_")),
    };
  } catch {
    return null;
  }
}

function cleanReturnUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    [
      "payment_return",
      "order_nsu",
      "transaction_nsu",
      "slug",
      "capture_method",
      "receipt_url",
      "simulated",
    ].forEach((k) => params.delete(k));
    const next = params.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", url);
  } catch {
    // ignore
  }
}

export function ArchetypeQuizApp() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [stage, setStage] = useState<Stage>("welcome");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
    {},
  );
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const returnParamsRef = useRef<ReturnParams | null>(null);
  const verifyStartedRef = useRef(false);

  const result = useMemo(
    () => buildNarrativeResult(answers, customAnswers),
    [answers, customAnswers],
  );

  const persistAnswers = useCallback(
    (
      nextAnswers: Record<string, string>,
      nextCustom: Record<string, string>,
      completed: boolean,
    ) => {
      const prev = readQuizSession();
      writeQuizSession({
        answers: nextAnswers,
        customAnswers: nextCustom,
        completed,
        updatedAt: Date.now(),
        resultUnlocked: prev?.resultUnlocked,
        mentorUnlocked: prev?.mentorUnlocked,
        paidPlan: prev?.paidPlan ?? null,
        mentorUnlockedAt: prev?.mentorUnlockedAt ?? null,
        mentorExpiresAt: prev?.mentorExpiresAt ?? null,
        mentorProfile: prev?.mentorProfile ?? null,
        mentorFreeUsed: prev?.mentorFreeUsed,
        mentorHistory: prev?.mentorHistory ?? [],
        restoreCode: prev?.restoreCode ?? null,
        orderNsu: prev?.orderNsu ?? null,
      });
    },
    [],
  );

  const applyUnlock = useCallback(
    (tier: InfinitePayTier | string, orderNsu?: string | null) => {
      persistAnswers(answers, customAnswers, true);
      unlockByTier(tier, buildMentorProfile(result), orderNsu ?? null);
      writeIsUnlocked(true);
      setUnlocked(true);
      setVerifying(false);
      setVerifyError(null);
      setStage("result");
      cleanReturnUrl();
      playRevealChord();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [answers, customAnswers, persistAnswers, result],
  );

  const runVerify = useCallback(
    async (params: ReturnParams) => {
      setVerifying(true);
      setVerifyError(null);
      setStage("paywall");
      try {
        const res = await fetch("/api/infinitepay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_nsu: params.order_nsu,
            transaction_nsu: params.transaction_nsu,
            slug: params.slug,
            simulated: params.simulated,
          }),
        });
        const data = (await res.json()) as {
          paid?: boolean;
          tier?: string;
          order_nsu?: string;
          error?: string;
        };
        if (!res.ok || !data.paid || !data.tier) {
          throw new Error(
            data.error || "Pagamento ainda não confirmado. Tente de novo.",
          );
        }
        applyUnlock(data.tier, data.order_nsu ?? params.order_nsu);
      } catch (err) {
        setVerifyError(
          err instanceof Error ? err.message : "Falha ao verificar pagamento",
        );
        setVerifying(true);
      }
    },
    [applyUnlock],
  );

  useEffect(() => {
    setMounted(true);

    // ?restore=<token> — reabre Passe do Mentor neste aparelho
    try {
      const params = new URLSearchParams(window.location.search);
      const restoreToken = params.get("restore");
      if (restoreToken) {
        applyMentorRestore(restoreToken);
        params.delete("restore");
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", url);
      }
    } catch {
      // ignore
    }

    // Expire mentor pass if mentorExpiresAt elapsed
    try {
      const sessionCheck = readQuizSession();
      if (
        sessionCheck?.mentorUnlocked &&
        sessionCheck.mentorExpiresAt &&
        !isMentorPassActive(sessionCheck)
      ) {
        writeQuizSession({
          ...sessionCheck,
          mentorUnlocked: false,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // ignore
    }

    const returnParams = readReturnParams();
    returnParamsRef.current = returnParams;

    const session = readQuizSession();
    const isUnlocked =
      isResultUnlocked(session) || readIsUnlocked();
    if (isUnlocked && !session?.resultUnlocked) {
      writeQuizSession({
        ...(session ?? {
          answers: {},
          customAnswers: {},
          completed: false,
          updatedAt: Date.now(),
        }),
        resultUnlocked: true,
        updatedAt: Date.now(),
      });
    }
    setUnlocked(isUnlocked);
    if (isUnlocked) writeIsUnlocked(true);

    if (session?.answers && Object.keys(session.answers).length > 0) {
      setAnswers(session.answers);
      setCustomAnswers(session.customAnswers ?? {});
      if (session.completed) {
        setStage(isUnlocked && !returnParams ? "result" : "paywall");
      }
    }

    if (returnParams && !verifyStartedRef.current) {
      verifyStartedRef.current = true;
      setStage("paywall");
      void runVerify(returnParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      persistAnswers(answers, customAnswers, true);
      if (unlocked) {
        playRevealChord();
        setStage("result");
      } else {
        setStage("paywall");
      }
    }, PROCESSING_MS);
    return () => window.clearTimeout(t);
  }, [stage, unlocked, answers, customAnswers, persistAnswers]);

  function advanceAfterAnswer() {
    window.setTimeout(() => {
      if (index >= QUESTIONS.length - 1) {
        finishQuiz();
      } else {
        const next = index + 1;
        if (next === 4 || next === 8 || next === 12) {
          playStageChime();
        }
        setIndex(next);
      }
    }, ADVANCE_MS);
  }

  function handleSelect(questionId: string, optionId: string) {
    const nextAnswers = { ...answers, [questionId]: optionId };
    const nextCustom = { ...customAnswers };
    delete nextCustom[questionId];
    setAnswers(nextAnswers);
    setCustomAnswers(nextCustom);
    persistAnswers(nextAnswers, nextCustom, false);
    advanceAfterAnswer();
  }

  function handleCustomSelect(questionId: string, text: string) {
    const nextAnswers = { ...answers, [questionId]: CUSTOM_OPTION_ID };
    const nextCustom = { ...customAnswers, [questionId]: text };
    setAnswers(nextAnswers);
    setCustomAnswers(nextCustom);
    persistAnswers(nextAnswers, nextCustom, false);
    advanceAfterAnswer();
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
    setCustomAnswers({});
    setIndex(0);
    setStage("welcome");
    clearQuizAnswersKeepMentor();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleUnlocked(tier: InfinitePayTier) {
    applyUnlock(tier, null);
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
              customAnswers={customAnswers}
              onSelect={handleSelect}
              onCustomSelect={handleCustomSelect}
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
            <PaywallScreen
              result={result}
              onUnlocked={handleUnlocked}
              verifying={verifying}
              verifyError={verifyError}
              onRetryVerify={() => {
                const p = returnParamsRef.current;
                if (p) void runVerify(p);
              }}
              onBackFromVerify={() => {
                setVerifying(false);
                setVerifyError(null);
                cleanReturnUrl();
                verifyStartedRef.current = false;
              }}
            />
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
