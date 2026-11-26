import type {
  AnswerRecord,
  AnomalyHit,
  AnomalyReport,
  AnyDistractorError,
  AssessmentMode,
  BandTelemetry,
  CognitiveIndexId,
  CognitiveProfile,
  CompetenceScores,
  DifficultyBand,
  DistractorError,
  IndexScore,
  IqResult,
  PrecisionDiagnosis,
  QuestionSkill,
  QuizItem,
  RuleCategory,
  SubtestId,
  SubtestScore,
  TextDistractorError,
  TimeMetrics,
} from "@/src/types/quiz";
import {
  BAND_META,
  competenceKeysForMode,
  isMatrixItem,
} from "@/src/types/quiz";
import {
  INDEX_META,
  INDEX_ORDER,
  scoreDescriptor,
} from "@/src/lib/chcCatalog";

/** Standard normal CDF via Abramowitz & Stegun approximation */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return 0.5;
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
  if (!Number.isFinite(x) || sd <= 0) return 0;
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

export function iqBand(iq: number): string {
  if (iq < 70) return "Muito abaixo da média";
  if (iq < 85) return "Abaixo da média";
  if (iq < 100) return "Média-baixa";
  if (iq < 115) return "Média";
  if (iq < 130) return "Acima da média";
  if (iq < 145) return "Superior";
  return "Muito superior";
}

/** Plain-language percentile / rarity for Brazilian Portuguese UI */
export function percentilePlainLanguage(percentile: number): {
  summary: string;
  rarity: string;
} {
  const p = Math.max(0, Math.min(100, percentile));
  const above = Math.round((100 - p) * 10) / 10;
  const below = Math.round(p * 10) / 10;
  if (p >= 98) {
    return {
      summary: `Seu resultado ficou acima de cerca de ${below}% das pessoas nesta escala.`,
      rarity: "Faixa muito rara na população de referência.",
    };
  }
  if (p >= 90) {
    return {
      summary: `Seu resultado ficou acima de cerca de ${below}% das pessoas nesta escala.`,
      rarity: "Faixa incomum (cerca de 1 em 10 ou mais rara).",
    };
  }
  if (p >= 75) {
    return {
      summary: `Seu resultado ficou acima de cerca de ${below}% das pessoas nesta escala.`,
      rarity: "Acima da média, mas ainda relativamente comum.",
    };
  }
  if (p >= 25) {
    return {
      summary: `Seu resultado ficou próximo ao centro da distribuição (cerca de ${below}% abaixo e ${above}% acima).`,
      rarity: "Faixa típica da população de referência.",
    };
  }
  if (p >= 10) {
    return {
      summary: `Seu resultado ficou abaixo de cerca de ${above}% das pessoas nesta escala.`,
      rarity: "Abaixo da média, mas ainda relativamente comum.",
    };
  }
  return {
    summary: `Seu resultado ficou abaixo de cerca de ${above}% das pessoas nesta escala.`,
    rarity: "Faixa menos comum na população de referência.",
  };
}

export type ConsistencyTone = "coherent" | "caution" | "inconsistent";

/** Session consistency for results UI (coherent vs rushed/inconsistent) */
export function sessionConsistencyLabel(diagnosis: PrecisionDiagnosis): {
  tone: ConsistencyTone;
  title: string;
  detail: string;
  /** Short PT-BR meaning of the 0–100 score */
  meaning: string;
  /** Impulse / guessing caution when pattern looks rushed */
  impulseWarning: string | null;
} {
  const impulseWarning = diagnosis.guessingFlag
    ? "Atenção: respostas muito rápidas em itens difíceis sugerem chute ou impulso — interprete o QI com cautela."
    : null;

  // Hard flags only — avoid labeling normal mid-ability variance as inconsistent.
  if (
    diagnosis.guessingFlag ||
    diagnosis.inconsistentFlag ||
    diagnosis.incompleteFlag
  ) {
    const parts: string[] = [];
    if (diagnosis.guessingFlag)
      parts.push("respostas muito rápidas em itens difíceis (chute/impulso)");
    if (diagnosis.inconsistentFlag)
      parts.push("desempenho irregular no mesmo nível");
    if (diagnosis.incompleteFlag) parts.push("vários itens sem resposta");
    return {
      tone: "inconsistent",
      title: "Sessão apressada ou inconsistente",
      meaning: "Baixa consistência — o padrão de resposta é instável.",
      detail: `O padrão sugere ${parts.join("; ")}. O QI estimado tem margem maior de incerteza.`,
      impulseWarning,
    };
  }
  if (
    diagnosis.consistencyScore < 68 ||
    diagnosis.reliabilityIndex < 68 ||
    diagnosis.avgOptionSwitches > 3.2
  ) {
    return {
      tone: "caution",
      title: "Sessão com algumas ressalvas",
      meaning: "Consistência moderada — há sinais leves de hesitação ou variação.",
      detail:
        "O resultado é útil, mas interprete com a margem de erro indicada.",
      impulseWarning,
    };
  }
  return {
    tone: "coherent",
    title: "Sessão coerente",
    meaning: "Alta consistência — ritmo e padrão compatíveis com esforço deliberado.",
    detail: "A estimativa de QI é mais estável nesta sessão.",
    impulseWarning,
  };
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

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** IRT item params: discrimination a, difficulty b, guessing c = 1/numOptions */
export interface IrtItemParams {
  a: number;
  b: number;
  c: number;
  numOptions: number;
}

export function itemIrtParams(q: QuizItem): IrtItemParams {
  const numOptions = Math.max(2, q.options?.length ?? 4);
  const c = 1 / numOptions;
  // Weight ~1–5 → discrimination ~0.7–2.4 (3PL-friendly)
  const a = clamp(0.45 + q.weight * 0.38, 0.55, 2.6);
  const b = finiteOr(q.irtB, 0);
  return { a, b, c, numOptions };
}

/**
 * 3PL P(correct | θ) = c + (1−c) · σ(a(θ−b))
 * Chance floor = 1/numOptions.
 */
export function pCorrect3pl(
  theta: number,
  a: number,
  b: number,
  c: number,
): number {
  const z = a * (theta - b);
  let logistic: number;
  if (z > 20) logistic = 1;
  else if (z < -20) logistic = 0;
  else logistic = 1 / (1 + Math.exp(-z));
  const p = c + (1 - c) * logistic;
  return clamp(finiteOr(p, c), 0, 1);
}

/** @deprecated prefer pCorrect3pl — kept for audit compatibility */
export function pCorrect(theta: number, a: number, b: number): number {
  return pCorrect3pl(theta, a, b, 0);
}

/**
 * MAP estimate of latent ability θ (prior N(0,1)) under 3PL.
 * Unanswered (null/undefined in correct[]) are treated as incorrect
 * for timed forms; pass only answered when omitting is desired.
 */
export function estimateTheta(
  questions: QuizItem[],
  correct: (boolean | null | undefined)[],
): { theta: number; se: number; information: number } {
  let theta = 0;

  for (let iter = 0; iter < 50; iter++) {
    let score = 0; // first derivative of log-posterior
    let info = 1; // prior precision + Fisher information

    for (let i = 0; i < questions.length; i++) {
      const flag = correct[i];
      if (flag === undefined) continue;
      const u = flag === null ? 0 : flag ? 1 : 0;
      const { a, b, c } = itemIrtParams(questions[i]);
      const p = pCorrect3pl(theta, a, b, c);
      const q = 1 - p;
      if (p <= 1e-9 || q <= 1e-9) continue;

      // 3PL derivative w.r.t. θ: ∂P/∂θ = a(P−c)/(1−c) * (wait) = a * (p-c) * (1 - (p-c)/(1-c))?
      // P = c + (1-c)L → ∂P/∂θ = (1-c) * a * L * (1-L) = a(P-c)(1-P)/(1-c)
      const dPdTheta = (a * (p - c) * q) / Math.max(1 - c, 1e-9);
      score += ((u - p) / Math.max(p * q, 1e-12)) * dPdTheta;
      // Approximate information (Birnbaum / 3PL)
      const w =
        (dPdTheta * dPdTheta) / Math.max(p * q, 1e-12);
      info += w;
    }

    // Prior N(0,1): score -= θ, info += 1 (already in info init)
    score -= theta;

    if (!Number.isFinite(score) || !Number.isFinite(info) || info < 1e-6) break;
    const delta = score / info;
    theta += delta;
    if (Math.abs(delta) < 1e-4) break;
  }

  theta = clamp(finiteOr(theta, 0), -3.2, 3.5);

  let information = 1;
  for (let i = 0; i < questions.length; i++) {
    const flag = correct[i];
    if (flag === undefined) continue;
    const { a, b, c } = itemIrtParams(questions[i]);
    const p = pCorrect3pl(theta, a, b, c);
    const q = 1 - p;
    const dPdTheta = (a * (p - c) * q) / Math.max(1 - c, 1e-9);
    information += (dPdTheta * dPdTheta) / Math.max(p * q, 1e-12);
  }
  information = Math.max(finiteOr(information, 1), 0.25);
  const se = 1 / Math.sqrt(information);
  return {
    theta: finiteOr(theta, 0),
    se: finiteOr(se, 1),
    information,
  };
}

/**
 * Map θ → IQ (mean 100, SD 15) with calibrated high-ceiling for strong L4–L5.
 * Soft ceiling toward 160; floor 68.
 */
export function thetaToIq(
  theta: number,
  hardHits: number,
  hardTotal: number,
): number {
  const t = clamp(finiteOr(theta, 0), -3.2, 3.5);
  let iq = 100 + 15 * t;
  if (hardTotal > 0) {
    const hardRate = hardHits / hardTotal;
    if (hardRate >= 0.75 && t > 1.8) {
      // Unlock upper tail toward ~155–160 for exceptional hard performance
      iq += (hardRate - 0.75) * 22;
    } else if (hardRate < 0.25 && iq > 130) {
      iq = 130 + (iq - 130) * 0.4;
    }
  }
  return Math.round(clamp(finiteOr(iq, 100), 68, 160));
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
  return kind === "text" ? Math.round(base * 1.15) : base;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid];
}

export interface CalculateIqOptions {
  /** Timer hit zero before all items answered */
  timedOut?: boolean;
}

function buildDiagnosis(
  questions: QuizItem[],
  answers: AnswerRecord[],
  optionSwitches: number[],
  options: CalculateIqOptions = {},
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
    // Stricter than before (0.22× vs 0.28×) to cut false “chute” on fast but deliberate solvers
    if (selected && t > 0 && t < expectedTimeMs(q.difficulty, q.kind) * 0.22) {
      guessCount += 1;
    }
  }
  const guessingFlag = guessCount >= 3;

  const unanswered = answers.filter((a) => a.selectedIndex === null).length;
  const answeredInTime = answers.length - unanswered;
  const timedOut = Boolean(options.timedOut);
  const incompleteFlag = unanswered >= 5 || (timedOut && unanswered > 0);

  /**
   * Within-band Bernoulli variance peaks at ~0.25 when accuracy≈50%.
   * Old threshold 0.22 flagged almost every mid-ability session (false positives).
   * Require larger samples + extreme mix before counting a hit.
   */
  let inconsistencyHits = 0;
  for (const band of [2, 3, 4] as DifficultyBand[]) {
    const bt = bandTelemetry.find((b) => b.band === band)!;
    if (bt.answered < 5) continue;
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
    if (var_ > 0.3 && mean > 0.2 && mean < 0.8) inconsistencyHits += 1;
  }

  // Erratic pattern: miss easy while hitting hard — need clearer contrast
  const easyIdx = questions
    .map((q, i) => ({ q, i }))
    .filter((x) => x.q.difficulty <= 2);
  const easyAnswered = easyIdx.filter(
    (x) => answers[x.i].selectedIndex !== null,
  );
  const easyMisses = easyAnswered.filter((x) => !answers[x.i].correct).length;
  const hardHits = hardCorrect.length;
  const erraticEasyHard =
    easyAnswered.length >= 5 &&
    hardAnswered.length >= 4 &&
    easyMisses / easyAnswered.length >= 0.5 &&
    hardHits / hardAnswered.length >= 0.55;

  // Need stronger evidence: 3 noisy bands OR clear easy/hard inversion
  const inconsistentFlag = inconsistencyHits >= 3 || erraticEasyHard;

  const switchSum = optionSwitches.reduce((a, b) => a + b, 0);
  const answeredCount = answers.filter((a) => a.selectedIndex !== null).length;
  const avgOptionSwitches =
    answeredCount > 0 ? switchSum / answeredCount : 0;

  let reliabilityIndex = 100;
  if (guessingFlag) reliabilityIndex -= 16 + guessCount * 3;
  if (incompleteFlag) reliabilityIndex -= 10 + unanswered * 2;
  if (inconsistentFlag) reliabilityIndex -= 12;
  if (avgOptionSwitches > 3.2) reliabilityIndex -= 6;
  reliabilityIndex = clamp(Math.round(reliabilityIndex), 20, 100);

  /**
   * consistencyScore 0–100:
   * penalize clear erratic easy-miss/hard-hit, extreme within-band variance,
   * and ultra-fast hard guesses — milder than before to avoid FP on average sessions.
   */
  let consistencyScore = 100;
  consistencyScore -= inconsistencyHits * 8;
  if (erraticEasyHard) consistencyScore -= 18;
  if (guessingFlag) consistencyScore -= 12 + Math.min(18, (guessCount - 2) * 4);
  else if (guessCount > 0) consistencyScore -= Math.min(8, guessCount * 2);
  if (avgOptionSwitches > 3.5) consistencyScore -= 6;
  if (incompleteFlag) consistencyScore -= Math.min(18, unanswered * 2);
  consistencyScore = clamp(Math.round(finiteOr(consistencyScore, 50)), 0, 100);

  const consistencyIndex = consistencyScore;

  const precisionScore = Math.round(
    reliabilityIndex * 0.55 + consistencyScore * 0.45,
  );

  const warnings: string[] = [];
  if (timedOut) {
    warnings.push(
      `Tempo esgotado: você respondeu ${answeredInTime} de ${answers.length} questões a tempo.`,
    );
  }
  if (guessingFlag) {
    warnings.push(
      `Possível chute: ${guessCount} itens de alta complexidade respondidos muito rápido.`,
    );
  }
  if (incompleteFlag && !timedOut) {
    warnings.push(
      `Sessão incompleta: ${unanswered} itens sem resposta (abort precoce reduz precisão).`,
    );
  } else if (incompleteFlag && timedOut && unanswered > 0) {
    warnings.push(
      `${unanswered} item(ns) sem resposta após o cronômetro — tratados como incorretos na estimativa.`,
    );
  }
  if (erraticEasyHard) {
    warnings.push(
      "Padrão errático: erros em itens fáceis com acertos em itens difíceis.",
    );
  } else if (inconsistentFlag) {
    warnings.push(
      "Desempenho inconsistente dentro do mesmo nível de dificuldade.",
    );
  }
  if (avgOptionSwitches > 3.5) {
    warnings.push(
      "Alta hesitação (muitas trocas de opção) — índice de confiança reduzido.",
    );
  }
  if (warnings.length === 0) {
    warnings.push("Padrão de resposta coerente com esforço deliberado.");
  }

  return {
    precisionScore: clamp(Math.round(finiteOr(precisionScore, 50)), 0, 100),
    reliabilityIndex,
    consistencyIndex,
    consistencyScore,
    guessingFlag,
    incompleteFlag,
    inconsistentFlag,
    warnings,
    bandTelemetry,
    hardAccuracy: finiteOr(hardAccuracy, 0),
    avgOptionSwitches: Math.round(avgOptionSwitches * 100) / 100,
    answeredInTime,
    timedOut,
  };
}

function buildIndexAndSubtestScores(
  questions: QuizItem[],
  answers: AnswerRecord[],
  globalIq: number,
): { indexScores: IndexScore[]; subtestScores: SubtestScore[] } {
  const indexAcc = new Map<
    CognitiveIndexId,
    { correctW: number; totalW: number; answered: number; total: number; timeSum: number; timeN: number }
  >();
  const subAcc = new Map<
    SubtestId,
    { correctW: number; totalW: number; answered: number; total: number; index: CognitiveIndexId }
  >();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = answers[i];
    const idx = q.index;
    const sub = q.subtest;
    if (!indexAcc.has(idx)) {
      indexAcc.set(idx, {
        correctW: 0,
        totalW: 0,
        answered: 0,
        total: 0,
        timeSum: 0,
        timeN: 0,
      });
    }
    if (!subAcc.has(sub)) {
      subAcc.set(sub, {
        correctW: 0,
        totalW: 0,
        answered: 0,
        total: 0,
        index: idx,
      });
    }
    const ib = indexAcc.get(idx)!;
    const sb = subAcc.get(sub)!;
    ib.total += 1;
    sb.total += 1;
    ib.totalW += q.weight;
    sb.totalW += q.weight;
    if (a.selectedIndex !== null) {
      ib.answered += 1;
      sb.answered += 1;
      if (a.timeMs > 0) {
        ib.timeSum += a.timeMs;
        ib.timeN += 1;
      }
    }
    if (a.correct) {
      ib.correctW += q.weight;
      sb.correctW += q.weight;
    }
  }

  const indexScores: IndexScore[] = INDEX_ORDER.filter((id) => indexAcc.has(id)).map(
    (id) => {
      const b = indexAcc.get(id)!;
      const score =
        b.totalW > 0
          ? clamp(Math.round((b.correctW / b.totalW) * 100), 0, 100)
          : 0;
      // Map 0–100 accuracy toward session IQ with gentle regression to 100
      const iqApprox = clamp(
        Math.round(100 + (score - 50) * 0.7 + (globalIq - 100) * 0.25),
        68,
        160,
      );
      return {
        id,
        score: finiteOr(score, 0),
        iqApprox: finiteOr(iqApprox, 100),
        descriptor: scoreDescriptor(score),
        answered: b.answered,
        total: b.total,
        avgTimeMs:
          b.timeN > 0 ? Math.round(b.timeSum / b.timeN) : 0,
      };
    },
  );

  const subtestScores: SubtestScore[] = [...subAcc.entries()]
    .map(([id, b]) => {
      const score =
        b.totalW > 0
          ? clamp(Math.round((b.correctW / b.totalW) * 100), 0, 100)
          : 0;
      return {
        id,
        index: b.index,
        score: finiteOr(score, 0),
        descriptor: scoreDescriptor(score),
        answered: b.answered,
        total: b.total,
      };
    })
    .sort((a, b) => a.index.localeCompare(b.index) || a.id.localeCompare(b.id));

  return { indexScores, subtestScores };
}

function buildAnomalies(
  questions: QuizItem[],
  answers: AnswerRecord[],
  diagnosis: PrecisionDiagnosis,
): AnomalyReport {
  const hits: AnomalyHit[] = [];

  if (diagnosis.guessingFlag) {
    hits.push({
      kind: "chute_rapido",
      label: "Chute / impulso em itens difíceis",
      detail:
        "Vários itens de alta complexidade foram respondidos muito abaixo do tempo típico da banda.",
      marginImpact: 2,
    });
  }
  if (diagnosis.inconsistentFlag) {
    hits.push({
      kind: "padrao_erratico",
      label: "Padrão errático",
      detail:
        "Erros em faixas fáceis com acertos em difíceis, ou alta variância no mesmo nível.",
      marginImpact: 2,
    });
  }
  if (diagnosis.incompleteFlag) {
    hits.push({
      kind: "incompleto",
      label: "Sessão incompleta",
      detail: "Itens sem resposta reduzem a informação de Fisher e alargam a margem.",
      marginImpact: 2,
    });
  }
  if (diagnosis.avgOptionSwitches > 3.5) {
    hits.push({
      kind: "hesitacao_alta",
      label: "Hesitação elevada",
      detail: "Muitas trocas de opção por item sugerem incerteza ou exploração aleatória.",
      marginImpact: 1,
    });
  }

  // Systematic distractor cluster — raise bar to cut noise on short sessions
  const errCounts = new Map<string, number>();
  for (const a of answers) {
    if (a.distractorError) {
      errCounts.set(
        a.distractorError,
        (errCounts.get(a.distractorError) ?? 0) + 1,
      );
    }
  }
  let topErr: string | null = null;
  let topN = 0;
  for (const [k, v] of errCounts) {
    if (v > topN) {
      topN = v;
      topErr = k;
    }
  }
  if (topErr && topN >= 5) {
    hits.push({
      kind: "distrator_sistematico",
      label: "Distrator sistemático",
      detail: `O mesmo tipo de erro lógico (“${distractorErrorLabel(topErr as AnyDistractorError)}”) repetiu-se ${topN} vezes.`,
      marginImpact: 1,
    });
  }

  // Latency anomalies on RT / speed indices
  let latencyHits = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = answers[i];
    if (a.selectedIndex === null || a.timeMs <= 0) continue;
    if (
      q.index !== "tempo_reacao" &&
      q.index !== "velocidade_processamento"
    ) {
      continue;
    }
    const exp = expectedTimeMs(q.difficulty, q.kind);
    if (a.correct && a.timeMs > exp * 2.4) latencyHits += 1;
    if (!a.correct && a.timeMs < exp * 0.2) latencyHits += 1;
  }
  if (latencyHits >= 4) {
    hits.push({
      kind: "latencia_anomala",
      label: "Latência anômala",
      detail:
        "Em itens de velocidade/reação, houve acertos excessivamente lentos ou erros ultrarrápidos.",
      marginImpact: 1,
    });
  }

  // Exact coherence: count === hits.length; each hit carries detail for UI + Gemini
  const totalImpact = hits.reduce((s, h) => s + h.marginImpact, 0);
  return {
    count: hits.length,
    totalImpact,
    hits,
  };
}

function buildCognitiveProfile(indexScores: IndexScore[]): CognitiveProfile {
  const active = indexScores.filter((s) => s.total > 0);
  if (active.length === 0) {
    return {
      shape: "equilibrado",
      label: "Perfil indeterminado",
      detail: "Sem índices ativos nesta sessão.",
      spread: 0,
      strengths: [],
      improvements: [],
    };
  }
  const scores = active.map((s) => s.score);
  const spread = Math.max(...scores) - Math.min(...scores);
  const shape = spread >= 28 ? "assimetrico" : "equilibrado";
  const sorted = [...active].sort((a, b) => b.score - a.score);
  const strengthN = sorted.length <= 2 ? 1 : Math.min(2, sorted.length);
  const improveN = sorted.length <= 2 ? 1 : Math.min(2, sorted.length - strengthN);
  const strengths = sorted.slice(0, strengthN).map((s) => ({
    id: s.id,
    score: s.score,
    label: INDEX_META[s.id].label,
  }));
  const improvements = [...sorted]
    .reverse()
    .slice(0, improveN)
    .filter((s) => !strengths.some((x) => x.id === s.id))
    .map((s) => ({
      id: s.id,
      score: s.score,
      label: INDEX_META[s.id].label,
    }));

  return {
    shape,
    label:
      shape === "equilibrado"
        ? "Perfil equilibrado"
        : "Perfil assimétrico",
    detail:
      shape === "equilibrado"
        ? `Os índices ativos variam pouco entre si (amplitude ${spread} pontos) — desempenho relativamente homogêneo nesta sessão.`
        : `Há contraste claro entre índices (amplitude ${spread} pontos). Use forças e pontos de melhoria abaixo para interpretar o perfil, não só o QI global.`,
    spread: finiteOr(spread, 0),
    strengths,
    improvements,
  };
}

export function calculateIqResult(
  questions: QuizItem[],
  selected: (number | null)[],
  timeSpentMs: number[],
  optionSwitches: number[] = [],
  mode: AssessmentMode = "figures",
  calcOptions: CalculateIqOptions = {},
): IqResult {
  const n = questions.length;
  const answers: AnswerRecord[] = questions.map((q, i) => {
    const selectedIndex = selected[i] ?? null;
    const correct =
      selectedIndex !== null && selectedIndex === q.correctIndex;
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
      timeMs: Math.max(0, finiteOr(timeSpentMs[i] ?? 0, 0)),
      optionSwitches: Math.max(0, optionSwitches[i] ?? 0),
      distractorError,
    };
  });

  let rawScore = 0;
  let maxScore = 0;
  const catCorrect = emptyCompetences();
  const catTotal = emptyCompetences();
  const seenSkills = new Set<keyof CompetenceScores>();

  // Timed forms: treat unanswered as incorrect (conservative)
  const correctFlags: (boolean | null)[] = answers.map((a) =>
    a.selectedIndex === null ? false : a.correct,
  );

  for (let i = 0; i < n; i++) {
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
  for (let i = 0; i < n; i++) {
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
    calcOptions,
  );

  const { indexScores, subtestScores } = buildIndexAndSubtestScores(
    questions,
    answers,
    iq,
  );
  const anomalies = buildAnomalies(questions, answers, diagnosis);
  const cognitiveProfile = buildCognitiveProfile(indexScores);

  const reliabilityFactor =
    0.65 + (diagnosis.reliabilityIndex / 100) * 0.55;
  const consistencyFactor =
    0.75 + (diagnosis.consistencyScore / 100) * 0.35;
  // Wider margin when SE high, consistency low, or anomalies present
  const anomalyWiden = 1 + Math.min(0.35, anomalies.totalImpact * 0.06);
  const confidenceMargin = clamp(
    Math.round(
      15 *
        se *
        (2 - reliabilityFactor) *
        (1.35 - consistencyFactor * 0.35) *
        anomalyWiden,
    ),
    3,
    14,
  );
  const marginOfError = confidenceMargin;
  const iqLow = clamp(iq - marginOfError, 68, 160);
  const iqHigh = clamp(iq + marginOfError, 68, 160);
  const percentile =
    Math.round(normalCdf((iq - 100) / 15) * 1000) / 10;

  const competences = emptyCompetences();
  for (const key of Object.keys(competences) as (keyof CompetenceScores)[]) {
    competences[key] =
      catTotal[key] > 0
        ? Math.round((catCorrect[key] / catTotal[key]) * 100)
        : 0;
  }

  const modeKeys = competenceKeysForMode(mode);
  const activeCompetences = modeKeys.filter((k) => seenSkills.has(k));

  const answeredTimes = timeSpentMs.filter((t) => t > 0 && Number.isFinite(t));
  const answeredCount = answers.filter((a) => a.selectedIndex !== null).length;
  const unansweredCount = n - answeredCount;
  const totalMs = Math.round(
    timeSpentMs.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0),
  );
  const avgTimeMs =
    answeredTimes.length > 0
      ? Math.round(
          answeredTimes.reduce((a, b) => a + b, 0) / answeredTimes.length,
        )
      : 0;
  const timeMetrics: TimeMetrics = {
    totalMs,
    avgMs: avgTimeMs,
    medianMs: median(answeredTimes),
    answeredCount,
    unansweredCount,
  };

  return {
    mode,
    rawScore: finiteOr(rawScore, 0),
    maxScore: finiteOr(maxScore, 0),
    accuracy: clamp(finiteOr(accuracy, 0), 0, 1),
    iq,
    theta: Math.round(theta * 1000) / 1000,
    marginOfError,
    confidenceMargin,
    consistencyScore: diagnosis.consistencyScore,
    iqLow,
    iqHigh,
    percentile: clamp(finiteOr(percentile, 50), 0, 100),
    band: iqBand(iq),
    competences,
    activeCompetences,
    indexScores,
    subtestScores,
    anomalies,
    cognitiveProfile,
    avgTimeMs,
    timeMetrics,
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

/** Find next unanswered index at or after `from`, wrapping once. */
export function findNextUnanswered(
  answers: (number | null)[],
  from = 0,
): number {
  if (answers.length === 0) return -1;
  const start = clamp(from, 0, answers.length - 1);
  for (let i = 0; i < answers.length; i++) {
    const idx = (start + i) % answers.length;
    if (answers[idx] === null) return idx;
  }
  return -1;
}

export type { RuleCategory, QuestionSkill };
