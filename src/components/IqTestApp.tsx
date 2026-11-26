"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  getAssessmentItems,
  getModeRules,
  getModeTutorial,
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
import { competenceHelp, ESCALA_HELP } from "@/src/lib/skillHelp";
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
  type CompetenceScores,
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
import {
  AvatarPicker,
  ParticipantAvatar,
} from "@/src/components/ParticipantAvatar";
import { MatrixRenderer, OptionGrid } from "@/src/components/MatrixRenderer";
import { ShareResultCard } from "@/src/components/ShareResultCard";
import {
  parseChallengeInvite,
  type ChallengeInvite,
} from "@/src/lib/challengeInvite";

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

  const mode: AssessmentMode | null =
    state.phase === "modeSelect" ? null : state.mode;

  const questions = useMemo(
    () => (mode ? getAssessmentItems(mode) : []),
    [mode],
  );
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
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveQuizState(state);
  }, [state, hydrated]);

  const finishTest = useCallback(
    (
      prev: QuizPersistedState,
      opts: { timedOut?: boolean } = {},
    ): QuizPersistedState => {
      if (prev.phase === "results" || prev.phase === "review") return prev;
      const items = getAssessmentItems(prev.mode);
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
      let leaderboardEntryId = prev.leaderboardEntryId;
      if (!leaderboardEntryId) {
        const entry = buildLeaderboardEntry({
          name: displayName,
          result,
          durationSeconds: durationSecondsFromSession(
            prev.startedAt,
            finishedAt,
            timeSpent,
          ),
          createdAt: finishedAt,
          avatarUrl,
        });
        submitLeaderboardEntry(entry);
        leaderboardEntryId = entry.id;
      }
      return {
        ...prev,
        participantName: displayName,
        participantAvatarUrl: avatarUrl,
        phase: "results",
        timeSpentMs: timeSpent,
        questionStartedAt: null,
        finishedAt,
        result,
        leaderboardEntryId,
      };
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
    const n = getAssessmentItems(mode).length;
    setState({
      ...createInitialState(mode, n, name, avatarUrl),
      phase: "test",
      startedAt: now,
      endsAt: now + QUIZ_DURATION_MS,
      questionStartedAt: now,
      participantName: name,
      participantAvatarUrl: avatarUrl,
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
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-500">
        Carregando avaliação…
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
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
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
                        {q.premises.map((p) => (
                          <li key={p} className="flex gap-2">
                            <span className="text-zinc-600">•</span>
                            <span>{p}</span>
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
          state.result && (
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
                {tutorial.premises.map((p) => (
                  <li key={p}>{p}</li>
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
        <motion.h1
          className="font-iq-display text-5xl text-zinc-50 tabular-nums sm:text-6xl"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
        >
          {result.iq}
          <span className="ml-2 text-xl font-normal text-zinc-400 sm:text-2xl">
            (± {result.marginOfError} pts)
          </span>
        </motion.h1>
        <p className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500">
          Escala 100/15
          <SkillHelpTip label="Escala 100/15" help={ESCALA_HELP} />
        </p>
        <p className="text-emerald-400/90">{result.band}</p>
        <p className="mx-auto max-w-lg text-sm text-zinc-500">
          Intervalo aproximado {result.iqLow}–{result.iqHigh}. Acertos
          ponderados {result.rawScore.toFixed(1)}/{result.maxScore.toFixed(1)}.
        </p>
      </header>

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
          marginOfError: result.marginOfError,
          percentile: result.percentile,
          rank: userRank,
          mode: result.mode,
          credibilityScore: result.diagnosis.reliabilityIndex,
        }}
      />

      <ChallengeSharePanel
        name={participantName}
        iq={result.iq}
        marginOfError={result.marginOfError}
        percentile={result.percentile}
        rank={userRank}
        mode={result.mode}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-100">
            Percentil e raridade
          </h2>
          <p className="mt-1 text-2xl font-iq-display tabular-nums text-zinc-50">
            {result.percentile.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-zinc-500">
              º percentil
            </span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {pctCopy.summary}
          </p>
          <p className="mt-1.5 text-sm text-zinc-500">{pctCopy.rarity}</p>
        </article>

        <article
          className={`rounded-2xl border p-4 sm:p-5 ${consistencyToneClass}`}
        >
          <h2 className="text-sm font-semibold text-zinc-100">
            Consistência da sessão
          </h2>
          <p className="mt-1 text-lg font-medium">{consistency.title}</p>
          <p className="mt-2 text-sm leading-relaxed opacity-90">
            {consistency.detail}
          </p>
          <p className="mt-3 text-xs tabular-nums opacity-70">
            Consistência {result.consistencyScore}/100 · precisão{" "}
            {result.diagnosis.precisionScore}/100 · confiabilidade{" "}
            {result.diagnosis.reliabilityIndex}/100
          </p>
        </article>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
        <BellCurveChart iq={result.iq} percentile={result.percentile} />
      </div>

      <section aria-labelledby="skills-heading">
        <h2
          id="skills-heading"
          className="mb-3 text-center text-sm font-medium text-zinc-400"
        >
          Sub-habilidades nesta sessão
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(result.activeCompetences.length
            ? result.activeCompetences
            : (Object.keys(result.competences) as (keyof CompetenceScores)[])
          ).map((key) => {
            const value = result.competences[key];
            return (
              <div
                key={key}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-300">
                    <span className="truncate">{competenceLabel(key)}</span>
                    <SkillHelpTip
                      label={competenceLabel(key)}
                      help={competenceHelp(key)}
                    />
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {value}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    className="h-full bg-indigo-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.7, delay: 0.1 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="precision-heading"
        className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="precision-heading" className="text-lg font-semibold text-zinc-100">
            Detalhe por nível de dificuldade
          </h2>
          <p className="text-sm tabular-nums text-zinc-500">
            Tempo médio {(result.avgTimeMs / 1000).toFixed(1)}s · mediana{" "}
            {(result.timeMetrics.medianMs / 1000).toFixed(1)}s · respondidas{" "}
            {result.timeMetrics.answeredCount}/{questions.length} · trocas{" "}
            {result.diagnosis.avgOptionSwitches}
          </p>
        </div>

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

        <ul className="space-y-1.5">
          {result.diagnosis.warnings.map((w) => (
            <li
              key={w}
              className={`text-sm leading-relaxed ${
                result.diagnosis.guessingFlag ||
                result.diagnosis.incompleteFlag ||
                result.diagnosis.inconsistentFlag
                  ? "text-amber-300/90"
                  : "text-emerald-400/80"
              }`}
            >
              {w}
            </li>
          ))}
        </ul>
      </section>

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
            key={`${i}-${opt.slice(0, 24)}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
              isCorrect
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
                : isWrong
                  ? "border-red-500/40 bg-red-500/10 text-red-100"
                  : selected
                    ? "border-indigo-400/60 bg-indigo-500/10 text-zinc-100"
                    : "border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-xs font-medium text-zinc-400">
              {LETTERS[i]}
            </span>
            <span className="leading-relaxed">{opt}</span>
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
  const shortRule =
    item.q.explanation.rules[0] ??
    item.q.explanation.pt.slice(0, 120) +
      (item.q.explanation.pt.length > 120 ? "…" : "");
  const err =
    item.selected != null && !item.correct
      ? item.q.distractorErrors[item.selected]
      : null;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-100">
          Revisão comentada {safe + 1}/{total} — Item {item.q.id} ·{" "}
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
        <p>
          <span className="text-zinc-500">Regra: </span>
          <span className="text-zinc-300">{shortRule}</span>
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
                {item.q.explanation.rules.map((r) => (
                  <li
                    key={r}
                    className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="w-full max-w-2xl space-y-3">
            <p className="text-base text-zinc-100">{item.q.stem}</p>
            {item.q.premises?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                {item.q.premises.map((p) => (
                  <li key={p}>{p}</li>
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
              {item.q.explanation.rules.map((r) => (
                <li
                  key={r}
                  className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400"
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
