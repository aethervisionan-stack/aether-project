import type {
  AnswerRecord,
  AnyDistractorError,
  AssessmentMode,
  BandTelemetry,
  CompetenceScores,
  DifficultyBand,
  DistractorError,
  IqResult,
  PrecisionDiagnosis,
  QuestionSkill,
  QuizItem,
  RuleCategory,
  TextDistractorError,
} from "@/src/types/quiz";
import {
  BAND_META,
  competenceKeysForMode,
  isMatrixItem,
} from "@/src/types/quiz";

/** Standard normal CDF via Abramowitz & Stegun approximation */
export function normalCdf(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

/** Inverse normal approx (Beasley-Springer/Moro) for percentile → z */
export function normalInv(p: number): number {
  const clamped = Math.min(0.9999, Math.max(0.0001, p));
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577459334126e2, -3.066479806614436e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (clamped < plow) {
    q = Math.sqrt(-2 * Math.log(clamped));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (clamped > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - clamped));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  q = clamped - 0.5;
  r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

export function pdfNormal(x: number, mean = 100, sd = 15): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

export function iqBand(iq: number): string {
  if (iq < 70) return "Muito abaixo da média";
  if (iq < 85) return "Abaixo da média";
  if (iq < 100) return "Média-baixa";
  if (iq < 115) return "Média";
  if (iq < 130) return "Acima da média";
  if (iq < 145) return "Superior (faixa Mensa candidata)";
  return "Muito superior / faixa gênio";
}

function emptyCompetences(): CompetenceScores {
  return {
    spatial: 0,
    boolean: 0,
    pattern: 0,
    numerical: 0,
    logical: 0,
    numeric: 0,
    verbal: 0,
    analytical: 0,
  };
}

function itemSkillKeys(item: QuizItem): (keyof CompetenceScores)[] {
  if (isMatrixItem(item)) return item.categories;
  return item.skills;
}

/** 2PL-ish P(correct | θ) */
function pCorrect(theta: number, a: number, b: number): number {
  const z = a * (theta - b);
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * MAP estimate of latent ability θ (mean 0, prior N(0,1)).
 * Discrimination a derived from item weight; difficulty from irtB.
 */
export function estimateTheta(
  questions: QuizItem[],
  correct: boolean[],
): { theta: number; se: number; information: number } {
  let theta = 0;
  for (let iter = 0; iter < 40; iter++) {
    let num = 0;
    let den = 0;
    for (let i = 0; i < questions.length; i++) {
      if (correct[i] === undefined) continue;
      const q = questions[i];
      const a = 0.55 + q.weight * 0.22;
      const b = q.irtB;
      const p = pCorrect(theta, a, b);
      const w = a * a * p * (1 - p);
      den += w;
      num += a * ((correct[i] ? 1 : 0) - p);
    }
    // Prior N(0,1)
    num -= theta;
    den += 1;
    if (den < 1e-6) break;
    const delta = num / den;
    theta += delta;
    if (Math.abs(delta) < 1e-4) break;
  }
  theta = Math.max(-3.2, Math.min(3.5, theta));

  let information = 1; // prior
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = 0.55 + q.weight * 0.22;
    const p = pCorrect(theta, a, q.irtB);
    information += a * a * p * (1 - p);
  }
  const se = 1 / Math.sqrt(Math.max(information, 0.25));
  return { theta, se, information };
}

/** Map θ → IQ; exceptional L5 performance unlocks ceiling toward 155+ */
export function thetaToIq(
  theta: number,
  hardHits: number,
  hardTotal: number,
): number {
  let iq = 100 + 15 * theta;
  if (hardTotal > 0) {
    const hardRate = hardHits / hardTotal;
    if (hardRate >= 0.75 && theta > 1.8) {
      iq += (hardRate - 0.75) * 20;
    } else if (hardRate < 0.25 && iq > 130) {
      iq = 130 + (iq - 130) * 0.4;
    }
  }
  return Math.round(Math.min(160, Math.max(68, iq)));
}

function expectedTimeMs(band: DifficultyBand, kind: QuizItem["kind"]): number {
  const base = (() => {
    switch (band) {
      case 1:
        return 18_000;
      case 2:
        return 28_000;
      case 3:
        return 40_000;
      case 4:
        return 55_000;
      case 5:
        return 70_000;
    }
  })();
  // Text items typically need a bit more reading time
  return kind === "text" ? Math.round(base * 1.15) : base;
}

function buildDiagnosis(
  questions: QuizItem[],
  answers: AnswerRecord[],
  optionSwitches: number[],
): PrecisionDiagnosis {
  const bands: DifficultyBand[] = [1, 2, 3, 4, 5];
  const bandTelemetry: BandTelemetry[] = bands.map((band) => {
    const idxs = questions
      .map((q, i) => ({ q, i }))
      .filter((x) => x.q.difficulty === band);
    const answered = idxs.filter((x) => answers[x.i].selectedIndex !== null);
    const correct = answered.filter((x) => answers[x.i].correct);
    const times = answered.map((x) => answers[x.i].timeMs).filter((t) => t > 0);
    const avgTimeMs =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;
    return {
      band,
      label: BAND_META[band].label,
      avgTimeMs,
      accuracy: answered.length ? correct.length / answered.length : 0,
      answered: answered.length,
      total: idxs.length,
    };
  });

  const hardIdx = questions
    .map((q, i) => ({ q, i }))
    .filter((x) => x.q.difficulty >= 4);
  const hardAnswered = hardIdx.filter(
    (x) => answers[x.i].selectedIndex !== null,
  );
  const hardCorrect = hardAnswered.filter((x) => answers[x.i].correct);
  const hardAccuracy = hardAnswered.length
    ? hardCorrect.length / hardAnswered.length
    : 0;

  let guessCount = 0;
  for (const { q, i } of hardIdx) {
    const t = answers[i].timeMs;
    const selected = answers[i].selectedIndex !== null;
    if (selected && t > 0 && t < expectedTimeMs(q.difficulty, q.kind) * 0.28) {
      guessCount += 1;
    }
  }
  const guessingFlag = guessCount >= 2;

  const unanswered = answers.filter((a) => a.selectedIndex === null).length;
  const incompleteFlag = unanswered >= 5;

  let inconsistencyHits = 0;
  for (const band of [2, 3, 4] as DifficultyBand[]) {
    const bt = bandTelemetry.find((b) => b.band === band)!;
    if (bt.answered < 4) continue;
    const idxs = questions
      .map((q, i) => i)
      .filter((i) => questions[i].difficulty === band);
    const outcomes = idxs
      .filter((i) => answers[i].selectedIndex !== null)
      .map((i) => (answers[i].correct ? 1 : 0));
    const mean =
      outcomes.reduce<number>((a, b) => a + b, 0) /
      Math.max(outcomes.length, 1);
    const var_ =
      outcomes.reduce<number>((a, b) => a + (b - mean) ** 2, 0) /
      Math.max(outcomes.length, 1);
    if (var_ > 0.22 && mean > 0.25 && mean < 0.75) inconsistencyHits += 1;
  }
  const inconsistentFlag = inconsistencyHits >= 2;

  const switchSum = optionSwitches.reduce((a, b) => a + b, 0);
  const answeredCount = answers.filter((a) => a.selectedIndex !== null).length;
  const avgOptionSwitches =
    answeredCount > 0 ? switchSum / answeredCount : 0;

  let reliabilityIndex = 100;
  if (guessingFlag) reliabilityIndex -= 18 + guessCount * 4;
  if (incompleteFlag) reliabilityIndex -= 10 + unanswered * 2;
  if (inconsistentFlag) reliabilityIndex -= 14;
  if (avgOptionSwitches > 2.5) reliabilityIndex -= 8;
  reliabilityIndex = Math.max(20, Math.min(100, Math.round(reliabilityIndex)));

  let consistencyIndex = 100 - inconsistencyHits * 18;
  if (guessingFlag) consistencyIndex -= 12;
  consistencyIndex = Math.max(25, Math.min(100, Math.round(consistencyIndex)));

  const precisionScore = Math.round(
    reliabilityIndex * 0.55 + consistencyIndex * 0.45,
  );

  const warnings: string[] = [];
  if (guessingFlag) {
    warnings.push(
      `Possível chute: ${guessCount} itens de alta complexidade respondidos muito rápido.`,
    );
  }
  if (incompleteFlag) {
    warnings.push(
      `Sessão incompleta: ${unanswered} itens sem resposta (abort precoce reduz precisão).`,
    );
  }
  if (inconsistentFlag) {
    warnings.push(
      "Desempenho inconsistente dentro do mesmo nível de dificuldade.",
    );
  }
  if (avgOptionSwitches > 2.8) {
    warnings.push(
      "Alta hesitação (muitas trocas de opção) — índice de confiança reduzido.",
    );
  }
  if (warnings.length === 0) {
    warnings.push("Padrão de resposta coerente com esforço deliberado.");
  }

  return {
    precisionScore,
    reliabilityIndex,
    consistencyIndex,
    guessingFlag,
    incompleteFlag,
    inconsistentFlag,
    warnings,
    bandTelemetry,
    hardAccuracy,
    avgOptionSwitches: Math.round(avgOptionSwitches * 100) / 100,
  };
}

export function calculateIqResult(
  questions: QuizItem[],
  selected: (number | null)[],
  timeSpentMs: number[],
  optionSwitches: number[] = [],
  mode: AssessmentMode = "figures",
): IqResult {
  const answers: AnswerRecord[] = questions.map((q, i) => {
    const selectedIndex = selected[i] ?? null;
    const correct = selectedIndex === q.correctIndex;
    let distractorError: AnyDistractorError | null = null;
    if (
      selectedIndex !== null &&
      !correct &&
      q.distractorErrors?.[selectedIndex]
    ) {
      distractorError = q.distractorErrors[selectedIndex];
    }
    return {
      questionId: q.id,
      selectedIndex,
      correct,
      timeMs: timeSpentMs[i] ?? 0,
      optionSwitches: optionSwitches[i] ?? 0,
      distractorError,
    };
  });

  let rawScore = 0;
  let maxScore = 0;
  const catCorrect = emptyCompetences();
  const catTotal = emptyCompetences();
  const correctFlags = answers.map((a) => a.correct);
  const seenSkills = new Set<keyof CompetenceScores>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    maxScore += q.weight;
    if (answers[i].correct) rawScore += q.weight;
    for (const cat of itemSkillKeys(q)) {
      seenSkills.add(cat);
      catTotal[cat] += q.weight;
      if (answers[i].correct) catCorrect[cat] += q.weight;
    }
  }

  const accuracy = maxScore > 0 ? rawScore / maxScore : 0;
  const { theta, se } = estimateTheta(questions, correctFlags);

  let hardHits2 = 0;
  let hardTotal = 0;
  for (let i = 0; i < questions.length; i++) {
    if (questions[i].difficulty >= 4) {
      hardTotal += 1;
      if (answers[i].correct) hardHits2 += 1;
    }
  }

  const iq = thetaToIq(theta, hardHits2, hardTotal);
  const diagnosis = buildDiagnosis(
    questions,
    answers,
    optionSwitches.length ? optionSwitches : answers.map((a) => a.optionSwitches),
  );
  const reliabilityFactor =
    0.65 + (diagnosis.reliabilityIndex / 100) * 0.55;
  const marginOfError = Math.max(
    3,
    Math.min(12, Math.round(15 * se * (2 - reliabilityFactor))),
  );
  const iqLow = Math.max(68, iq - marginOfError);
  const iqHigh = Math.min(160, iq + marginOfError);
  const percentile = Math.round(normalCdf((iq - 100) / 15) * 1000) / 10;

  const competences = emptyCompetences();
  for (const key of Object.keys(competences) as (keyof CompetenceScores)[]) {
    competences[key] =
      catTotal[key] > 0
        ? Math.round((catCorrect[key] / catTotal[key]) * 100)
        : 0;
  }

  const modeKeys = competenceKeysForMode(mode);
  const activeCompetences = modeKeys.filter((k) => seenSkills.has(k));

  const answeredTimes = timeSpentMs.filter((t) => t > 0);
  const avgTimeMs =
    answeredTimes.length > 0
      ? Math.round(
          answeredTimes.reduce((a, b) => a + b, 0) / answeredTimes.length,
        )
      : 0;

  return {
    mode,
    rawScore,
    maxScore,
    accuracy,
    iq,
    marginOfError,
    iqLow,
    iqHigh,
    percentile,
    band: iqBand(iq),
    competences,
    activeCompetences,
    avgTimeMs,
    answers,
    diagnosis,
  };
}

export function competenceLabel(key: keyof CompetenceScores): string {
  switch (key) {
    case "spatial":
      return "Rotação Espacial";
    case "boolean":
      return "Lógica Booleana";
    case "pattern":
      return "Reconhecimento de Padrões";
    case "numerical":
      return "Progressão Numérica (figuras)";
    case "logical":
      return "Lógica Dedutiva";
    case "numeric":
      return "Sequências Numéricas";
    case "verbal":
      return "Relações Verbais / Semânticas";
    case "analytical":
      return "Resolução Analítica";
  }
}

export function distractorErrorLabel(err: AnyDistractorError): string {
  const figure: Record<DistractorError, string> = {
    incomplete_rotation: "Rotação incompleta",
    horizontal_only: "Só regra horizontal",
    vertical_only: "Só regra vertical",
    polarity_flip: "Inversão de polaridade",
    wrong_count: "Contagem incorreta",
    shape_swap: "Troca de forma",
    fill_only: "Só preenchimento",
    or_instead_of_xor: "OR no lugar de XOR",
    and_instead_of_xor: "AND no lugar de XOR",
    missing_rule: "Regra omitida",
    extra_element: "Elemento extra",
    mirror_instead_of_rotate: "Espelho em vez de rotação",
    wrong_scale: "Escala incorreta",
    partial_union: "União parcial",
  };
  const text: Record<TextDistractorError, string> = {
    premise_ignore: "Ignorou premissa",
    scope_error: "Erro de escopo",
    wrong_operation: "Operação / inferência errada",
    near_miss: "Quase certo (erro fino)",
    semantic_swap: "Troca semântica",
    quantifier_error: "Erro de quantificador",
    order_error: "Erro de ordem",
    incomplete_chain: "Cadeia incompleta",
    false_analogy: "Analogia falsa",
    arithmetic_slip: "Deslize aritmético",
  };
  if (err in figure) return figure[err as DistractorError];
  if (err in text) return text[err as TextDistractorError];
  return err;
}

export type { RuleCategory, QuestionSkill };
