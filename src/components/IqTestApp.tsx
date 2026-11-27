"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createSessionSeed,
  getAssessmentItems,
  getModeRules,
  getModeTutorial,
  getSessionAssessmentItems,
  isMatrixQuestion,
  isTextQuestion,
} from "@/src/lib/assessmentBank";
import {
  calculateIqResult,
  competenceLabel,
  distractorErrorLabel,
  findNextUnanswered,
  percentilePlainLanguage,
  sessionConsistencyLabel,
} from "@/src/lib/iqCalculator";
import {
  INDEX_META,
  indexLabel,
  subtestLabel,
} from "@/src/lib/chcCatalog";

/** Onde o índice tenderia a “brilhar” — alinhado ao hook do hero. */
const SHINE_ACTIVITY: Record<CognitiveIndexId, string> = {
  verbal: "Análise estratégica e leitura de premissas",
  fluido: "Resolução de problemas complexos e novos",
  espacial: "Raciocínio visual-espacial",
  memoria_trabalho: "Memória multitask sob carga",
  velocidade_processamento: "Processamento ágil com poucos erros",
  tempo_reacao: "Decisões ágeis sob pressão",
};
import {
  competenceHelp,
  ESCALA_HELP,
  indexHelp,
  subtestHelp,
} from "@/src/lib/skillHelp";
import {
  buildLeaderboardEntry,
  durationSecondsFromSession,
  getLeaderboardRank,
  listLeaderboard,
  normalizeParticipantName,
  submitLeaderboardEntry,
} from "@/src/lib/leaderboard";
import {
  clearQuizState,
  createInitialState,
  createModeSelectState,
  loadQuizState,
  saveQuizState,
} from "@/src/lib/quizStorage";
import {
  ANONYMOUS_PARTICIPANT_NAME,
  MODE_META,
  QUIZ_DURATION_MS,
  QUIZ_TOTAL_QUESTIONS,
  bandProgressLabel,
  type AssessmentMode,
  type CognitiveIndexId,
  type QuizItem,
  type QuizPersistedState,
} from "@/src/types/quiz";
import { BellCurveChart } from "@/src/components/BellCurveChart";
import { ChallengeSharePanel } from "@/src/components/ChallengeSharePanel";
import {
  IqLanding,
  PsychometricTransparencyBlock,
} from "@/src/components/IqLanding";
import { SkillHelpTip } from "@/src/components/SkillHelpTip";
import {
  LeaderboardPanel,
  UserRankBanner,
} from "@/src/components/LeaderboardPanel";
import { ProfileDoubtAssistant } from "@/src/components/ProfileDoubtAssistant";
import {
  AvatarPicker,
  ParticipantAvatar,
} from "@/src/components/ParticipantAvatar";
import { MatrixRenderer, OptionGrid } from "@/src/components/MatrixRenderer";
import { ShareResultCard } from "@/src/components/ShareResultCard";
import { IqUnlockCard } from "@/src/components/IqUnlockCard";
import { TestLineQiLogo } from "@/src/components/TestLineQiLogo";
import {
  parseChallengeInvite,
  type ChallengeInvite,
} from "@/src/lib/challengeInvite";
import {
  cleanIqPaymentReturnUrl,
  createIqSessionId,
  fetchIqUnlockStatus,
} from "@/src/lib/iqUnlockClient";

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function useCountdown(endsAt: number | null, onExpire: () => void) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);
  useEffect(() => {
    if (endsAt && now >= endsAt) onExpire();
  }, [endsAt, now, onExpire]);
  return endsAt ? Math.max(0, endsAt - now) : QUIZ_DURATION_MS;
}

const LETTERS = "ABCDEFGH";

export function IqTestApp() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<QuizPersistedState>(createModeSelectState);
  const [tutorialPick, setTutorialPick] = useState<number | null>(null);
  const [tutorialOk, setTutorialOk] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [nameError, setNameError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [leaderboardTick, setLeaderboardTick] = useState(0);
  const [challengeInvite, setChallengeInvite] =
    useState<ChallengeInvite | null>(null);
  const [finishWarning, setFinishWarning] = useState<string | null>(null);
  const [serverUnlocked, setServerUnlocked] = useState(false);
  const [serverAiUnlocked, setServerAiUnlocked] = useState(false);
  const [unlockAmountLabel, setUnlockAmountLabel] = useState("R$ 1,00");
  const [aiUpsellAmountLabel, setAiUpsellAmountLabel] = useState("R$ 1,00");
  const [unlockChecking, setUnlockChecking] = useState(false);
  const [unlockVerifyError, setUnlockVerifyError] = useState<string | null>(
    null,
  );

  const mode: AssessmentMode | null =
    state.phase === "modeSelect" ? null : state.mode;

  const questions = useMemo(() => {
    if (!mode) return [];
    // Live / resumed sessions use seeded shuffle; onboarding preview stays canonical
    if (state.sessionSeed != null && state.phase !== "onboarding") {
      return getSessionAssessmentItems(mode, state.sessionSeed);
    }
    return getAssessmentItems(mode);
  }, [mode, state.sessionSeed, state.phase]);
  const totalQ = questions.length || QUIZ_TOTAL_QUESTIONS;
  const tutorial = useMemo(
    () => (mode ? getModeTutorial(mode) : null),
    [mode],
  );
  const rules = useMemo(() => (mode ? getModeRules(mode) : null), [mode]);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    setChallengeInvite(parseChallengeInvite(window.location.search));
    cleanIqPaymentReturnUrl();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveQuizState(state);
  }, [state, hydrated]);

  // Mint sessionId for legacy finished sessions that predate the paywall.
  useEffect(() => {
    if (!hydrated) return;
    if (state.phase !== "results" && state.phase !== "review") return;
    if (state.sessionId) return;
    setState((prev) =>
      prev.sessionId
        ? prev
        : {
            ...prev,
            sessionId: createIqSessionId(),
            resultsUnlocked: false,
          },
    );
  }, [hydrated, state.phase, state.sessionId]);

  // Reconcile unlock with server — localStorage flag alone never unlocks.
  useEffect(() => {
    if (!hydrated) return;
    if (state.phase !== "results" && state.phase !== "review") return;
    const sessionId = state.sessionId;
    if (!sessionId) {
      setServerUnlocked(false);
      return;
    }

    let cancelled = false;
    setUnlockChecking(true);
    void (async () => {
      try {
        const status = await fetchIqUnlockStatus(sessionId);
        if (cancelled) return;
        if (status.resultAmountLabel) {
          setUnlockAmountLabel(status.resultAmountLabel);
        } else if (status.amountLabel) {
          setUnlockAmountLabel(status.amountLabel);
        }
        if (status.aiAmountLabel) {
          setAiUpsellAmountLabel(status.aiAmountLabel);
        }
        setServerAiUnlocked(Boolean(status.aiUnlocked));
        if (status.resultUnlocked || status.unlocked) {
          applyServerUnlock(status.paymentId ?? status.order_nsu);
        } else {
          setServerUnlocked(false);
          // Drop stale client-only unlock claims.
          if (state.resultsUnlocked) {
            setState((prev) => ({ ...prev, resultsUnlocked: false }));
          }
        }
      } catch {
        if (!cancelled) {
          setServerUnlocked(false);
          setServerAiUnlocked(false);
          setUnlockVerifyError(
            "Não foi possível verificar o desbloqueio no servidor. Tente de novo — sua sessão permanece salva.",
          );
        }
      } finally {
        if (!cancelled) setUnlockChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: gate on phase/sessionId
  }, [hydrated, state.phase, state.sessionId]);

  const finishTest = useCallback(
    (
      prev: QuizPersistedState,
      opts: { timedOut?: boolean } = {},
    ): QuizPersistedState => {
      if (prev.phase === "results" || prev.phase === "review") return prev;
      const items =
        prev.sessionSeed != null
          ? getSessionAssessmentItems(prev.mode, prev.sessionSeed)
          : getAssessmentItems(prev.mode);
      const n = items.length;
      const timeSpent = [...prev.timeSpentMs];
      if (
        prev.questionStartedAt &&
        prev.currentIndex >= 0 &&
        prev.currentIndex < n
      ) {
        timeSpent[prev.currentIndex] += Date.now() - prev.questionStartedAt;
      }
      const switches = prev.optionSwitches ?? Array(n).fill(0);
      const result = calculateIqResult(
        items,
        prev.answers,
        timeSpent,
        switches,
        prev.mode,
        { timedOut: Boolean(opts.timedOut) },
      );
      const finishedAt = Date.now();
      const displayName = normalizeParticipantName(prev.participantName ?? "");
      const avatarUrl = prev.participantAvatarUrl || null;
      const sessionId = prev.sessionId || createIqSessionId();
      // Leaderboard / Hall of Fame only after server unlock confirm.
      return {
        ...prev,
        participantName: displayName,
        participantAvatarUrl: avatarUrl,
        phase: "results",
        timeSpentMs: timeSpent,
        questionStartedAt: null,
        finishedAt,
        result,
        sessionId,
        resultsUnlocked: false,
        leaderboardEntryId: prev.leaderboardEntryId,
      };
    },
    [],
  );

  const applyServerUnlock = useCallback(
    (orderNsu?: string | null) => {
      setServerUnlocked(true);
      setUnlockVerifyError(null);
      setState((prev) => {
        if (!prev.result) {
          return {
            ...prev,
            resultsUnlocked: true,
            unlockOrderNsu: orderNsu ?? prev.unlockOrderNsu,
          };
        }
        let leaderboardEntryId = prev.leaderboardEntryId;
        if (!leaderboardEntryId) {
          const finishedAt = prev.finishedAt ?? Date.now();
          const entry = buildLeaderboardEntry({
            name: normalizeParticipantName(prev.participantName ?? ""),
            result: prev.result,
            durationSeconds: durationSecondsFromSession(
              prev.startedAt,
              finishedAt,
              prev.timeSpentMs,
            ),
            createdAt: finishedAt,
            avatarUrl: prev.participantAvatarUrl || null,
          });
          submitLeaderboardEntry(entry);
          leaderboardEntryId = entry.id;
        }
        return {
          ...prev,
          resultsUnlocked: true,
          unlockOrderNsu: orderNsu ?? prev.unlockOrderNsu,
          leaderboardEntryId,
        };
      });
      cleanIqPaymentReturnUrl();
    },
    [],
  );

  useEffect(() => {
    if (state.phase === "results" && state.leaderboardEntryId) {
      setLeaderboardTick((t) => t + 1);
    }
  }, [state.phase, state.leaderboardEntryId]);

  const onExpire = useCallback(() => {
    setFinishWarning(null);
    setState((prev) => {
      if (prev.phase !== "test") return prev;
      return finishTest(prev, { timedOut: true });
    });
  }, [finishTest]);

  const remaining = useCountdown(
    state.phase === "test" ? state.endsAt : null,
    onExpire,
  );

  const progress =
    totalQ > 0
      ? state.answers.filter((a) => a !== null).length / totalQ
      : 0;

  const selectMode = (m: AssessmentMode) => {
    const saved = loadQuizState(m);
    setTutorialPick(null);
    setTutorialOk(false);
    setNameError(null);
    setAvatarError(null);
    setReviewIndex(0);
    const keepName = state.participantName ?? "";
    const keepAvatar = state.participantAvatarUrl ?? null;
    if (saved && saved.phase !== "onboarding" && saved.phase !== "modeSelect") {
      setState({
        ...saved,
        participantName: saved.participantName || keepName,
        participantAvatarUrl:
          saved.participantAvatarUrl ?? keepAvatar ?? null,
      });
      return;
    }
    setState({
      ...createInitialState(
        m,
        getAssessmentItems(m).length,
        keepName,
        keepAvatar,
      ),
      participantName: saved?.participantName || keepName,
      participantAvatarUrl:
        saved?.participantAvatarUrl ?? keepAvatar ?? null,
    });
  };

  const startOfficial = () => {
    if (!mode) return;
    const raw = state.participantName ?? "";
    // Empty → Anônimo at submit; reject whitespace-only noise
    if (raw.length > 0 && raw.trim().length === 0) {
      setNameError(
        "Nome inválido. Preencha um nome/apelido ou deixe em branco para Anônimo.",
      );
      return;
    }
    setNameError(null);
    setAvatarError(null);
    const name = raw.trim();
    const avatarUrl = state.participantAvatarUrl ?? null;
    const now = Date.now();
    const sessionSeed = createSessionSeed();
    const n = getSessionAssessmentItems(mode, sessionSeed).length;
    setState({
      ...createInitialState(mode, n, name, avatarUrl, sessionSeed),
      phase: "test",
      startedAt: now,
      endsAt: now + QUIZ_DURATION_MS,
      questionStartedAt: now,
      participantName: name,
      participantAvatarUrl: avatarUrl,
      sessionSeed,
    });
  };

  const selectAnswer = (optionIndex: number) => {
    setFinishWarning(null);
    setState((prev) => {
      if (prev.phase !== "test") return prev;
      const n = prev.totalQuestions || QUIZ_TOTAL_QUESTIONS;
      const answers = [...prev.answers];
      const switches = [...(prev.optionSwitches ?? Array(n).fill(0))];
      const prevSel = answers[prev.currentIndex];
      if (prevSel !== null && prevSel !== optionIndex) {
        switches[prev.currentIndex] += 1;
      }
      answers[prev.currentIndex] = optionIndex;
      return { ...prev, answers, optionSwitches: switches };
    });
  };

  const goTo = (index: number) => {
    setState((prev) => {
      if (prev.phase !== "test") return prev;
      const timeSpent = [...prev.timeSpentMs];
      if (prev.questionStartedAt) {
        timeSpent[prev.currentIndex] += Date.now() - prev.questionStartedAt;
      }
      return {
        ...prev,
        currentIndex: index,
        timeSpentMs: timeSpent,
        questionStartedAt: Date.now(),
      };
    });
  };

  const advance = () => {
    setState((prev) => {
      if (prev.phase !== "test") return prev;
      const n = prev.totalQuestions || questions.length;
      if (prev.currentIndex >= n - 1) {
        const blankIdx = findNextUnanswered(prev.answers, 0);
        if (blankIdx >= 0) {
          const blankCount = prev.answers.filter((a) => a === null).length;
          queueMicrotask(() => {
            setFinishWarning(
              `Ainda há ${blankCount} questão(ões) sem resposta. Responda todas para ver o resultado.`,
            );
          });
          const timeSpent = [...prev.timeSpentMs];
          if (prev.questionStartedAt) {
            timeSpent[prev.currentIndex] += Date.now() - prev.questionStartedAt;
          }
          return {
            ...prev,
            currentIndex: blankIdx,
            timeSpentMs: timeSpent,
            questionStartedAt: Date.now(),
          };
        }
        queueMicrotask(() => setFinishWarning(null));
        return finishTest(prev);
      }
      const timeSpent = [...prev.timeSpentMs];
      if (prev.questionStartedAt) {
        timeSpent[prev.currentIndex] += Date.now() - prev.questionStartedAt;
      }
      queueMicrotask(() => setFinishWarning(null));
      return {
        ...prev,
        currentIndex: prev.currentIndex + 1,
        timeSpentMs: timeSpent,
        questionStartedAt: Date.now(),
      };
    });
  };

  const goBack = () => {
    setState((prev) => {
      if (prev.phase !== "test" || prev.currentIndex <= 0) return prev;
      const timeSpent = [...prev.timeSpentMs];
      if (prev.questionStartedAt) {
        timeSpent[prev.currentIndex] += Date.now() - prev.questionStartedAt;
      }
      return {
        ...prev,
        currentIndex: prev.currentIndex - 1,
        timeSpentMs: timeSpent,
        questionStartedAt: Date.now(),
      };
    });
  };

  useEffect(() => {
    if (state.phase !== "test") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const map: Record<string, number> = {
        "1": 0,
        "2": 1,
        "3": 2,
        "4": 3,
        "5": 4,
        "6": 5,
        "7": 6,
        "8": 7,
        a: 0,
        b: 1,
        c: 2,
        d: 3,
        e: 4,
        f: 5,
        g: 6,
        h: 7,
        A: 0,
        B: 1,
        C: 2,
        D: 3,
        E: 4,
        F: 5,
        G: 6,
        H: 7,
      };
      if (e.key in map) {
        const q = questions[state.currentIndex];
        const optLen = q
          ? isMatrixQuestion(q)
            ? q.options.length
            : q.options.length
          : 0;
        if (map[e.key] >= optLen) return;
        e.preventDefault();
        selectAnswer(map[e.key]);
        return;
      }
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const resetAll = (keepName = true) => {
    const name = keepName ? (state.participantName ?? "") : "";
    const avatar = keepName ? (state.participantAvatarUrl ?? null) : null;
    if (mode) clearQuizState(mode);
    setTutorialPick(null);
    setTutorialOk(false);
    setNameError(null);
    setAvatarError(null);
    setFinishWarning(null);
    setReviewIndex(0);
    setState({
      ...createModeSelectState(),
      participantName: name,
      participantAvatarUrl: avatar,
    });
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-zinc-500">
        <TestLineQiLogo href={null} priority />
        <p className="text-sm">Carregando avaliação…</p>
      </div>
    );
  }

  const q = questions[state.currentIndex];
  const bandLabel = q ? bandProgressLabel(q.difficulty) : "";

  return (
    <div className="iq-shell relative mx-auto min-h-screen max-w-6xl overflow-x-hidden px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[#06070A]" />
        <div className="absolute inset-0 bg-[#090A0F]/80" />
        <div className="absolute -left-28 top-[-4rem] h-[28rem] w-[28rem] rounded-full bg-indigo-500/15 blur-[100px]" />
        <div className="absolute -right-20 top-32 h-[22rem] w-[22rem] rounded-full bg-cyan-400/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 20%, #000 20%, transparent 75%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse 70% 50% at 70% 10%, #000 10%, transparent 70%)",
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {state.phase === "modeSelect" && (
          <IqLanding
            participantName={state.participantName ?? ""}
            participantAvatarUrl={state.participantAvatarUrl ?? null}
            nameError={nameError}
            avatarError={avatarError}
            challengeInvite={challengeInvite}
            leaderboardTick={leaderboardTick}
            onNameChange={(value) => {
              setNameError(null);
              setState((prev) => ({ ...prev, participantName: value }));
            }}
            onAvatarChange={(next) => {
              setAvatarError(null);
              setState((prev) => ({ ...prev, participantAvatarUrl: next }));
            }}
            onAvatarError={setAvatarError}
            onSelectMode={selectMode}
          />
        )}

        {state.phase === "onboarding" && mode && tutorial && rules && (
          <OnboardingTransition
            mode={mode}
            rules={rules}
            tutorial={tutorial}
            tutorialPick={tutorialPick}
            tutorialOk={tutorialOk}
            participantName={state.participantName ?? ""}
            participantAvatarUrl={state.participantAvatarUrl ?? null}
            nameError={nameError}
            avatarError={avatarError}
            onBack={() =>
              setState({
                ...createModeSelectState(),
                participantName: state.participantName ?? "",
                participantAvatarUrl: state.participantAvatarUrl ?? null,
              })
            }
            onNameChange={(value) => {
              setNameError(null);
              setState((prev) => ({ ...prev, participantName: value }));
            }}
            onAvatarChange={(next) => {
              setAvatarError(null);
              setState((prev) => ({ ...prev, participantAvatarUrl: next }));
            }}
            onAvatarError={setAvatarError}
            onTutorialSelect={(i) => {
              setTutorialPick(i);
              setTutorialOk(i === tutorial.correctIndex);
            }}
            onStart={startOfficial}
          />
        )}

        {state.phase === "test" && q && (
          <motion.section
            key="test"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            <header className="sticky top-0 z-20 -mx-4 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <TestLineQiLogo
                    variant="icon"
                    href="/teste-qi"
                    className="!h-7 !w-7 sm:!h-8 sm:!w-8"
                  />
                  <span className="font-iq-display text-lg text-zinc-100 tabular-nums">
                    {state.currentIndex + 1}
                    <span className="text-zinc-600">/{totalQ}</span>
                  </span>
                  <span className="text-xs text-zinc-400">
                    {mode ? MODE_META[mode].short : ""} · {bandLabel}
                    {isTextQuestion(q) ? " · Pergunta" : " · Figura"}
                  </span>
                </div>
                <div
                  className={`font-mono text-lg tabular-nums ${
                    remaining < 60_000 ? "text-red-400" : "text-zinc-200"
                  }`}
                  aria-live="polite"
                >
                  {formatTime(remaining)}
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                  initial={false}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              {finishWarning ? (
                <p
                  className="mt-2 text-xs text-amber-300"
                  role="alert"
                  aria-live="assertive"
                >
                  {finishWarning}
                </p>
              ) : null}
            </header>

            <div className="flex flex-wrap justify-center gap-1.5 py-1">
              {questions.map((item, i) => {
                const answered = state.answers[i] !== null;
                const current = i === state.currentIndex;
                return (
                  <button
                    key={`${item.kind}-${item.id}-${i}`}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`h-2.5 w-2.5 rounded-full transition ${
                      current
                        ? "bg-emerald-400 ring-2 ring-emerald-400/30"
                        : answered
                          ? isTextQuestion(item)
                            ? "bg-amber-400/80"
                            : "bg-indigo-400/80"
                          : "bg-zinc-700"
                    }`}
                    aria-label={`Ir para questão ${i + 1}`}
                  />
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${q.kind}-${q.id}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center gap-6"
              >
                {isMatrixQuestion(q) ? (
                  <>
                    <div className="w-full max-w-[360px]">
                      <MatrixRenderer
                        cells={q.cells}
                        size={320}
                        className="!h-auto !w-full max-w-full"
                      />
                    </div>
                    <div className="w-full max-w-4xl">
                      <OptionGrid
                        options={q.options}
                        selectedIndex={state.answers[state.currentIndex]}
                        onSelect={selectAnswer}
                        cellSize={q.options.length >= 8 ? 78 : 88}
                      />
                    </div>
                  </>
                ) : (
                  <div className="w-full max-w-2xl space-y-4">
                    <p className="text-lg leading-relaxed text-zinc-100">
                      {q.stem}
                    </p>
                    {q.premises && q.premises.length > 0 ? (
                      <ul className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
                        {q.premises.map((p, pi) => (
                          <li key={`premise-${pi}`} className="flex gap-2">
                            <span className="shrink-0 text-zinc-600">•</span>
                            <span className="min-w-0 break-words">{p}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <TextOptionList
                      options={q.options}
                      selectedIndex={state.answers[state.currentIndex]}
                      onSelect={selectAnswer}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                disabled={state.currentIndex === 0}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <button
                type="button"
                onClick={advance}
                className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400"
              >
                {state.currentIndex === totalQ - 1
                  ? "Ver resultados"
                  : "Próxima →"}
              </button>
            </div>
          </motion.section>
        )}

        {(state.phase === "results" || state.phase === "review") &&
          state.result &&
          state.sessionId &&
          !serverUnlocked && (
            <motion.div
              key="iq-unlock-gate"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pt-6"
            >
              <header className="space-y-2 text-center">
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-emerald-300/80">
                  Selo de conclusão · {MODE_META[state.mode].short}
                </p>
                <h1 className="font-iq-display text-3xl text-zinc-50 sm:text-4xl">
                  Parabéns — você concluiu
                </h1>
                <p className="mx-auto max-w-md text-sm text-zinc-500">
                  {unlockChecking
                    ? "Só um instante — confirmando se seu resultado já foi liberado…"
                    : "Seu diagnóstico já foi calculado. Falta só o passo abaixo para abrir tudo com carinho."}
                </p>
              </header>
              {unlockVerifyError ? (
                <p
                  role="alert"
                  className="mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-100/90"
                >
                  {unlockVerifyError}
                </p>
              ) : null}
              <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2 lg:items-start">
                <IqUnlockCard
                  sessionId={state.sessionId}
                  itemType="result"
                  amountLabel={unlockAmountLabel}
                  onAmountLabel={setUnlockAmountLabel}
                  onUnlocked={(paymentId) => {
                    applyServerUnlock(paymentId);
                  }}
                />
                {/* Public Hall of Fame while locked — names/scores only; no locked session IQ leak. */}
                <LeaderboardPanel
                  refreshKey={leaderboardTick}
                  hallOfFame
                  compact
                />
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => resetAll(true)}
                  className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  Nova tentativa (mesmo nome)
                </button>
                <button
                  type="button"
                  onClick={() => resetAll(false)}
                  className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  Começar com outro nome
                </button>
              </div>
            </motion.div>
          )}

        {(state.phase === "results" || state.phase === "review") &&
          state.result &&
          serverUnlocked && (
            <ResultsDashboard
              result={state.result}
              questions={questions}
              answers={state.answers}
              phase={state.phase}
              reviewIndex={reviewIndex}
              setReviewIndex={setReviewIndex}
              participantName={
                state.participantName || ANONYMOUS_PARTICIPANT_NAME
              }
              participantAvatarUrl={state.participantAvatarUrl ?? null}
              leaderboardEntryId={state.leaderboardEntryId}
              leaderboardTick={leaderboardTick}
              sessionId={state.sessionId}
              aiUnlocked={serverAiUnlocked}
              aiUpsellAmountLabel={aiUpsellAmountLabel}
              onAiAmountLabel={setAiUpsellAmountLabel}
              onAiUnlocked={() => setServerAiUnlocked(true)}
              onOpenReview={() => {
                setReviewIndex(0);
                setState((p) => ({ ...p, phase: "review" }));
              }}
              onBackFromReview={() =>
                setState((p) => ({ ...p, phase: "results" }))
              }
              onResetSameName={() => resetAll(true)}
              onResetOtherName={() => resetAll(false)}
            />
          )}
      </AnimatePresence>
    </div>
  );
}

function OnboardingTransition({
  mode,
  rules,
  tutorial,
  tutorialPick,
  tutorialOk,
  participantName,
  participantAvatarUrl,
  nameError,
  avatarError,
  onBack,
  onNameChange,
  onAvatarChange,
  onAvatarError,
  onTutorialSelect,
  onStart,
}: {
  mode: AssessmentMode;
  rules: { title: string; bullets: { t: string; d: string }[] };
  tutorial: import("@/src/lib/assessmentBank").TutorialExample;
  tutorialPick: number | null;
  tutorialOk: boolean;
  participantName: string;
  participantAvatarUrl: string | null;
  nameError: string | null;
  avatarError: string | null;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onAvatarChange: (next: string | null) => void;
  onAvatarError: (msg: string | null) => void;
  onTutorialSelect: (i: number) => void;
  onStart: () => void;
}) {
  const reduce = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <motion.section
      key={`onboarding-${mode}`}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reduce ? 0 : 0.4, ease }}
      className="space-y-8"
    >
      <header className="space-y-3 pt-2 text-center sm:pt-6">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          ← Trocar modo
        </button>
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-300/80">
          {MODE_META[mode].short} · Preparação
        </p>
        <h1 className="font-iq-display text-4xl tracking-tight text-zinc-50 sm:text-5xl">
          {rules.title}
        </h1>
        <p className="mx-auto max-w-xl text-base text-zinc-400 sm:text-lg">
          {MODE_META[mode].blurb}{" "}
          <span className="tabular-nums text-zinc-300">30</span> itens ·{" "}
          <span className="tabular-nums text-zinc-300">5</span> níveis ·{" "}
          <span className="inline-flex items-center gap-1.5 align-middle">
            Escala 100/15
            <SkillHelpTip label="Escala 100/15" help={ESCALA_HELP} />
          </span>
          {" "}
          (média <span className="tabular-nums text-zinc-300">100</span>,
          desvio <span className="tabular-nums text-zinc-300">15</span>).
        </p>
      </header>

      <PsychometricTransparencyBlock compact />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.08, duration: 0.35 }}
        className="mx-auto w-full max-w-md space-y-4 rounded-3xl border border-white/[0.1] bg-[#0C0E16]/75 p-5 shadow-[0_0_40px_-18px_rgba(99,102,241,0.35)] backdrop-blur-xl"
      >
        <div className="space-y-2">
          <label
            htmlFor="iq-participant-name"
            className="block text-sm font-medium text-zinc-200"
          >
            Nome / Apelido
          </label>
          <input
            id="iq-participant-name"
            type="text"
            autoComplete="nickname"
            maxLength={40}
            value={participantName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={`Ex.: Maria Silva (vazio → ${ANONYMOUS_PARTICIPANT_NAME})`}
            className="w-full rounded-xl border border-white/[0.08] bg-[#06070A]/80 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/25"
          />
          <p className="text-xs leading-relaxed text-zinc-500">
            Use um nome real para figurar com clareza no ranking local. Campo
            vazio registra como {ANONYMOUS_PARTICIPANT_NAME}.
          </p>
          {nameError ? (
            <p className="text-xs text-amber-400" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <AvatarPicker
            name={participantName.trim() || ANONYMOUS_PARTICIPANT_NAME}
            avatarUrl={participantAvatarUrl}
            error={avatarError}
            onError={onAvatarError}
            onChange={onAvatarChange}
          />
        </div>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.12, duration: 0.35 }}
        className="grid gap-4 rounded-3xl border border-white/[0.08] bg-[#0C0E16]/65 p-5 backdrop-blur-md sm:grid-cols-3 sm:p-6"
      >
        {rules.bullets.map((item, i) => (
          <motion.div
            key={item.t}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.14 + i * 0.05 }}
            className="space-y-1.5"
          >
            <h2 className="font-iq-display text-sm tracking-tight text-zinc-200">
              {item.t}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-500">{item.d}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.16, duration: 0.35 }}
        className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0C0E16]/80 p-5 backdrop-blur-xl sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-iq-display text-lg tracking-tight text-zinc-100">
              Mini-exemplo (sem cronômetro)
            </h2>
            <p className="text-sm text-zinc-500">
              Resolva o exemplo antes de iniciar o timer oficial.
            </p>
          </div>
          {tutorialOk ? (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
              Correto — pode iniciar
            </span>
          ) : null}
        </div>

        {tutorial.kind === "matrix" ? (
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
            <MatrixRenderer cells={tutorial.cells} size={280} />
            <div className="w-full max-w-md space-y-3">
              <OptionGrid
                options={tutorial.options}
                selectedIndex={tutorialPick}
                cellSize={72}
                onSelect={onTutorialSelect}
                revealedCorrect={
                  tutorialPick !== null ? tutorial.correctIndex : null
                }
              />
              <p className="text-center text-xs text-zinc-500">
                {tutorial.explanation}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <p className="text-base text-zinc-200">{tutorial.stem}</p>
            {tutorial.premises.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                {tutorial.premises.map((p, pi) => (
                  <li key={`tut-premise-${pi}`} className="break-words">
                    {p}
                  </li>
                ))}
              </ul>
            ) : null}
            <TextOptionList
              options={tutorial.options}
              selectedIndex={tutorialPick}
              revealedCorrect={
                tutorialPick !== null ? tutorial.correctIndex : null
              }
              onSelect={onTutorialSelect}
            />
            <p className="text-center text-xs text-zinc-500">
              {tutorial.explanation}
            </p>
          </div>
        )}
      </motion.div>

      <div className="flex flex-col items-center gap-3 pb-8">
        <motion.button
          type="button"
          whileHover={
            reduce || !tutorialOk
              ? undefined
              : {
                  boxShadow:
                    "0 0 36px -6px rgba(52,211,153,0.55), 0 0 0 1px rgba(52,211,153,0.25)",
                }
          }
          whileTap={reduce ? undefined : { scale: 0.98 }}
          disabled={!tutorialOk}
          onClick={onStart}
          className="rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 px-8 py-3.5 text-sm font-semibold text-[#06070A] shadow-[0_0_28px_-6px_rgba(52,211,153,0.45)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Iniciar Avaliação Oficial
        </motion.button>
        <p className="text-xs text-zinc-600">
          Progresso v3 isolado por modo neste navegador.
        </p>
      </div>
    </motion.section>
  );
}

function ResultsDashboard({
  result,
  questions,
  answers,
  phase,
  reviewIndex,
  setReviewIndex,
  participantName,
  participantAvatarUrl,
  leaderboardEntryId,
  leaderboardTick,
  sessionId,
  aiUnlocked,
  aiUpsellAmountLabel,
  onAiAmountLabel,
  onAiUnlocked,
  onOpenReview,
  onBackFromReview,
  onResetSameName,
  onResetOtherName,
}: {
  result: NonNullable<QuizPersistedState["result"]>;
  questions: QuizItem[];
  answers: (number | null)[];
  phase: "results" | "review";
  reviewIndex: number;
  setReviewIndex: (n: number) => void;
  participantName: string;
  participantAvatarUrl: string | null;
  leaderboardEntryId: string | null;
  leaderboardTick: number;
  sessionId: string | null;
  aiUnlocked: boolean;
  aiUpsellAmountLabel: string;
  onAiAmountLabel: (label: string) => void;
  onAiUnlocked: () => void;
  onOpenReview: () => void;
  onBackFromReview: () => void;
  onResetSameName: () => void;
  onResetOtherName: () => void;
}) {
  const pctCopy = percentilePlainLanguage(result.percentile);
  const consistency = sessionConsistencyLabel(result.diagnosis);
  const consistencyToneClass =
    consistency.tone === "coherent"
      ? "border-emerald-500/35 bg-emerald-500/5 text-emerald-300"
      : consistency.tone === "caution"
        ? "border-amber-500/35 bg-amber-500/5 text-amber-200"
        : "border-orange-500/40 bg-orange-500/8 text-orange-200";
  const ciHalf =
    result.confidenceMargin ?? result.marginOfError;
  const answeredInTime = result.diagnosis.answeredInTime;
  const timedOut = result.diagnosis.timedOut;

  const allRanked = useMemo(() => {
    void leaderboardTick;
    return listLeaderboard("all", leaderboardEntryId);
  }, [leaderboardEntryId, leaderboardTick]);
  const userRank = useMemo(() => {
    if (!leaderboardEntryId) return null;
    void leaderboardTick;
    return getLeaderboardRank(leaderboardEntryId, "all");
  }, [leaderboardEntryId, leaderboardTick]);

  return (
    <motion.section
      key="results"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pt-4"
      aria-label="Resultados da avaliação de QI"
    >
      <header className="space-y-3 text-center">
        <div className="flex flex-col items-center gap-2">
          <ParticipantAvatar
            name={participantName}
            avatarUrl={participantAvatarUrl}
            size="lg"
            ring
          />
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Resultado · {MODE_META[result.mode].label}
            {participantName ? ` · ${participantName}` : ""}
          </p>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          QI estimado
        </p>
        <motion.h1
          className="font-iq-display text-5xl text-zinc-50 tabular-nums sm:text-6xl"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
        >
          {result.iq}
          <span className="ml-2 text-xl font-normal text-zinc-400 sm:text-2xl">
            (±{ciHalf})
          </span>
        </motion.h1>
        <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500">
          Escala 100/15
          <SkillHelpTip label="Escala 100/15" help={ESCALA_HELP} />
        </p>
        <p className="text-sm tabular-nums text-zinc-400">
          Intervalo de confiança aproximado{" "}
          <span className="text-zinc-200">
            {result.iqLow}–{result.iqHigh}
          </span>
        </p>
        <p className="font-iq-display text-2xl tabular-nums text-zinc-50 sm:text-3xl">
          {result.percentile.toFixed(1)}
          <span className="ml-1 text-sm font-normal text-zinc-500">
            º percentil
          </span>
        </p>
        <p className="text-emerald-400/90">{result.band}</p>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-zinc-500">
          {pctCopy.summary} {pctCopy.rarity}
        </p>
      </header>

      {timedOut ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100"
        >
          <p className="font-medium">Tempo esgotado</p>
          <p className="mt-1 tabular-nums text-amber-100/90">
            Você respondeu {answeredInTime} de {questions.length} questões a
            tempo.
          </p>
        </div>
      ) : null}

      <article
        className={`rounded-2xl border p-4 sm:p-5 ${consistencyToneClass}`}
        aria-labelledby="consistency-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="consistency-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            Consistência da sessão
          </h2>
          <p className="font-iq-display text-2xl tabular-nums text-zinc-50">
            {result.consistencyScore}
            <span className="ml-1 text-sm font-normal opacity-70">/100</span>
          </p>
        </div>
        <p className="mt-2 text-sm font-medium">{consistency.title}</p>
        <p className="mt-1 text-sm leading-relaxed opacity-90">
          {consistency.meaning}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed opacity-80">
          {consistency.detail}
        </p>
        {consistency.impulseWarning ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-orange-400/35 bg-orange-500/10 px-3 py-2 text-sm text-orange-100"
          >
            {consistency.impulseWarning}
          </p>
        ) : null}
      </article>

      <UserRankBanner
        rank={userRank}
        total={allRanked.length}
        name={participantName}
        avatarUrl={participantAvatarUrl}
      />

      <LeaderboardPanel
        refreshKey={leaderboardTick}
        highlightEntryId={leaderboardEntryId}
        compact
      />

      <ShareResultCard
        data={{
          name: participantName,
          avatarUrl: participantAvatarUrl,
          iq: result.iq,
          marginOfError: ciHalf,
          percentile: result.percentile,
          rank: userRank,
          mode: result.mode,
          consistencyScore: result.consistencyScore,
        }}
      />

      <ChallengeSharePanel
        name={participantName}
        iq={result.iq}
        marginOfError={ciHalf}
        percentile={result.percentile}
        rank={userRank}
        mode={result.mode}
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
        <BellCurveChart iq={result.iq} percentile={result.percentile} />
      </div>

      <section
        aria-labelledby="profile-heading"
        className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5"
      >
        <h2
          id="profile-heading"
          className="text-sm font-semibold text-zinc-100"
        >
          Perfil cognitivo
        </h2>
        <p className="mt-1 font-iq-display text-lg text-zinc-50">
          {result.cognitiveProfile.label}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
          {result.cognitiveProfile.detail}
        </p>
        {result.cognitiveProfile.strengths[0] ? (
          <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3.5 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-300/90">
              Atividade de Maior Destaque
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {SHINE_ACTIVITY[result.cognitiveProfile.strengths[0].id]}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
              Índice líder: {result.cognitiveProfile.strengths[0].label} (
              {result.cognitiveProfile.strengths[0].score}%)
            </p>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-emerald-400/90">
              Pontos fortes
            </p>
            <ul className="mt-1.5 space-y-1">
              {result.cognitiveProfile.strengths.length ? (
                result.cognitiveProfile.strengths.map((s) => (
                  <li
                    key={s.id}
                    className="text-sm tabular-nums text-zinc-300"
                  >
                    {s.label}{" "}
                    <span className="text-zinc-500">({s.score}%)</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-zinc-600">—</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-amber-300/90">
              Pontos a desenvolver
            </p>
            <ul className="mt-1.5 space-y-1">
              {result.cognitiveProfile.improvements.length ? (
                result.cognitiveProfile.improvements.map((s) => (
                  <li
                    key={s.id}
                    className="text-sm tabular-nums text-zinc-300"
                  >
                    {s.label}{" "}
                    <span className="text-zinc-500">({s.score}%)</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-zinc-600">—</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="indices-heading">
        <h2
          id="indices-heading"
          className="mb-3 text-center text-sm font-medium text-zinc-400"
        >
          Índices cognitivos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.indexScores.map((ix) => (
            <div
              key={ix.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-300">
                  <span className="truncate">{indexLabel(ix.id)}</span>
                  <SkillHelpTip
                    label={indexLabel(ix.id)}
                    help={indexHelp(ix.id)}
                  />
                </span>
                <span className="shrink-0 tabular-nums text-zinc-400">
                  {ix.score}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full bg-cyan-400/90"
                  initial={{ width: 0 }}
                  animate={{ width: `${ix.score}%` }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                />
              </div>
              <p className="mt-2 text-[11px] tabular-nums text-zinc-500">
                {ix.descriptor} · QI≈{ix.iqApprox} · {ix.answered}/{ix.total}{" "}
                itens
                {ix.avgTimeMs
                  ? ` · ${(ix.avgTimeMs / 1000).toFixed(1)}s méd.`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="subtests-heading">
        <h2
          id="subtests-heading"
          className="mb-3 text-center text-sm font-medium text-zinc-400"
        >
          Subtestes
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {result.subtestScores.map((st) => (
            <div
              key={st.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3.5 py-2.5"
            >
              <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-zinc-300">
                <span className="truncate">{subtestLabel(st.id)}</span>
                <SkillHelpTip
                  label={subtestLabel(st.id)}
                  help={subtestHelp(st.id)}
                />
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-zinc-500">
                <span className="text-zinc-300">{st.score}%</span>
                <span className="mt-0.5 block text-[10px]">
                  {INDEX_META[st.index].short} · {st.descriptor}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {result.anomalies.count > 0 ? (
        <section
          aria-labelledby="anomalies-heading"
          className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="anomalies-heading"
              className="text-sm font-semibold text-zinc-100"
            >
              Anomalias detectadas
            </h2>
            <p className="text-sm tabular-nums text-orange-200">
              {result.anomalies.count} · impacto ≈+
              {result.anomalies.totalImpact} na margem
            </p>
          </div>
          <ul className="mt-3 space-y-2">
            {result.anomalies.hits.map((h, hi) => (
              <li
                key={`${h.kind}-${hi}`}
                className="text-sm leading-relaxed text-orange-100/90"
              >
                <span className="font-medium">{h.label}</span>
                <span className="text-orange-200/70">
                  {" "}
                  <span className="tabular-nums">(+{h.marginImpact})</span>
                  {" — "}
                  {h.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {aiUnlocked ? (
        <ProfileDoubtAssistant
          result={result}
          participantName={participantName}
          rank={userRank}
          rankTotal={allRanked.length}
          sessionId={sessionId}
        />
      ) : sessionId ? (
        <div className="space-y-3">
          <IqUnlockCard
            sessionId={sessionId}
            itemType="ai_upsell"
            amountLabel={aiUpsellAmountLabel}
            onAmountLabel={onAiAmountLabel}
            onUnlocked={() => onAiUnlocked()}
            compact
          />
          <p className="text-center text-xs text-zinc-600">
            O assistente Gemini fica disponível depois deste complemento — seu
            resultado e o Hall of Fame já estão liberados.
          </p>
        </div>
      ) : null}

      {result.activeCompetences.length > 0 ? (
        <details className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-400">
            Sub-habilidades legadas (compatibilidade)
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {result.activeCompetences.map((key) => {
              const value = result.competences[key];
              return (
                <div
                  key={key}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-400">
                      <span className="truncate">{competenceLabel(key)}</span>
                      <SkillHelpTip
                        label={competenceLabel(key)}
                        help={competenceHelp(key)}
                      />
                    </span>
                    <span className="shrink-0 tabular-nums text-zinc-500">
                      {value}%
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full bg-indigo-400/70"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      <details className="group rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
        <summary className="cursor-pointer list-none text-sm font-medium text-zinc-300 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            Detalhes técnicos (IRT)
            <span className="text-xs font-normal text-zinc-600 group-open:hidden">
              — expandir
            </span>
            <span className="hidden text-xs font-normal text-zinc-600 group-open:inline">
              — recolher
            </span>
          </span>
        </summary>
        <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Habilidade latente θ
              </dt>
              <dd className="mt-1 font-iq-display text-xl tabular-nums text-zinc-100">
                {result.theta.toFixed(3)}
              </dd>
              <p className="mt-1 text-xs text-zinc-500">
                Escala latente (média 0, DP≈1) do modelo 3PL.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Acertos ponderados
              </dt>
              <dd className="mt-1 font-iq-display text-xl tabular-nums text-zinc-100">
                {result.rawScore.toFixed(1)}
                <span className="text-sm font-normal text-zinc-500">
                  /{result.maxScore.toFixed(1)}
                </span>
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Tempo · trocas
              </dt>
              <dd className="mt-1 text-sm tabular-nums text-zinc-200">
                méd. {(result.avgTimeMs / 1000).toFixed(1)}s · med.{" "}
                {(result.timeMetrics.medianMs / 1000).toFixed(1)}s
              </dd>
              <p className="mt-1 text-xs tabular-nums text-zinc-500">
                {result.timeMetrics.answeredCount}/{questions.length}{" "}
                respondidas · trocas méd. {result.diagnosis.avgOptionSwitches}
              </p>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Por nível de dificuldade
            </h3>
            <div className="grid gap-2 sm:grid-cols-5">
              {result.diagnosis.bandTelemetry.map((bt) => (
                <div
                  key={bt.band}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center"
                >
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    N{bt.band}
                  </p>
                  <p className="text-xs text-zinc-300">{bt.label}</p>
                  <p className="mt-1 text-sm tabular-nums text-zinc-200">
                    {bt.answered ? `${Math.round(bt.accuracy * 100)}%` : "—"}
                  </p>
                  <p className="text-[11px] tabular-nums text-zinc-500">
                    {bt.avgTimeMs
                      ? `${(bt.avgTimeMs / 1000).toFixed(1)}s méd.`
                      : "sem tempo"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <ul className="space-y-1.5">
            {result.diagnosis.warnings.map((w) => (
              <li
                key={w}
                className={`text-sm leading-relaxed ${
                  result.diagnosis.guessingFlag ||
                  result.diagnosis.incompleteFlag ||
                  result.diagnosis.inconsistentFlag ||
                  timedOut
                    ? "text-amber-300/90"
                    : "text-emerald-400/80"
                }`}
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      </details>

      <PsychometricTransparencyBlock compact />

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onOpenReview}
          className="rounded-xl border border-zinc-600 px-5 py-2.5 text-sm text-zinc-200 hover:border-zinc-400"
        >
          Revisar itens comentados
        </button>
        <button
          type="button"
          onClick={onResetSameName}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          Nova tentativa (mesmo nome)
        </button>
        <button
          type="button"
          onClick={onResetOtherName}
          className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
        >
          Nova tentativa (outro nome)
        </button>
      </div>

      {phase === "review" && (
        <ReviewPanel
          questions={questions}
          answers={answers}
          index={reviewIndex}
          setIndex={setReviewIndex}
          onBack={onBackFromReview}
        />
      )}
    </motion.section>
  );
}

function TextOptionList({
  options,
  selectedIndex,
  onSelect,
  revealedCorrect = null,
  disabled = false,
}: {
  options: string[];
  selectedIndex: number | null;
  onSelect: (i: number) => void;
  revealedCorrect?: number | null;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt, i) => {
        const selected = selectedIndex === i;
        const isCorrect = revealedCorrect === i;
        const isWrong =
          revealedCorrect !== null && selected && revealedCorrect !== i;
        return (
          <button
            key={`text-opt-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={`flex w-full min-w-0 items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
              isCorrect
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
                : isWrong
                  ? "border-red-500/40 bg-red-500/10 text-red-100"
                  : selected
                    ? "border-indigo-400/60 bg-indigo-500/10 text-zinc-100"
                    : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-xs font-medium tabular-nums text-zinc-400">
              {LETTERS[i]}
            </span>
            <span className="min-w-0 break-words leading-relaxed">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function ReviewPanel({
  questions,
  answers,
  index,
  setIndex,
  onBack,
}: {
  questions: QuizItem[];
  answers: (number | null)[];
  index: number;
  setIndex: (n: number) => void;
  onBack: () => void;
}) {
  const items = questions.map((q, i) => ({
    q,
    i,
    selected: answers[i],
    correct: answers[i] === q.correctIndex,
  }));
  const total = items.length;
  if (total === 0) return null;

  const safe = ((index % total) + total) % total;
  const item = items[safe];
  const chosenLetter =
    item.selected != null ? LETTERS[item.selected] : null;
  const correctLetter = LETTERS[item.q.correctIndex];
  const rulePreview =
    item.q.explanation.rules[0] ?? item.q.explanation.pt;
  const shortRule =
    rulePreview.length > 140
      ? `${rulePreview.slice(0, 140)}…`
      : rulePreview;
  const err =
    item.selected != null && !item.correct
      ? item.q.distractorErrors[item.selected]
      : null;

  return (
    <div className="space-y-4 overflow-x-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold text-zinc-100">
          Revisão comentada{" "}
          <span className="tabular-nums">
            {safe + 1}/{total}
          </span>{" "}
          — Item {item.q.id} ·{" "}
          {isTextQuestion(item.q) ? "Pergunta" : "Figura"} ·{" "}
          {bandProgressLabel(item.q.difficulty)}
        </h3>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Fechar revisão
        </button>
      </div>

      <div
        className={`grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-3 ${
          item.correct
            ? "border-emerald-500/30 bg-emerald-500/5"
            : item.selected == null
              ? "border-zinc-700 bg-zinc-900/60"
              : "border-amber-500/30 bg-amber-500/5"
        }`}
      >
        <p>
          <span className="text-zinc-500">Sua escolha: </span>
          <span className="font-medium text-zinc-200">
            {chosenLetter ? `Opção ${chosenLetter}` : "Sem resposta"}
          </span>
        </p>
        <p>
          <span className="text-zinc-500">Correta: </span>
          <span className="font-medium text-emerald-300">
            Opção {correctLetter}
          </span>
        </p>
        <p className="min-w-0 sm:col-span-1">
          <span className="text-zinc-500">Regra: </span>
          <span className="break-words text-zinc-300" title={rulePreview}>
            {shortRule}
          </span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center">
        {isMatrixQuestion(item.q) ? (
          <>
            <MatrixRenderer cells={item.q.cells} size={260} />
            <div className="w-full max-w-lg space-y-3">
              <OptionGrid
                options={item.q.options}
                selectedIndex={item.selected}
                revealedCorrect={item.q.correctIndex}
                onSelect={() => {}}
                disabled
                cellSize={64}
              />
              {err ? (
                <p className="text-xs text-amber-400/90">
                  Tipo de erro: {distractorErrorLabel(err)}
                </p>
              ) : null}
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm leading-relaxed text-zinc-300">
                {item.q.explanation.pt}
              </p>
              <ul className="flex flex-wrap gap-2">
                {item.q.explanation.rules.map((r, ri) => (
                  <li
                    key={`rule-m-${ri}`}
                    className="max-w-full break-words rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400"
                    title={r}
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="w-full max-w-2xl space-y-3">
            <p className="break-words text-base text-zinc-100">{item.q.stem}</p>
            {item.q.premises?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                {item.q.premises.map((p, pi) => (
                  <li key={`rev-premise-${pi}`} className="break-words">
                    {p}
                  </li>
                ))}
              </ul>
            ) : null}
            <TextOptionList
              options={item.q.options}
              selectedIndex={item.selected}
              revealedCorrect={item.q.correctIndex}
              onSelect={() => {}}
              disabled
            />
            {err ? (
              <p className="text-xs text-amber-400/90">
                Tipo de erro: {distractorErrorLabel(err)}
              </p>
            ) : null}
            <p className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm leading-relaxed text-zinc-300">
              {item.q.explanation.pt}
            </p>
            <ul className="flex flex-wrap gap-2">
              {item.q.explanation.rules.map((r, ri) => (
                <li
                  key={`rule-t-${ri}`}
                  className="max-w-full break-words rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400"
                  title={r}
                >
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIndex(safe - 1)}
          disabled={safe === 0}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-30"
        >
          ← Anterior
        </button>
        <div className="flex flex-wrap justify-center gap-1">
          {items.map((it, i) => (
            <button
              key={`${it.q.kind}-${it.q.id}`}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full ${
                i === safe
                  ? "bg-emerald-400"
                  : it.correct
                    ? "bg-emerald-700"
                    : it.selected == null
                      ? "bg-zinc-700"
                      : "bg-amber-600"
              }`}
              aria-label={`Ir para item ${i + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIndex(safe + 1)}
          disabled={safe >= total - 1}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-30"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
