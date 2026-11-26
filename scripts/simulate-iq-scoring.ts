/**
 * Automated IRT scoring + finish-flow simulations.
 * Run: npx tsx scripts/simulate-iq-scoring.ts
 *
 * Scenarios: low, average, high consistent, guessing/inconsistent,
 * timeout mid-test, figures + questions modes. Asserts finite in-range
 * IQ / percentile / consistency and navigation helpers.
 */
import { getAssessmentItems } from "../src/lib/assessmentBank";
import {
  calculateIqResult,
  estimateTheta,
  findNextUnanswered,
  itemIrtParams,
  pCorrect3pl,
  thetaToIq,
} from "../src/lib/iqCalculator";
import type {
  AssessmentMode,
  IqResult,
  QuizItem,
} from "../src/types/quiz";
import { QUIZ_TOTAL_QUESTIONS } from "../src/types/quiz";

type ScenarioName =
  | "low"
  | "average"
  | "high_consistent"
  | "guessing_inconsistent"
  | "timeout_mid"
  | "figures_mode"
  | "questions_mode";

interface ScenarioResult {
  name: ScenarioName;
  mode: AssessmentMode;
  ok: boolean;
  detail: string;
  iq?: number;
  consistencyScore?: number;
  answeredInTime?: number;
}

const failures: string[] = [];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    failures.push(msg);
    throw new Error(msg);
  }
}

function softAssert(cond: unknown, msg: string): boolean {
  if (!cond) {
    failures.push(msg);
    return false;
  }
  return true;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function assertValidResult(result: IqResult, label: string): void {
  assert(isFiniteNumber(result.iq), `${label}: iq NaN/Inf`);
  assert(result.iq >= 68 && result.iq <= 160, `${label}: iq out of range ${result.iq}`);
  assert(isFiniteNumber(result.percentile), `${label}: percentile NaN`);
  assert(
    result.percentile >= 0 && result.percentile <= 100,
    `${label}: percentile ${result.percentile}`,
  );
  assert(isFiniteNumber(result.confidenceMargin), `${label}: confidenceMargin`);
  assert(
    result.confidenceMargin >= 3 && result.confidenceMargin <= 14,
    `${label}: confidenceMargin ${result.confidenceMargin}`,
  );
  assert(
    result.marginOfError === result.confidenceMargin,
    `${label}: marginOfError !== confidenceMargin`,
  );
  assert(isFiniteNumber(result.consistencyScore), `${label}: consistencyScore`);
  assert(
    result.consistencyScore >= 0 && result.consistencyScore <= 100,
    `${label}: consistencyScore ${result.consistencyScore}`,
  );
  assert(
    result.diagnosis.consistencyScore === result.consistencyScore,
    `${label}: diagnosis.consistencyScore mismatch`,
  );
  assert(isFiniteNumber(result.theta), `${label}: theta`);
  assert(isFiniteNumber(result.iqLow) && isFiniteNumber(result.iqHigh), `${label}: iq band`);
  assert(result.iqLow <= result.iq && result.iq <= result.iqHigh, `${label}: iqLow/High`);
  assert(isFiniteNumber(result.timeMetrics.avgMs), `${label}: timeMetrics.avgMs`);
  assert(isFiniteNumber(result.timeMetrics.medianMs), `${label}: timeMetrics.medianMs`);
  assert(isFiniteNumber(result.timeMetrics.totalMs), `${label}: timeMetrics.totalMs`);
  assert(
    result.timeMetrics.answeredCount + result.timeMetrics.unansweredCount ===
      result.answers.length,
    `${label}: answered+unanswered !== n`,
  );
  for (const key of Object.keys(result.competences) as (keyof typeof result.competences)[]) {
    const v = result.competences[key];
    assert(isFiniteNumber(v) && v >= 0 && v <= 100, `${label}: competence ${key}=${v}`);
  }
  for (const bt of result.diagnosis.bandTelemetry) {
    assert(isFiniteNumber(bt.accuracy), `${label}: band ${bt.band} accuracy`);
    assert(bt.accuracy >= 0 && bt.accuracy <= 1, `${label}: band accuracy range`);
  }
}

function deliberateTime(q: QuizItem): number {
  const base =
    q.difficulty === 1
      ? 16_000
      : q.difficulty === 2
        ? 24_000
        : q.difficulty === 3
          ? 36_000
          : q.difficulty === 4
            ? 50_000
            : 65_000;
  return q.kind === "text" ? Math.round(base * 1.1) : base;
}

/** Probabilistic correct given latent ability (uses item 3PL). */
function simulateResponse(
  q: QuizItem,
  theta: number,
  rng: () => number,
): { selected: number; timeMs: number; switches: number } {
  const { a, b, c } = itemIrtParams(q);
  const p = pCorrect3pl(theta, a, b, c);
  const correct = rng() < p;
  let selected: number;
  if (correct) {
    selected = q.correctIndex;
  } else {
    const wrongs = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
    selected = wrongs[Math.floor(rng() * wrongs.length)] ?? (q.correctIndex + 1) % q.options.length;
  }
  const timeMs = Math.round(deliberateTime(q) * (0.85 + rng() * 0.35));
  const switches = rng() < 0.15 ? 1 : 0;
  return { selected, timeMs, switches };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function runAbilityScenario(
  name: ScenarioName,
  mode: AssessmentMode,
  theta: number,
  seed: number,
  expect: {
    iqMax?: number;
    iqMin?: number;
    consistencyMin?: number;
    consistencyMax?: number;
    guessing?: boolean;
  },
): ScenarioResult {
  const items = getAssessmentItems(mode);
  const rng = mulberry32(seed);
  const selected: (number | null)[] = [];
  const times: number[] = [];
  const switches: number[] = [];

  for (const q of items) {
    const r = simulateResponse(q, theta, rng);
    selected.push(r.selected);
    times.push(r.timeMs);
    switches.push(r.switches);
  }

  const result = calculateIqResult(items, selected, times, switches, mode);
  assertValidResult(result, name);

  let ok = true;
  if (expect.iqMax != null) ok = softAssert(result.iq <= expect.iqMax, `${name}: iq ${result.iq} > ${expect.iqMax}`) && ok;
  if (expect.iqMin != null) ok = softAssert(result.iq >= expect.iqMin, `${name}: iq ${result.iq} < ${expect.iqMin}`) && ok;
  if (expect.consistencyMin != null)
    ok =
      softAssert(
        result.consistencyScore >= expect.consistencyMin,
        `${name}: consistency ${result.consistencyScore} < ${expect.consistencyMin}`,
      ) && ok;
  if (expect.consistencyMax != null)
    ok =
      softAssert(
        result.consistencyScore <= expect.consistencyMax,
        `${name}: consistency ${result.consistencyScore} > ${expect.consistencyMax}`,
      ) && ok;
  if (expect.guessing != null)
    ok =
      softAssert(
        result.diagnosis.guessingFlag === expect.guessing,
        `${name}: guessingFlag=${result.diagnosis.guessingFlag}`,
      ) && ok;

  return {
    name,
    mode,
    ok,
    detail: `iq=${result.iq} θ=${result.theta} cons=${result.consistencyScore} p=${result.percentile}`,
    iq: result.iq,
    consistencyScore: result.consistencyScore,
    answeredInTime: result.diagnosis.answeredInTime,
  };
}

function runGuessingInconsistent(mode: AssessmentMode): ScenarioResult {
  const name: ScenarioName = "guessing_inconsistent";
  const items = getAssessmentItems(mode);
  const selected: (number | null)[] = [];
  const times: number[] = [];
  const switches: number[] = [];

  for (const q of items) {
    // Miss easy, hit hard (erratic) + ultra-fast on hard
    if (q.difficulty <= 2) {
      selected.push((q.correctIndex + 1) % q.options.length);
      times.push(22_000);
    } else if (q.difficulty >= 4) {
      selected.push(q.correctIndex);
      times.push(4_000); // ultra-fast complex
    } else {
      // Mid: random-ish flips
      selected.push(
        items.indexOf(q) % 2 === 0
          ? q.correctIndex
          : (q.correctIndex + 1) % q.options.length,
      );
      times.push(18_000);
    }
    switches.push(3);
  }

  const result = calculateIqResult(items, selected, times, switches, mode);
  assertValidResult(result, name);

  const ok =
    softAssert(result.diagnosis.guessingFlag, `${name}: expected guessingFlag`) &&
    softAssert(
      result.consistencyScore < 75,
      `${name}: expected low consistency, got ${result.consistencyScore}`,
    ) &&
    softAssert(
      result.diagnosis.inconsistentFlag || result.diagnosis.guessingFlag,
      `${name}: expected inconsistent or guessing`,
    );

  return {
    name,
    mode,
    ok,
    detail: `iq=${result.iq} cons=${result.consistencyScore} guess=${result.diagnosis.guessingFlag}`,
    iq: result.iq,
    consistencyScore: result.consistencyScore,
    answeredInTime: result.diagnosis.answeredInTime,
  };
}

function runTimeoutMid(mode: AssessmentMode): ScenarioResult {
  const name: ScenarioName = "timeout_mid";
  const items = getAssessmentItems(mode);
  const answeredN = 12;
  const selected: (number | null)[] = items.map((q, i) =>
    i < answeredN ? q.correctIndex : null,
  );
  const times = items.map((_, i) => (i < answeredN ? 20_000 : 0));
  const switches = items.map(() => 0);

  const result = calculateIqResult(items, selected, times, switches, mode, {
    timedOut: true,
  });
  assertValidResult(result, name);

  const ok =
    softAssert(result.diagnosis.timedOut, `${name}: timedOut`) &&
    softAssert(
      result.diagnosis.answeredInTime === answeredN,
      `${name}: answeredInTime=${result.diagnosis.answeredInTime} expected ${answeredN}`,
    ) &&
    softAssert(
      result.timeMetrics.unansweredCount === items.length - answeredN,
      `${name}: unansweredCount`,
    ) &&
    softAssert(
      result.diagnosis.warnings.some((w) => /Tempo esgotado/.test(w)),
      `${name}: missing timeout warning`,
    ) &&
    softAssert(
      result.diagnosis.warnings.some((w) => w.includes(String(answeredN))),
      `${name}: warning should report answered count`,
    );

  return {
    name,
    mode,
    ok,
    detail: `answered=${result.diagnosis.answeredInTime}/${items.length} iq=${result.iq}`,
    iq: result.iq,
    consistencyScore: result.consistencyScore,
    answeredInTime: result.diagnosis.answeredInTime,
  };
}

function testNavHelpers(): void {
  const answers: (number | null)[] = [0, null, 2, null, 1];
  assert(findNextUnanswered(answers, 0) === 1, "nav from 0 → 1");
  assert(findNextUnanswered(answers, 1) === 1, "nav from 1 → 1");
  assert(findNextUnanswered(answers, 2) === 3, "nav from 2 → 3");
  assert(findNextUnanswered(answers, 4) === 1, "nav wrap → 1");
  assert(findNextUnanswered([0, 1, 2], 0) === -1, "all answered → -1");
  assert(findNextUnanswered([], 0) === -1, "empty → -1");
}

function testIrtSanity(): void {
  const figs = getAssessmentItems("figures");
  assert(figs.length === QUIZ_TOTAL_QUESTIONS, "figures size");

  for (const q of figs) {
    const p = itemIrtParams(q);
    assert(p.numOptions === q.options.length, `opts ${q.id}`);
    assert(Math.abs(p.c - 1 / q.options.length) < 1e-12, `chance ${q.id}`);
    assert(p.a >= 0.55 && p.a <= 2.6, `a ${q.id}`);
    const mid = pCorrect3pl(0, p.a, p.b, p.c);
    assert(mid >= p.c && mid <= 1, `P mid ${q.id}`);
    assert(isFiniteNumber(mid), `P finite ${q.id}`);
  }

  const allRight = figs.map(() => true as boolean | null);
  const { theta, se } = estimateTheta(figs, allRight);
  assert(theta > 1, `all-correct theta=${theta}`);
  assert(se > 0 && Number.isFinite(se), `se=${se}`);

  assert(thetaToIq(5, 6, 6) <= 160, "ceiling");
  assert(thetaToIq(-5, 0, 6) >= 68, "floor");

  // Extreme: all wrong still finite
  const allWrong = figs.map((q) => (q.correctIndex + 1) % q.options.length);
  const lo = calculateIqResult(
    figs,
    allWrong,
    Array(figs.length).fill(25_000),
    Array(figs.length).fill(0),
    "figures",
  );
  assertValidResult(lo, "all_wrong");
  assert(lo.iq <= 95, `all_wrong iq=${lo.iq}`);

  const hi = calculateIqResult(
    figs,
    figs.map((q) => q.correctIndex),
    Array(figs.length).fill(30_000),
    Array(figs.length).fill(0),
    "figures",
  );
  assertValidResult(hi, "all_correct");
  assert(hi.iq >= 130, `all_correct iq=${hi.iq}`);
  assert(hi.iq > lo.iq, "monotonic hi>lo");
}

/** Simulate mandatory-finish state machine (no early abort). */
function testFinishFlowState(): void {
  const items = getAssessmentItems("hybrid");
  const n = items.length;
  let currentIndex = n - 1;
  const answers: (number | null)[] = items.map((q, i) =>
    i === 5 || i === 12 ? null : q.correctIndex,
  );

  // Trying to finish with blanks → jump to next unanswered, do not finish
  const blank = findNextUnanswered(answers, 0);
  assert(blank === 5, `expected blank at 5, got ${blank}`);
  currentIndex = blank;
  assert(currentIndex !== -1, "should not finish");

  answers[5] = items[5].correctIndex;
  const nextBlank = findNextUnanswered(answers, currentIndex);
  assert(nextBlank === 12, `next blank 12, got ${nextBlank}`);
  currentIndex = nextBlank;
  answers[12] = items[12].correctIndex;

  const done = findNextUnanswered(answers, 0);
  assert(done === -1, "all answered → may finish");
  currentIndex = n - 1;

  const result = calculateIqResult(
    items,
    answers,
    Array(n).fill(22_000),
    Array(n).fill(0),
    "hybrid",
  );
  assertValidResult(result, "finish_flow_complete");
  assert(result.diagnosis.answeredInTime === n, "all answered in time");
  assert(!result.diagnosis.timedOut, "not timed out");
  void currentIndex;
}

function main(): void {
  const scenarios: ScenarioResult[] = [];

  try {
    testIrtSanity();
    testNavHelpers();
    testFinishFlowState();

    scenarios.push(
      runAbilityScenario("low", "figures", -1.4, 42, {
        iqMax: 95,
        consistencyMin: 55,
      }),
    );
    scenarios.push(
      runAbilityScenario("average", "hybrid", 0.05, 7, {
        iqMin: 90,
        iqMax: 115,
        consistencyMin: 60,
      }),
    );
    scenarios.push(
      runAbilityScenario("high_consistent", "questions", 2.0, 99, {
        iqMin: 120,
        consistencyMin: 70,
      }),
    );
    scenarios.push(runGuessingInconsistent("figures"));
    scenarios.push(runTimeoutMid("questions"));
    scenarios.push(
      runAbilityScenario("figures_mode", "figures", 0.4, 11, {
        iqMin: 95,
        iqMax: 125,
      }),
    );
    scenarios.push(
      runAbilityScenario("questions_mode", "questions", 0.4, 11, {
        iqMin: 95,
        iqMax: 125,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!failures.includes(msg)) failures.push(msg);
  }

  const failedScenarios = scenarios.filter((s) => !s.ok);
  const ok = failures.length === 0 && failedScenarios.length === 0;

  console.log(
    JSON.stringify(
      {
        ok,
        failureCount: failures.length,
        failures,
        scenarios,
      },
      null,
      2,
    ),
  );

  if (!ok) process.exitCode = 1;
}

main();
