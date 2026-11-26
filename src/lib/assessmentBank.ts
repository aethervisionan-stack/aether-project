import { getMatrixQuestions, getTutorialExample } from "@/src/lib/matrixGenerator";
import {
  getTextQuestions,
  getTextTutorialExample,
} from "@/src/data/textQuestions";
import type {
  AssessmentMode,
  MatrixQuestion,
  QuizItem,
  TextQuestion,
} from "@/src/types/quiz";

function withMatrixKind(q: MatrixQuestion): MatrixQuestion {
  return { ...q, kind: "matrix" };
}

function buildHybridItems(): QuizItem[] {
  const figs = getMatrixQuestions().map(withMatrixKind);
  const texts = getTextQuestions();
  const out: QuizItem[] = [];
  let id = 1;
  for (let band = 1; band <= 5; band++) {
    const fBand = figs.filter((q) => q.difficulty === band).slice(0, 3);
    const tBand = texts.filter((q) => q.difficulty === band).slice(0, 3);
    for (let i = 0; i < 3; i++) {
      const f = fBand[i];
      const t = tBand[i];
      if (f) out.push({ ...f, id: id++ });
      if (t) out.push({ ...t, id: id++ });
    }
  }
  return out;
}

const cache: Partial<Record<AssessmentMode, QuizItem[]>> = {};

/** Canonical bank (fixed option order). Prefer getSessionAssessmentItems for live sessions. */
export function getAssessmentItems(mode: AssessmentMode): QuizItem[] {
  if (!cache[mode]) {
    if (mode === "figures") {
      cache[mode] = getMatrixQuestions().map(withMatrixKind);
    } else if (mode === "questions") {
      cache[mode] = getTextQuestions();
    } else {
      cache[mode] = buildHybridItems();
    }
  }
  return cache[mode]!;
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

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Reshuffle options while remapping correctIndex + distractorErrors. */
function reshuffleItemOptions(item: QuizItem, rand: () => number): QuizItem {
  const n = item.options.length;
  if (n < 2) return item;
  const order = Array.from({ length: n }, (_, i) => i);
  shuffleInPlace(order, rand);
  const options = order.map((i) => item.options[i]) as QuizItem["options"];
  const distractorErrors = order.map((i) => item.distractorErrors[i] ?? null);
  const correctIndex = order.indexOf(item.correctIndex);
  if (item.kind === "matrix") {
    return {
      ...item,
      options: options as MatrixQuestion["options"],
      distractorErrors: distractorErrors as MatrixQuestion["distractorErrors"],
      correctIndex: correctIndex < 0 ? 0 : correctIndex,
    };
  }
  return {
    ...item,
    options: options as TextQuestion["options"],
    distractorErrors: distractorErrors as TextQuestion["distractorErrors"],
    correctIndex: correctIndex < 0 ? 0 : correctIndex,
  };
}

/**
 * Session-scoped variety: shuffle item order within each difficulty band
 * and reshuffle options. Psychometric structure (band counts / indices) stays intact.
 * Same seed → same form (resume-safe).
 */
export function getSessionAssessmentItems(
  mode: AssessmentMode,
  sessionSeed: number,
): QuizItem[] {
  const base = getAssessmentItems(mode).map((q) => ({ ...q }));
  const rand = mulberry32(sessionSeed >>> 0);
  const byBand = new Map<number, QuizItem[]>();
  for (const q of base) {
    const list = byBand.get(q.difficulty) ?? [];
    list.push(q);
    byBand.set(q.difficulty, list);
  }
  const out: QuizItem[] = [];
  for (let band = 1; band <= 5; band++) {
    const group = byBand.get(band) ?? [];
    shuffleInPlace(group, rand);
    for (const item of group) {
      out.push(reshuffleItemOptions(item, rand));
    }
  }
  // Stable display positions 1..n for UI; keep bank id on questionId via scoring
  return out.map((q, i) => ({ ...q, id: i + 1 }));
}

/** Cryptographically-ish seed for a new official attempt. */
export function createSessionSeed(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] >>> 0) || (Date.now() >>> 0);
  }
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
}

export type TutorialExample =
  | {
      kind: "matrix";
      cells: ReturnType<typeof getTutorialExample>["cells"];
      options: ReturnType<typeof getTutorialExample>["options"];
      correctIndex: number;
      explanation: string;
    }
  | {
      kind: "text";
      stem: string;
      premises: string[];
      options: string[];
      correctIndex: number;
      explanation: string;
    };

export function getModeTutorial(mode: AssessmentMode): TutorialExample {
  if (mode === "questions") {
    const t = getTextTutorialExample();
    return { kind: "text", ...t };
  }
  // figures + hybrid lead with a visual mini-example
  const t = getTutorialExample();
  return {
    kind: "matrix",
    cells: t.cells,
    options: t.options,
    correctIndex: t.correctIndex,
    explanation: t.explanation,
  };
}

export function getModeRules(mode: AssessmentMode): {
  title: string;
  bullets: { t: string; d: string }[];
} {
  if (mode === "figures") {
    return {
      title: "Figuras Geométricas",
      bullets: [
        {
          t: "Índices",
          d: "Carga principal em Fluido e Espacial (matrizes SVG com regras compostas).",
        },
        {
          t: "30 minutos",
          d: "Cronômetro global. Telemetria de tempo, hesitação e banda L1–L5.",
        },
        {
          t: "Teclado",
          d: "A–H / 1–8 para escolher; Enter / → avançar; ← voltar.",
        },
      ],
    };
  }
  if (mode === "questions") {
    return {
      title: "Perguntas objetivas",
      bullets: [
        {
          t: "Seis índices",
          d: "Verbal, Fluido, Espacial, Memória de trabalho, Velocidade de processamento e Tempo de reação — 5 bandas.",
        },
        {
          t: "30 minutos",
          d: "Cronômetro global. Respostas precipitadas reduzem consistência e alargam a margem.",
        },
        {
          t: "Teclado",
          d: "A–F / 1–6 (conforme opções); Enter / → avançar; ← voltar.",
        },
      ],
    };
  }
  return {
    title: "Completo / Híbrido",
    bullets: [
      {
        t: "Misto",
        d: "15 matrizes + 15 perguntas intercaladas por nível (L1–L5), perfil cognitivo completo.",
      },
      {
        t: "30 minutos",
        d: "QI IRT 3PL unificado + escores por índice/subteste e detecção de anomalias.",
      },
      {
        t: "Teclado",
        d: "A–H / 1–8 conforme o item; Enter / → avançar; ← voltar.",
      },
    ],
  };
}

export function isTextQuestion(item: QuizItem): item is TextQuestion {
  return item.kind === "text";
}

export function isMatrixQuestion(item: QuizItem): item is MatrixQuestion {
  return item.kind === "matrix";
}
