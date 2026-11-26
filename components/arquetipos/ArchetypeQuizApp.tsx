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
  clearQuizSession,
  isDiagnosisPaidPlan,
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
const IS_DEV = process.env.NODE_ENV === "development";

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

/** True only after paid diagnosis verify (or persisted paid diagnosis order). */
function sessionGrantsResult(): boolean {
  const session = readQuizSession();
  return isResultUnlocked(session);
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
      // Never unlock on finish — only preserve an already-paid diagnosis flag.
      const paidDiagnosis =
        Boolean(prev?.resultUnlocked) ||
        (Boolean(prev?.orderNsu) && isDiagnosisPaidPlan(prev?.paidPlan));
      writeQuizSession({
        answers: nextAnswers,
        customAnswers: nextCustom,
        completed,
        updatedAt: Date.now(),
        resultUnlocked: paidDiagnosis,
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
      const diagnosisTier =
        tier === "result" ||
        tier === "combo" ||
        tier === "basic_3" ||
        tier === "combo_890";
      // Diagnosis unlock requires a verified InfinitePay order_nsu (no free unlock).
      if (diagnosisTier && !orderNsu) {
        setVerifyError(
          "Pagamento sem order_nsu — não foi possível liberar o diagnóstico.",
        );
        setVerifying(false);
        setStage("paywall");
        return;
      }

      persistAnswers(answers, customAnswers, true);
      const session = unlockByTier(
        tier,
        buildMentorProfile(result),
        orderNsu ?? null,
      );
      // Diagnosis UI only for result | combo (or legacy). mentor_upgrade alone stays blocked.
      const diagnosisOpen = isResultUnlocked(session);
      writeIsUnlocked(diagnosisOpen);
      setUnlocked(diagnosisOpen);
      setVerifying(false);
      setVerifyError(null);
      cleanReturnUrl();
      if (diagnosisOpen) {
        setStage("result");
        playRevealChord();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Paid mentor-only: keep paywall for sealed diagnosis.
        setStage("paywall");
      }
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

  const handleDevReset = useCallback(() => {
    if (!IS_DEV) return;
    clearQuizSession();
    writeIsUnlocked(false);
    setUnlocked(false);
    setAnswers({});
    setCustomAnswers({});
    setIndex(0);
    setVerifying(false);
    setVerifyError(null);
    verifyStartedRef.current = false;
    returnParamsRef.current = null;
    cleanReturnUrl();
    setStage("welcome");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
    // Heal stale resultUnlocked from paid diagnosis order_nsu (reload path).
    let grantsResult = isResultUnlocked(session);
    if (
      session &&
      !session.resultUnlocked &&
      session.orderNsu &&
      isDiagnosisPaidPlan(session.paidPlan)
    ) {
      writeQuizSession({
        ...session,
        resultUnlocked: true,
        updatedAt: Date.now(),
      });
      grantsResult = true;
    }

    // Drop legacy localStorage isUnlocked — never grant access from it alone.
    if (readIsUnlocked() && !grantsResult) {
      writeIsUnlocked(false);
    }
    if (grantsResult) {
      writeIsUnlocked(true);
    }

    setUnlocked(grantsResult);

    if (session?.answers && Object.keys(session.answers).length > 0) {
      setAnswers(session.answers);
      setCustomAnswers(session.customAnswers ?? {});
      if (session.completed) {
        setStage(grantsResult && !returnParams ? "result" : "paywall");
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
    // Unlock-on-finish removed: always process → paywall unless already paid.
    setStage("processing");
  }, []);

  useEffect(() => {
    if (stage !== "processing") return;
    const t = window.setTimeout(() => {
      persistAnswers(answers, customAnswers, true);
      // Re-read after persist — never unlock just because the quiz finished.
      const paid = sessionGrantsResult();
      setUnlocked(paid);
      if (paid) {
        playRevealChord();
        setStage("result");
      } else {
        setStage("paywall");
      }
    }, PROCESSING_MS);
    return () => window.clearTimeout(t);
  }, [stage, answers, customAnswers, persistAnswers]);

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
    // Re-sync unlock from session (paid diagnosis may still be present).
    setUnlocked(sessionGrantsResult());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleUnlocked(tier: InfinitePayTier, orderNsu?: string | null) {
    applyUnlock(tier, orderNsu ?? null);
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

      {IS_DEV ? (
        <button
          type="button"
          onClick={handleDevReset}
          className="fixed bottom-3 right-3 z-[80] rounded border border-amber-700/60 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wider text-amber-200/90 hover:bg-black/90"
        >
          Reset session (dev)
        </button>
      ) : null}

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

        {stage === "result" && unlocked ? (
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
        ) : null}

        {stage === "result" && !unlocked ? (
          <motion.div
            key="result-blocked"
            initial={fade ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={fade ? undefined : { opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pt-14 sm:pt-16"
          >
            <PaywallScreen
              result={result}
              onUnlocked={handleUnlocked}
              verifying={false}
              verifyError={null}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
