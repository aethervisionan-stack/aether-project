"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getMatrixQuestions,
  getTutorialExample,
} from "@/src/lib/matrixGenerator";
import {
  calculateIqResult,
  competenceLabel,
  distractorErrorLabel,
} from "@/src/lib/iqCalculator";
import {
  clearQuizState,
  createInitialState,
  loadQuizState,
  saveQuizState,
} from "@/src/lib/quizStorage";
import {
  QUIZ_DURATION_MS,
  QUIZ_TOTAL_QUESTIONS,
  bandProgressLabel,
  type CompetenceScores,
  type QuizPersistedState,
} from "@/src/types/quiz";
import { BellCurveChart } from "@/src/components/BellCurveChart";
import { MatrixRenderer, OptionGrid } from "@/src/components/MatrixRenderer";

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

export function IqTestApp() {
  const questions = useMemo(() => getMatrixQuestions(), []);
  const tutorial = useMemo(() => getTutorialExample(), []);
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<QuizPersistedState>(createInitialState);
  const [tutorialPick, setTutorialPick] = useState<number | null>(null);
  const [tutorialOk, setTutorialOk] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    const saved = loadQuizState();
    if (saved) setState(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveQuizState(state);
  }, [state, hydrated]);

  const finishTest = useCallback(
    (prev: QuizPersistedState): QuizPersistedState => {
      if (prev.phase === "results" || prev.phase === "review") return prev;
      const timeSpent = [...prev.timeSpentMs];
      if (
        prev.questionStartedAt &&
        prev.currentIndex >= 0 &&
        prev.currentIndex < QUIZ_TOTAL_QUESTIONS
      ) {
        timeSpent[prev.currentIndex] += Date.now() - prev.questionStartedAt;
      }
      const switches = prev.optionSwitches ?? Array(QUIZ_TOTAL_QUESTIONS).fill(0);
      const result = calculateIqResult(
        questions,
        prev.answers,
        timeSpent,
        switches,
      );
      return {
        ...prev,
        phase: "results",
        timeSpentMs: timeSpent,
        questionStartedAt: null,
        finishedAt: Date.now(),
        result,
      };
    },
    [questions],
  );

  const onExpire = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== "test") return prev;
      return finishTest(prev);
    });
  }, [finishTest]);

  const remaining = useCountdown(
    state.phase === "test" ? state.endsAt : null,
    onExpire,
  );

  const progress =
    state.answers.filter((a) => a !== null).length / QUIZ_TOTAL_QUESTIONS;

  const startOfficial = () => {
    const now = Date.now();
    setState({
      ...createInitialState(),
      phase: "test",
      startedAt: now,
      endsAt: now + QUIZ_DURATION_MS,
      questionStartedAt: now,
    });
  };

  const selectAnswer = (optionIndex: number) => {
    setState((prev) => {
      if (prev.phase !== "test") return prev;
      const answers = [...prev.answers];
      const switches = [...(prev.optionSwitches ?? Array(QUIZ_TOTAL_QUESTIONS).fill(0))];
      const prevSel = answers[prev.currentIndex];
      if (prevSel !== null && prevSel !== optionIndex) {
        switches[prev.currentIndex] += 1;
      } else if (prevSel === null) {
        // first pick — not a switch
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
      if (prev.currentIndex >= QUIZ_TOTAL_QUESTIONS - 1) {
        return finishTest(prev);
      }
      const timeSpent = [...prev.timeSpentMs];
      if (prev.questionStartedAt) {
        timeSpent[prev.currentIndex] += Date.now() - prev.questionStartedAt;
      }
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
        if (map[e.key] >= (q?.options.length ?? 0)) return;
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

  const resetAll = () => {
    clearQuizState();
    setTutorialPick(null);
    setTutorialOk(false);
    setReviewIndex(0);
    setState(createInitialState());
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
    <div className="iq-shell relative mx-auto min-h-screen max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -right-16 top-40 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {state.phase === "onboarding" && (
          <motion.section
            key="onboarding"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-8"
          >
            <header className="space-y-3 pt-4 text-center sm:pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400/90">
                Avaliação psicométrica
              </p>
              <h1 className="font-iq-display text-4xl tracking-tight text-zinc-50 sm:text-5xl">
                Teste de QI Profissional
              </h1>
              <p className="mx-auto max-w-xl text-base text-zinc-400 sm:text-lg">
                Matrizes progressivas — 30 itens em 5 níveis de complexidade,
                teto alto (QI ~155+), distratores diagnósticos e índice de
                confiabilidade da sessão.
              </p>
            </header>

            <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:grid-cols-3 sm:p-6">
              {[
                {
                  t: "Visual",
                  d: "Sem texto nas questões. Padrões SVG com regras combinadas nos níveis altos.",
                },
                {
                  t: "30 minutos",
                  d: "Cronômetro global. Telemetria de tempo e hesitação por item.",
                },
                {
                  t: "Teclado",
                  d: "A–H / 1–8 para escolher; Enter / → avançar; ← voltar.",
                },
              ].map((item) => (
                <div key={item.t} className="space-y-1.5">
                  <h2 className="text-sm font-semibold text-zinc-200">
                    {item.t}
                  </h2>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    {item.d}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Mini-exemplo (sem cronômetro)
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Complete a matriz. A regra é só visual.
                  </p>
                </div>
                {tutorialOk ? (
                  <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                    Correto — pode iniciar
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
                <MatrixRenderer cells={tutorial.cells} size={280} />
                <div className="w-full max-w-md space-y-3">
                  <OptionGrid
                    options={tutorial.options}
                    selectedIndex={tutorialPick}
                    cellSize={72}
                    onSelect={(i) => {
                      setTutorialPick(i);
                      setTutorialOk(i === tutorial.correctIndex);
                    }}
                    revealedCorrect={
                      tutorialPick !== null ? tutorial.correctIndex : null
                    }
                  />
                  <p className="text-center text-xs text-zinc-500">
                    {tutorial.explanation}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 pb-8">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={!tutorialOk}
                onClick={startOfficial}
                className="rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-zinc-950 transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Iniciar Avaliação Oficial
              </motion.button>
              <p className="text-xs text-zinc-600">
                Progresso versionado (v2) neste navegador — sessões antigas não
                interferem.
              </p>
            </div>
          </motion.section>
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
                    <span className="text-zinc-600">
                      /{QUIZ_TOTAL_QUESTIONS}
                    </span>
                  </span>
                  <span className="text-xs text-zinc-400">{bandLabel}</span>
                </div>
                <div
                  className={`font-mono text-lg tabular-nums ${
                    remaining < 60_000 ? "text-red-400" : "text-zinc-200"
                  }`}
                  aria-live="polite"
                >
                  {formatTime(remaining)}
                </div>
                <button
                  type="button"
                  onClick={() => setState((p) => finishTest(p))}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                >
                  Finalizar agora
                </button>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                  initial={false}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </header>

            <div className="flex flex-wrap justify-center gap-1.5 py-1">
              {questions.map((_, i) => {
                const answered = state.answers[i] !== null;
                const current = i === state.currentIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`h-2.5 w-2.5 rounded-full transition ${
                      current
                        ? "bg-emerald-400 ring-2 ring-emerald-400/30"
                        : answered
                          ? "bg-indigo-400/80"
                          : "bg-zinc-700"
                    }`}
                    aria-label={`Ir para questão ${i + 1}`}
                  />
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center gap-6"
              >
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
                {state.currentIndex === QUIZ_TOTAL_QUESTIONS - 1
                  ? "Ver resultados"
                  : "Próxima →"}
              </button>
            </div>
          </motion.section>
        )}

        {(state.phase === "results" || state.phase === "review") &&
          state.result && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-4"
            >
              <header className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Resultado estimado
                </p>
                <motion.h1
                  className="font-iq-display text-6xl text-zinc-50 tabular-nums sm:text-7xl"
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 160, damping: 14 }}
                >
                  {state.result.iq}
                  <span className="ml-2 text-2xl font-normal text-zinc-500 sm:text-3xl">
                    (±{state.result.marginOfError})
                  </span>
                </motion.h1>
                <p className="text-emerald-400">{state.result.band}</p>
                <p className="text-sm text-zinc-500">
                  Percentil {state.result.percentile} · IC≈{" "}
                  {state.result.iqLow}–{state.result.iqHigh} · acertos
                  ponderados {state.result.rawScore.toFixed(1)}/
                  {state.result.maxScore.toFixed(1)}
                </p>
              </header>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
                <BellCurveChart
                  iq={state.result.iq}
                  percentile={state.result.percentile}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  Object.keys(
                    state.result.competences,
                  ) as (keyof CompetenceScores)[]
                ).map((key) => {
                  const value = state.result!.competences[key];
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-zinc-300">
                          {competenceLabel(key)}
                        </span>
                        <span className="tabular-nums text-zinc-400">
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

              {/* Precision Diagnosis */}
              <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Diagnóstico de Precisão
                  </h2>
                  <p className="text-sm tabular-nums text-zinc-400">
                    Precisão {state.result.diagnosis.precisionScore}/100 ·
                    Confiabilidade{" "}
                    {state.result.diagnosis.reliabilityIndex}/100
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-5">
                  {state.result.diagnosis.bandTelemetry.map((bt) => (
                    <div
                      key={bt.band}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                        N{bt.band}
                      </p>
                      <p className="text-xs text-zinc-300">{bt.label}</p>
                      <p className="mt-1 text-sm tabular-nums text-zinc-200">
                        {bt.answered
                          ? `${Math.round(bt.accuracy * 100)}%`
                          : "—"}
                      </p>
                      <p className="text-[11px] tabular-nums text-zinc-500">
                        {bt.avgTimeMs
                          ? `${(bt.avgTimeMs / 1000).toFixed(1)}s méd.`
                          : "sem tempo"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                  <span>
                    Acurácia N4–5:{" "}
                    <span className="tabular-nums text-zinc-200">
                      {Math.round(state.result.diagnosis.hardAccuracy * 100)}%
                    </span>
                  </span>
                  <span>
                    Tempo médio:{" "}
                    <span className="tabular-nums text-zinc-200">
                      {(state.result.avgTimeMs / 1000).toFixed(1)}s
                    </span>
                  </span>
                  <span>
                    Hesitação (trocas):{" "}
                    <span className="tabular-nums text-zinc-200">
                      {state.result.diagnosis.avgOptionSwitches}
                    </span>
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {state.result.diagnosis.warnings.map((w) => (
                    <li
                      key={w}
                      className={`text-sm leading-relaxed ${
                        state.result!.diagnosis.guessingFlag ||
                        state.result!.diagnosis.incompleteFlag ||
                        state.result!.diagnosis.inconsistentFlag
                          ? "text-amber-300/90"
                          : "text-emerald-400/80"
                      }`}
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReviewIndex(0);
                    setState((p) => ({ ...p, phase: "review" }));
                  }}
                  className="rounded-xl border border-zinc-600 px-5 py-2.5 text-sm text-zinc-200 hover:border-zinc-400"
                >
                  Revisar erros
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
                >
                  Nova avaliação
                </button>
              </div>

              {state.phase === "review" && (
                <ReviewPanel
                  questions={questions}
                  answers={state.answers}
                  index={reviewIndex}
                  setIndex={setReviewIndex}
                  onBack={() => setState((p) => ({ ...p, phase: "results" }))}
                />
              )}
            </motion.section>
          )}
      </AnimatePresence>
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
  questions: ReturnType<typeof getMatrixQuestions>;
  answers: (number | null)[];
  index: number;
  setIndex: (n: number) => void;
  onBack: () => void;
}) {
  const wrong = questions
    .map((q, i) => ({ q, i, selected: answers[i] }))
    .filter((x) => x.selected !== x.q.correctIndex);

  if (wrong.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center text-sm text-emerald-300">
        Nenhuma resposta incorreta — excelente.
        <div className="mt-3">
          <button
            type="button"
            onClick={onBack}
            className="text-zinc-400 underline-offset-2 hover:underline"
          >
            Voltar ao resumo
          </button>
        </div>
      </div>
    );
  }

  const safe = ((index % wrong.length) + wrong.length) % wrong.length;
  const item = wrong[safe];
  const err =
    item.selected != null
      ? item.q.distractorErrors[item.selected]
      : null;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-100">
          Revisão {safe + 1}/{wrong.length} — Questão {item.q.id} ·{" "}
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
      <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center">
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
              Erro diagnóstico: {distractorErrorLabel(err)}
            </p>
          ) : item.selected == null ? (
            <p className="text-xs text-zinc-500">Sem resposta</p>
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
      </div>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setIndex(safe - 1)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => setIndex(safe + 1)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
