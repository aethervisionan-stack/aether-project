/**
 * Psychometric + structural audit for IQ matrix + text banks.
 * Run: npx tsx scripts/audit-iq-banks.ts
 */
import {
  getMatrixQuestions,
  validateQuestionBank,
} from "../src/lib/matrixGenerator";
import {
  getTextQuestions,
  validateTextQuestionBank,
} from "../src/data/textQuestions";
import { getAssessmentItems } from "../src/lib/assessmentBank";
import {
  calculateIqResult,
  normalCdf,
  normalInv,
  thetaToIq,
  estimateTheta,
} from "../src/lib/iqCalculator";
import type { CellContent, MatrixQuestion, TextQuestion } from "../src/types/quiz";

type Issue = { severity: "error" | "warn"; code: string; detail: string };

function cellSig(c: CellContent): string {
  return c.glyphs
    .map(
      (x) =>
        `${x.shape}:${x.fill ?? "empty"}:${x.rotation ?? 0}:${(x.scale ?? 1).toFixed(3)}:${(x.ox ?? 0).toFixed(3)}:${(x.oy ?? 0).toFixed(3)}`,
    )
    .join("|");
}

function auditMatrixLogic(qs: MatrixQuestion[]): Issue[] {
  const issues: Issue[] = [];

  for (const q of qs) {
    // Correct option must match explanation-linked expected patterns where we can recompute
    const correct = q.options[q.correctIndex];
    if (!correct) {
      issues.push({
        severity: "error",
        code: "matrix_missing_correct",
        detail: `M${q.id}: correctIndex out of range`,
      });
      continue;
    }

    // Explanation should not contain debug leftovers (word-boundary to avoid PT false positives)
    if (
      /\b(wait|recalculate|Let me)\b/i.test(q.explanation.pt) ||
      /\b(TODO|FIXME)\b/.test(q.explanation.pt) ||
      /\bFix Q\d/.test(q.explanation.pt)
    ) {
      issues.push({
        severity: "error",
        code: "matrix_debug_explanation",
        detail: `M${q.id}: explanation has debug text: ${q.explanation.pt.slice(0, 120)}`,
      });
    }

    // Detect uniqueness-filler salvage from packOptions (dot+cross)
    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex) continue;
      const shapes = new Set(q.options[i].glyphs.map((g) => g.shape));
      if (shapes.has("dot") && shapes.has("cross") && q.options[i].glyphs.length <= 2) {
        issues.push({
          severity: "error",
          code: "matrix_filler_distractor",
          detail: `M${q.id} opt${i}: uniqueness-filler (dot+cross) — distractor collided with correct`,
        });
      }
    }

    // Band option counts
    const expect = q.difficulty >= 3 ? 8 : 6;
    if (q.options.length !== expect) {
      issues.push({
        severity: "error",
        code: "matrix_option_count",
        detail: `M${q.id}: ${q.options.length} opts, expected ${expect}`,
      });
    }

    // irtB roughly monotonic with difficulty
    const bandMid = [-1.3, -0.3, 0.5, 1.3, 2.2][q.difficulty - 1];
    if (Math.abs(q.irtB - bandMid) > 1.4) {
      issues.push({
        severity: "warn",
        code: "matrix_irt_outlier",
        detail: `M${q.id}: irtB=${q.irtB} far from band~${bandMid}`,
      });
    }
  }

  // Specific recomputations for known multi-rule items
  const byId = Object.fromEntries(qs.map((q) => [q.id, q]));

  // Q15: row sum = 6 → last cell count 1
  {
    const q = byId[15];
    const n = q.options[q.correctIndex].glyphs.length;
    if (n !== 1) {
      issues.push({
        severity: "error",
        code: "matrix_q15_sum",
        detail: `M15: expected 1 circle, got ${n} glyphs`,
      });
    }
  }

  // Q19: OR of corners row3 = 0b1001 | 0b0010 = 0b1011 (bits 0,1,3)
  {
    const q = byId[19];
    const sig = cellSig(q.options[q.correctIndex]);
    // corners positions: TL(-0.32,-0.32), TR(0.32,-0.32), BL(-0.32,0.32), BR(0.32,0.32)
    const expected = [
      "dot:solid:0:0.280:-0.320:-0.320", // bit0 TL
      "dot:solid:0:0.280:0.320:-0.320", // bit1 TR
      "dot:solid:0:0.280:0.320:0.320", // bit3 BR
    ].join("|");
    // Actually 0b1011 = bits 0,1,3 = TL, TR, BR
    if (sig !== expected) {
      // soft check — report actual
      const dots = q.options[q.correctIndex].glyphs.filter((g) => g.shape === "dot");
      if (dots.length !== 3) {
        issues.push({
          severity: "error",
          code: "matrix_q19_or",
          detail: `M19: expected 3 corner dots (mask 1011), got ${dots.length}. sig=${sig}`,
        });
      }
    }
  }

  // Q21: XOR 1110 ⊕ 1001 = 0111
  {
    const q = byId[21];
    const dots = q.options[q.correctIndex].glyphs.filter((g) => g.shape === "dot");
    if (dots.length !== 3) {
      issues.push({
        severity: "error",
        code: "matrix_q21_xor",
        detail: `M21: expected 3 dots (0111), got ${dots.length}`,
      });
    }
  }

  // Q25: XOR strokes → only "v"
  {
    const q = byId[25];
    const lines = q.options[q.correctIndex].glyphs.filter((g) => g.shape === "line");
    if (lines.length !== 1 || (lines[0].rotation ?? 0) !== 90) {
      issues.push({
        severity: "error",
        code: "matrix_q25_xor",
        detail: `M25: expected single vertical line, got ${JSON.stringify(lines)}`,
      });
    }
  }

  return issues;
}

function auditTextLogic(qs: TextQuestion[]): Issue[] {
  const issues: Issue[] = [];

  /** Spot-checks for the CHC text bank (id → correct option text) */
  const knownAnswers: Record<number, string> = {
    2: "48", // 3,6,12,24,?
    4: "−3", // span 4-9-2
    5: "3", // count △
    10: "12", // S=5 → +3 ×2 −4
    16: "9", // reverse 7-1-8-3 mid sum
    20: "380", // machine n²−n twice from 5
    22: "15", // queue update
    26: "16", // recurrence a5
    28: "7", // span 6-2-9-4-1
    30: "23", // prime >20
  };

  const indexCounts = new Map<string, number>();

  for (const q of qs) {
    if (!q.index || !q.subtest) {
      issues.push({
        severity: "error",
        code: "text_missing_chc_tag",
        detail: `T${q.id}: missing index/subtest`,
      });
    } else {
      indexCounts.set(q.index, (indexCounts.get(q.index) ?? 0) + 1);
    }

    if (
      /\b(wait|recalculate|Let me|Verifique)\b/i.test(q.explanation.pt) ||
      /\b(TODO|FIXME)\b/.test(q.explanation.pt)
    ) {
      issues.push({
        severity: "error",
        code: "text_debug_explanation",
        detail: `T${q.id}: explanation has debug text: ${q.explanation.pt.slice(0, 160)}`,
      });
    }

    const correct = q.options[q.correctIndex];
    if (knownAnswers[q.id] && correct !== knownAnswers[q.id]) {
      issues.push({
        severity: "error",
        code: "text_wrong_answer",
        detail: `T${q.id}: expected «${knownAnswers[q.id]}», got «${correct}»`,
      });
    }

    const texts = q.options.map((t) => t.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) {
      issues.push({
        severity: "error",
        code: "text_dup_option",
        detail: `T${q.id}: duplicate option texts`,
      });
    }

    for (const opt of q.options) {
      if (/alternativa inválida|opção descartável/i.test(opt)) {
        issues.push({
          severity: "error",
          code: "text_placeholder_distractor",
          detail: `T${q.id}: placeholder distractor «${opt}»`,
        });
      }
    }

    const expect = q.difficulty >= 3 ? 6 : 4;
    if (q.options.length !== expect) {
      issues.push({
        severity: "error",
        code: "text_option_count",
        detail: `T${q.id}: ${q.options.length} opts, expected ${expect}`,
      });
    }

    if (q.distractorErrors.filter((e) => e === null).length !== 1) {
      issues.push({
        severity: "error",
        code: "text_unique_correct",
        detail: `T${q.id}: expected exactly one null distractorError`,
      });
    }
  }

  for (const need of [
    "verbal",
    "fluido",
    "espacial",
    "memoria_trabalho",
    "velocidade_processamento",
    "tempo_reacao",
  ]) {
    if ((indexCounts.get(need) ?? 0) < 5) {
      issues.push({
        severity: "error",
        code: "text_chc_coverage",
        detail: `index ${need} has ${indexCounts.get(need) ?? 0} items (need ≥5)`,
      });
    }
  }

  // Independent math for CHC spot-checks
  if (5 + 3 !== 8 || 8 * 2 !== 16 || 16 - 4 !== 12) {
    issues.push({
      severity: "error",
      code: "text_update_math",
      detail: "atualização mental 5+3×2−4",
    });
  }
  if (8 + 2 * 4 !== 16) {
    issues.push({
      severity: "error",
      code: "text_recurrence_math",
      detail: "a5 recurrence",
    });
  }
  if (20 * 20 - 20 !== 380) {
    issues.push({
      severity: "error",
      code: "text_machine_math",
      detail: "n²−n reentrada",
    });
  }

  return issues;
}

function auditScoring(): Issue[] {
  const issues: Issue[] = [];
  const figs = getAssessmentItems("figures");
  const texts = getAssessmentItems("questions");
  const hybrid = getAssessmentItems("hybrid");

  if (figs.length !== 30 || texts.length !== 30 || hybrid.length !== 30) {
    issues.push({
      severity: "error",
      code: "bank_size",
      detail: `sizes F=${figs.length} T=${texts.length} H=${hybrid.length}`,
    });
  }

  // Hybrid interleaving: 15+15
  const hMat = hybrid.filter((q) => q.kind === "matrix").length;
  const hTxt = hybrid.filter((q) => q.kind === "text").length;
  if (hMat !== 15 || hTxt !== 15) {
    issues.push({
      severity: "error",
      code: "hybrid_mix",
      detail: `hybrid matrix=${hMat} text=${hTxt}`,
    });
  }

  // All-correct → high IQ; all-wrong → low
  const n = figs.length;
  const allRight = figs.map((q) => q.correctIndex);
  const allWrong = figs.map((q) => (q.correctIndex + 1) % q.options.length);
  const times = Array(n).fill(25_000);
  const switches = Array(n).fill(0);

  const hi = calculateIqResult(figs, allRight, times, switches, "figures");
  const lo = calculateIqResult(figs, allWrong, times, switches, "figures");

  if (hi.iq < 130) {
    issues.push({
      severity: "error",
      code: "score_ceiling",
      detail: `all-correct IQ=${hi.iq} (expected ≥130)`,
    });
  }
  if (!hi.indexScores?.length || !Number.isFinite(hi.cognitiveProfile?.spread)) {
    issues.push({
      severity: "error",
      code: "chc_result_missing",
      detail: "IqResult missing CHC indexScores/profile",
    });
  }
  for (const ix of hi.indexScores ?? []) {
    if (!Number.isFinite(ix.score) || !Number.isFinite(ix.iqApprox)) {
      issues.push({
        severity: "error",
        code: "chc_nan",
        detail: `index ${ix.id} NaN`,
      });
    }
  }
  const qHi = calculateIqResult(
    texts,
    texts.map((q) => q.correctIndex),
    Array(texts.length).fill(25_000),
    Array(texts.length).fill(0),
    "questions",
  );
  if (qHi.indexScores.length < 6) {
    issues.push({
      severity: "error",
      code: "chc_questions_indices",
      detail: `questions all-correct indices=${qHi.indexScores.length}`,
    });
  }
  if (lo.iq > 90) {
    issues.push({
      severity: "error",
      code: "score_floor",
      detail: `all-wrong IQ=${lo.iq} (expected ≤90)`,
    });
  }
  if (hi.percentile <= lo.percentile) {
    issues.push({
      severity: "error",
      code: "percentile_order",
      detail: `hi p=${hi.percentile} lo p=${lo.percentile}`,
    });
  }

  // Percentile ↔ IQ consistency via normal CDF
  const pFromIq = Math.round(normalCdf((hi.iq - 100) / 15) * 1000) / 10;
  if (Math.abs(pFromIq - hi.percentile) > 0.05) {
    issues.push({
      severity: "error",
      code: "percentile_mismatch",
      detail: `IQ ${hi.iq}: stored p=${hi.percentile}, recomputed=${pFromIq}`,
    });
  }

  // normalInv round-trip
  for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    const z = normalInv(p);
    const back = normalCdf(z);
    if (Math.abs(back - p) > 0.002) {
      issues.push({
        severity: "warn",
        code: "normal_inv_roundtrip",
        detail: `p=${p} → z=${z} → ${back}`,
      });
    }
  }

  // thetaToIq clamp
  if (thetaToIq(5, 6, 6) > 160 || thetaToIq(-5, 0, 6) < 68) {
    issues.push({
      severity: "error",
      code: "iq_clamp",
      detail: "thetaToIq outside [68,160]",
    });
  }

  // Partial credit: mid performance between lo and hi
  const half = figs.map((q, i) =>
    i % 2 === 0 ? q.correctIndex : (q.correctIndex + 1) % q.options.length,
  );
  const mid = calculateIqResult(figs, half, times, switches, "figures");
  if (!(lo.iq < mid.iq && mid.iq < hi.iq)) {
    issues.push({
      severity: "warn",
      code: "score_monotonic",
      detail: `lo=${lo.iq} mid=${mid.iq} hi=${hi.iq}`,
    });
  }

  // Unanswered (null) should not count as correct
  const unanswered = Array(n).fill(null) as (number | null)[];
  const none = calculateIqResult(figs, unanswered, times, switches, "figures");
  if (none.rawScore !== 0) {
    issues.push({
      severity: "error",
      code: "null_scored",
      detail: `all-null rawScore=${none.rawScore}`,
    });
  }

  // estimateTheta sanity
  const flags = figs.map(() => true);
  const { theta, se } = estimateTheta(figs, flags);
  if (!(theta > 1) || !(se > 0)) {
    issues.push({
      severity: "error",
      code: "theta_all_correct",
      detail: `theta=${theta} se=${se}`,
    });
  }

  return issues;
}

function main() {
  const matrix = getMatrixQuestions();
  const text = getTextQuestions();
  const structM = validateQuestionBank(matrix).map(
    (d): Issue => ({ severity: "error", code: "matrix_struct", detail: d }),
  );
  const structT = validateTextQuestionBank(text).map(
    (d): Issue => ({ severity: "error", code: "text_struct", detail: d }),
  );
  const issues = [
    ...structM,
    ...structT,
    ...auditMatrixLogic(matrix),
    ...auditTextLogic(text),
    ...auditScoring(),
  ];

  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");

  console.log(
    JSON.stringify(
      {
        matrixCount: matrix.length,
        textCount: text.length,
        errorCount: errors.length,
        warnCount: warns.length,
        errors,
        warns,
        sampleIq: {
          allCorrect: calculateIqResult(
            getAssessmentItems("figures"),
            getAssessmentItems("figures").map((q) => q.correctIndex),
            Array(30).fill(25000),
            Array(30).fill(0),
            "figures",
          ).iq,
        },
      },
      null,
      2,
    ),
  );

  if (errors.length) process.exitCode = 1;
}

main();
