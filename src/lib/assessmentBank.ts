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
