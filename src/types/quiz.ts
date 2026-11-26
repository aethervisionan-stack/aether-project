/** Professional IQ Test — multi-mode psychometric types (v3) */

export type AssessmentMode = "figures" | "questions" | "hybrid";

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

/** Skills for objective (Perguntas) items */
export type QuestionSkill =
  | "logical"
  | "numeric"
  | "verbal"
  | "analytical";

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

/** Logical error encoded by each wrong figure option */
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

/** Logical error encoded by each wrong text option */
export type TextDistractorError =
  | "premise_ignore"
  | "scope_error"
  | "wrong_operation"
  | "near_miss"
  | "semantic_swap"
  | "quantifier_error"
  | "order_error"
  | "incomplete_chain"
  | "false_analogy"
  | "arithmetic_slip";

export type AnyDistractorError = DistractorError | TextDistractorError;

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
  kind: "matrix";
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

export interface TextQuestion {
  kind: "text";
  id: number;
  difficulty: DifficultyBand;
  weight: number;
  irtB: number;
  skills: QuestionSkill[];
  stem: string;
  premises?: string[];
  options: string[];
  correctIndex: number;
  distractorErrors: (TextDistractorError | null)[];
  explanation: {
    pt: string;
    rules: string[];
  };
}

export type QuizItem = MatrixQuestion | TextQuestion;

export type QuizPhase =
  | "modeSelect"
  | "onboarding"
  | "test"
  | "results"
  | "review";

export interface AnswerRecord {
  questionId: number;
  selectedIndex: number | null;
  correct: boolean;
  timeMs: number;
  optionSwitches: number;
  distractorError: AnyDistractorError | null;
}

/** Sub-skills across both modes (unused keys stay 0) */
export interface CompetenceScores {
  spatial: number;
  boolean: number;
  pattern: number;
  numerical: number;
  logical: number;
  numeric: number;
  verbal: number;
  analytical: number;
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
  mode: AssessmentMode;
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
  /** Which competence keys had items in this session */
  activeCompetences: (keyof CompetenceScores)[];
  avgTimeMs: number;
  answers: AnswerRecord[];
  diagnosis: PrecisionDiagnosis;
}

export interface QuizPersistedState {
  /** Storage schema version — bump when incompatible */
  version: 3;
  mode: AssessmentMode;
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
  totalQuestions: number;
  /** Display name for ranking (empty → anonymous default at submit) */
  participantName: string;
  /** Optional compressed avatar data URL for ranking / result identity */
  participantAvatarUrl: string | null;
  /** Leaderboard entry id written after this session finished */
  leaderboardEntryId: string | null;
}

/** Persisted ranking mode (figures → geometric for public copy) */
export type LeaderboardMode = "geometric" | "questions" | "hybrid";

export type LeaderboardFilter = "all" | "figures" | "questions";

export interface LeaderboardEntry {
  id: string;
  name: string;
  /** Optional compressed avatar (data URL locally; remote URL when backend lands) */
  avatarUrl?: string;
  iqScore: number;
  confidenceMargin: number;
  percentile: number;
  mode: LeaderboardMode;
  /** 0–100 precision/consistency composite used for tie-break */
  accuracyLevel: number;
  durationSeconds: number;
  createdAt: number;
  /** Computed at read time — not persisted */
  isCurrentUser?: boolean;
}

export const LEADERBOARD_STORAGE_KEY = "professional-iq-leaderboard-v1";
export const LEADERBOARD_CURRENT_ID_KEY =
  "professional-iq-leaderboard-current-v1";
export const ANONYMOUS_PARTICIPANT_NAME = "Anônimo";

export const LEADERBOARD_MODE_LABEL: Record<LeaderboardMode, string> = {
  geometric: "Figuras",
  questions: "Perguntas",
  hybrid: "Híbrido",
};

export const QUIZ_TOTAL_QUESTIONS = 30;
export const QUIZ_DURATION_MS = 30 * 60 * 1000;

/** v3 keys are mode-isolated; legacy keys ignored */
export const QUIZ_STORAGE_VERSION = 3 as const;
export const QUIZ_STORAGE_KEY_PREFIX = "professional-iq-test-v3";
export const QUIZ_STORAGE_KEY_LEGACY_V2 = "professional-iq-test-v2";
export const QUIZ_STORAGE_KEY_LEGACY_V1 = "professional-iq-test-v1";

export function quizStorageKey(mode: AssessmentMode): string {
  return `${QUIZ_STORAGE_KEY_PREFIX}-${mode}`;
}

export const MODE_META: Record<
  AssessmentMode,
  { label: string; short: string; blurb: string }
> = {
  figures: {
    label: "Figuras Geométricas",
    short: "Figuras",
    blurb:
      "Matrizes 3×3 de alta dificuldade, multi-regras e até 8 opções com distratores diagnósticos.",
  },
  questions: {
    label: "Perguntas",
    short: "Perguntas",
    blurb:
      "Itens objetivos: lógica dedutiva, sequências numéricas, relações verbais e resolução analítica.",
  },
  hybrid: {
    label: "Completo / Híbrido",
    short: "Híbrido",
    blurb:
      "Combina matrizes visuais e perguntas objetivas na mesma bateria ponderada.",
  },
};

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

export const FIGURE_COMPETENCE_KEYS: (keyof CompetenceScores)[] = [
  "spatial",
  "boolean",
  "pattern",
  "numerical",
];

export const QUESTION_COMPETENCE_KEYS: (keyof CompetenceScores)[] = [
  "logical",
  "numeric",
  "verbal",
  "analytical",
];

export function competenceKeysForMode(
  mode: AssessmentMode,
): (keyof CompetenceScores)[] {
  if (mode === "figures") return FIGURE_COMPETENCE_KEYS;
  if (mode === "questions") return QUESTION_COMPETENCE_KEYS;
  return [...FIGURE_COMPETENCE_KEYS, ...QUESTION_COMPETENCE_KEYS];
}

export function bandProgressLabel(band: DifficultyBand): string {
  const meta = BAND_META[band];
  return `Nível ${band}/5 • ${meta.label}`;
}

export function isMatrixItem(item: QuizItem): item is MatrixQuestion {
  return item.kind === "matrix";
}

export function isTextItem(item: QuizItem): item is TextQuestion {
  return item.kind === "text";
}
