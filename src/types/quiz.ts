/** Professional IQ Test — multi-mode psychometric types (v4 CHC) */

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

/** Six CHC-inspired cognitive indices (PT-BR product labels) */
export type CognitiveIndexId =
  | "verbal"
  | "fluido"
  | "espacial"
  | "memoria_trabalho"
  | "velocidade_processamento"
  | "tempo_reacao";

/** Subtests nested under the six indices */
export type SubtestId =
  | "vocabulario"
  | "analogias_verbais"
  | "compreensao_verbal"
  | "matrizes_abstratas"
  | "inducao_regras"
  | "sequencias_logicas"
  | "rotacao_mental"
  | "visualizacao"
  | "completamento_espacial"
  | "span_digitos"
  | "atualizacao_mental"
  | "sequencia_reversa"
  | "busca_simbolos"
  | "pareamento_rapido"
  | "codificacao"
  | "decisao_rapida"
  | "julgamento_latencia"
  | "resposta_deliberada";

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
  /** CHC index this item primarily loads */
  index: CognitiveIndexId;
  /** Nested subtest within the index */
  subtest: SubtestId;
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
  /** CHC index this item primarily loads */
  index: CognitiveIndexId;
  /** Nested subtest within the index */
  subtest: SubtestId;
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
  /** @deprecated alias of consistencyScore — kept for persisted UI */
  consistencyIndex: number;
  /** 0–100 response-pattern consistency (easy-miss/hard-hit + rush penalties) */
  consistencyScore: number;
  guessingFlag: boolean;
  incompleteFlag: boolean;
  inconsistentFlag: boolean;
  warnings: string[];
  bandTelemetry: BandTelemetry[];
  hardAccuracy: number;
  avgOptionSwitches: number;
  /** How many items had a selection when the session ended */
  answeredInTime: number;
  /** True when the countdown hit zero */
  timedOut: boolean;
}

export interface TimeMetrics {
  totalMs: number;
  avgMs: number;
  medianMs: number;
  answeredCount: number;
  unansweredCount: number;
}

export interface IndexScore {
  id: CognitiveIndexId;
  /** 0–100 weighted accuracy within the index */
  score: number;
  /** Approximate index IQ on 100/15 (session-relative) */
  iqApprox: number;
  descriptor: string;
  answered: number;
  total: number;
  avgTimeMs: number;
}

export interface SubtestScore {
  id: SubtestId;
  index: CognitiveIndexId;
  score: number;
  descriptor: string;
  answered: number;
  total: number;
}

export type AnomalyKind =
  | "chute_rapido"
  | "padrao_erratico"
  | "incompleto"
  | "hesitacao_alta"
  | "distrator_sistematico"
  | "latencia_anomala";

export interface AnomalyHit {
  kind: AnomalyKind;
  label: string;
  detail: string;
  /** Estimated widening of confidence margin (IQ points) */
  marginImpact: number;
}

export interface AnomalyReport {
  count: number;
  totalImpact: number;
  hits: AnomalyHit[];
}

export type ProfileShape = "equilibrado" | "assimetrico";

export interface CognitiveProfile {
  shape: ProfileShape;
  label: string;
  detail: string;
  /** Spread (max−min) of active index scores */
  spread: number;
  strengths: { id: CognitiveIndexId; score: number; label: string }[];
  improvements: { id: CognitiveIndexId; score: number; label: string }[];
}

export interface IqResult {
  mode: AssessmentMode;
  rawScore: number;
  maxScore: number;
  accuracy: number;
  /** Point estimate (Wechsler-like, mean 100, SD 15) */
  iq: number;
  /** Latent ability θ from 3PL MAP (mean 0, SD≈1) */
  theta: number;
  /** Half-width of ~68% CI, e.g. 5 → "128 (±5)" — alias of confidenceMargin */
  marginOfError: number;
  /** IRT SE-based confidence half-width (same value as marginOfError) */
  confidenceMargin: number;
  /** Session consistency 0–100 (mirrors diagnosis.consistencyScore) */
  consistencyScore: number;
  iqLow: number;
  iqHigh: number;
  percentile: number;
  band: string;
  competences: CompetenceScores;
  /** Which competence keys had items in this session */
  activeCompetences: (keyof CompetenceScores)[];
  /** CHC index scores (only indices with items appear as active) */
  indexScores: IndexScore[];
  subtestScores: SubtestScore[];
  anomalies: AnomalyReport;
  cognitiveProfile: CognitiveProfile;
  avgTimeMs: number;
  timeMetrics: TimeMetrics;
  answers: AnswerRecord[];
  diagnosis: PrecisionDiagnosis;
}

export interface QuizPersistedState {
  /** Storage schema version — bump when incompatible */
  version: 4;
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
  /**
   * Seed for within-band + option shuffle (resume-safe).
   * Decoupled from ranking storage — future DB can key forms by this.
   */
  sessionSeed: number | null;
  /**
   * Stable client session id (iq_…) bound to server unlock registry.
   * Unlock is authoritative on the server — this id alone does not unlock.
   */
  sessionId: string | null;
  /**
   * Client cache after server confirm. Never grant UI access from this flag
   * without a successful /api/payment/pix/status response.
   */
  resultsUnlocked: boolean;
  /** Last Mercado Pago payment id (or legacy order_nsu) for this IQ unlock */
  unlockOrderNsu: string | null;
}

/** Persisted ranking mode (figures → geometric for public copy) */
export type LeaderboardMode = "geometric" | "questions" | "hybrid";

export type LeaderboardFilter = "all" | "figures" | "questions" | "hybrid";

export interface LeaderboardEntry {
  id: string;
  name: string;
  /** Optional compressed avatar (data URL locally; remote URL when backend lands) */
  avatarUrl?: string;
  iqScore: number;
  confidenceMargin: number;
  percentile: number;
  mode: LeaderboardMode;
  /** 0–100 IRT session consistency (tie-break); mirrors consistencyScore */
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

/** v4 keys are mode-isolated; legacy keys ignored */
export const QUIZ_STORAGE_VERSION = 4 as const;
export const QUIZ_STORAGE_KEY_PREFIX = "professional-iq-test-v4";
export const QUIZ_STORAGE_KEY_LEGACY_V3 = "professional-iq-test-v3";
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
      "Matrizes 3×3 com carga em raciocínio fluido e espacial — multi-regras, até 8 opções e distratores diagnósticos.",
  },
  questions: {
    label: "Perguntas",
    short: "Perguntas",
    blurb:
      "Bateria objetiva nos seis índices: Verbal, Fluido, Espacial, Memória de trabalho, Velocidade e Tempo de reação.",
  },
  hybrid: {
    label: "Completo / Híbrido",
    short: "Híbrido",
    blurb:
      "Matrizes SVG + itens textuais intercalados por nível, cobrindo o perfil cognitivo completo.",
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
