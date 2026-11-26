/** Professional IQ Test — psychometric & SVG matrix types (v2) */

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

/** 1 Basic → 5 Extreme (high ceiling QI 135–155+) */
export type DifficultyBand = 1 | 2 | 3 | 4 | 5;

export type Arrangement =
  | "center"
  | "grid"
  | "row"
  | "column"
  | "diagonal"
  | "corners"
  | "ring";

/** Logical error encoded by each wrong option (diagnostic distractors) */
export type DistractorError =
  | "incomplete_rotation"
  | "horizontal_only"
  | "vertical_only"
  | "polarity_flip"
  | "wrong_count"
  | "shape_swap"
  | "fill_only"
  | "or_instead_of_xor"
  | "and_instead_of_xor"
  | "missing_rule"
  | "extra_element"
  | "mirror_instead_of_rotate"
  | "wrong_scale"
  | "partial_union";

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

export interface DistractorSpec {
  cell: CellContent;
  error: DistractorError;
}

export interface MatrixQuestion {
  id: number;
  /** Band 1–5 */
  difficulty: DifficultyBand;
  /** IRT-ish discrimination / scoring weight */
  weight: number;
  /** Rough latent difficulty (b-parameter), ~ −2 … +2.5 */
  irtB: number;
  categories: RuleCategory[];
  /** 9 cells; index 8 is always the empty "?" target */
  cells: (CellContent | null)[];
  /** 6 options (bands 1–2) or 8 (bands 3–5) */
  options: CellContent[];
  /** Index of the uniquely correct option */
  correctIndex: number;
  /** Parallel to options; null at correctIndex */
  distractorErrors: (DistractorError | null)[];
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
  optionSwitches: number;
  distractorError: DistractorError | null;
}

export interface CompetenceScores {
  spatial: number;
  boolean: number;
  pattern: number;
  numerical: number;
}

export interface BandTelemetry {
  band: DifficultyBand;
  label: string;
  avgTimeMs: number;
  accuracy: number;
  answered: number;
  total: number;
}

export interface PrecisionDiagnosis {
  /** 0–100 composite reliability / precision score */
  precisionScore: number;
  reliabilityIndex: number;
  consistencyIndex: number;
  guessingFlag: boolean;
  incompleteFlag: boolean;
  inconsistentFlag: boolean;
  warnings: string[];
  bandTelemetry: BandTelemetry[];
  hardAccuracy: number;
  avgOptionSwitches: number;
}

export interface IqResult {
  rawScore: number;
  maxScore: number;
  accuracy: number;
  /** Point estimate (Wechsler-like, mean 100, SD 15) */
  iq: number;
  /** Half-width of ~68% CI, e.g. 5 → "128 (±5)" */
  marginOfError: number;
  iqLow: number;
  iqHigh: number;
  percentile: number;
  band: string;
  competences: CompetenceScores;
  avgTimeMs: number;
  answers: AnswerRecord[];
  diagnosis: PrecisionDiagnosis;
}

export interface QuizPersistedState {
  /** Storage schema version — bump when incompatible */
  version: 2;
  phase: QuizPhase;
  currentIndex: number;
  answers: (number | null)[];
  startedAt: number | null;
  endsAt: number | null;
  questionStartedAt: number | null;
  timeSpentMs: number[];
  /** Hesitation: how many times the selection changed per item */
  optionSwitches: number[];
  finishedAt: number | null;
  result: IqResult | null;
}

export const QUIZ_TOTAL_QUESTIONS = 30;
export const QUIZ_DURATION_MS = 30 * 60 * 1000;
/** Current key; v1 key is ignored (clean restart) */
export const QUIZ_STORAGE_KEY = "professional-iq-test-v2";
export const QUIZ_STORAGE_KEY_LEGACY = "professional-iq-test-v1";

export const BAND_META: Record<
  DifficultyBand,
  { label: string; short: string }
> = {
  1: { label: "Básico", short: "Básico" },
  2: { label: "Elementar", short: "Elementar" },
  3: { label: "Intermediário", short: "Intermediário" },
  4: { label: "Alta Complexidade", short: "Alta Complexidade" },
  5: { label: "Extremo", short: "Extremo" },
};

export function bandProgressLabel(band: DifficultyBand): string {
  const meta = BAND_META[band];
  return `Nível ${band}/5 • ${meta.label}`;
}
