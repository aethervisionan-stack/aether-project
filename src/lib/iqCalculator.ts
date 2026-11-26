import type {
  AnswerRecord,
  CompetenceScores,
  IqResult,
  MatrixQuestion,
  RuleCategory,
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

const CATEGORY_KEYS: RuleCategory[] = [
  "spatial",
  "boolean",
  "pattern",
  "numerical",
];

function emptyCompetences(): CompetenceScores {
  return { spatial: 0, boolean: 0, pattern: 0, numerical: 0 };
}

/**
 * Map weighted accuracy to Wechsler-like IQ (mean 100, SD 15).
 * Progressive items are harder; missing late items hurts less than missing early ones
 * via the weight table, while a logistic transform avoids cliff effects at the tails.
 */
export function estimateIq(accuracy: number, difficultyBonus: number): number {
  // Expected accuracy for IQ 100 ~ 0.55 on this battery; genius ~ 0.92+
  const centered = accuracy - 0.55 + difficultyBonus * 0.04;
  const z = centered / 0.18;
  const iq = 100 + 15 * z;
  return Math.round(Math.min(160, Math.max(70, iq)));
}

export function calculateIqResult(
  questions: MatrixQuestion[],
  selected: (number | null)[],
  timeSpentMs: number[],
): IqResult {
  const answers: AnswerRecord[] = questions.map((q, i) => {
    const selectedIndex = selected[i] ?? null;
    return {
      questionId: q.id,
      selectedIndex,
      correct: selectedIndex === q.correctIndex,
      timeMs: timeSpentMs[i] ?? 0,
    };
  });

  let rawScore = 0;
  let maxScore = 0;
  const catCorrect = emptyCompetences();
  const catTotal = emptyCompetences();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    maxScore += q.weight;
    if (answers[i].correct) rawScore += q.weight;

    for (const cat of q.categories) {
      catTotal[cat] += q.weight;
      if (answers[i].correct) catCorrect[cat] += q.weight;
    }
  }

  const accuracy = maxScore > 0 ? rawScore / maxScore : 0;
  const hardHits = questions.filter(
    (q, i) => q.difficulty >= 8 && answers[i].correct,
  ).length;
  const difficultyBonus = hardHits / 8;
  const iq = estimateIq(accuracy, difficultyBonus);
  const percentile = Math.round(normalCdf((iq - 100) / 15) * 1000) / 10;

  const competences = emptyCompetences();
  for (const key of CATEGORY_KEYS) {
    competences[key] =
      catTotal[key] > 0
        ? Math.round((catCorrect[key] / catTotal[key]) * 100)
        : 0;
  }

  const answeredTimes = timeSpentMs.filter((t) => t > 0);
  const avgTimeMs =
    answeredTimes.length > 0
      ? Math.round(
          answeredTimes.reduce((a, b) => a + b, 0) / answeredTimes.length,
        )
      : 0;

  return {
    rawScore,
    maxScore,
    accuracy,
    iq,
    percentile,
    band: iqBand(iq),
    competences,
    avgTimeMs,
    answers,
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
      return "Progressão Numérica";
  }
}
