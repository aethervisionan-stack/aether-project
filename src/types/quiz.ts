/** Professional IQ Test — psychometric & SVG matrix types */

export type ShapeKind =
  | "circle"
  | "square"
  | "triangle"
  | "hexagon"
  | "diamond"
  | "cross"
  | "line"
  | "dot"
  | "arc";

export type FillKind = "empty" | "hatched" | "solid" | "dotted";

export type RuleCategory =
  | "spatial"
  | "boolean"
  | "pattern"
  | "numerical";

export type Arrangement =
  | "center"
  | "grid"
  | "row"
  | "column"
  | "diagonal"
  | "corners"
  | "ring";

export interface Glyph {
  shape: ShapeKind;
  fill?: FillKind;
  rotation?: number;
  scale?: number;
  /** Offset from cell center in normalized units (-1..1) */
  ox?: number;
  oy?: number;
  strokeWidth?: number;
  /** For arcs / lines: sweep or length hint */
  param?: number;
}

export interface CellContent {
  glyphs: Glyph[];
  arrangement?: Arrangement;
  /** Repeat count when using a single glyph template */
  count?: number;
}

export interface MatrixQuestion {
  id: number;
  /** 1 (very easy) → 10 (genius / Mensa) */
  difficulty: number;
  /** Scoring weight; harder items contribute more */
  weight: number;
  categories: RuleCategory[];
  /** 9 cells; index 8 is always the empty "?" target */
  cells: (CellContent | null)[];
  /** Exactly 6 options A–F */
  options: CellContent[];
  /** Index of the uniquely correct option (0–5) */
  correctIndex: number;
  explanation: {
    /** Portuguese visual-rule explanation for review mode */
    pt: string;
    rules: string[];
  };
}

export type QuizPhase = "onboarding" | "test" | "results" | "review";

export interface AnswerRecord {
  questionId: number;
  selectedIndex: number | null;
  correct: boolean;
  timeMs: number;
}

export interface CompetenceScores {
  spatial: number;
  boolean: number;
  pattern: number;
  numerical: number;
}

export interface IqResult {
  rawScore: number;
  maxScore: number;
  accuracy: number;
  /** Wechsler-like estimated IQ (mean 100, SD 15) */
  iq: number;
  percentile: number;
  band: string;
  competences: CompetenceScores;
  avgTimeMs: number;
  answers: AnswerRecord[];
}

export interface QuizPersistedState {
  version: 1;
  phase: QuizPhase;
  currentIndex: number;
  answers: (number | null)[];
  startedAt: number | null;
  endsAt: number | null;
  questionStartedAt: number | null;
  timeSpentMs: number[];
  finishedAt: number | null;
  result: IqResult | null;
}

export const QUIZ_TOTAL_QUESTIONS = 25;
export const QUIZ_DURATION_MS = 25 * 60 * 1000;
export const QUIZ_STORAGE_KEY = "professional-iq-test-v1";
