import { INDEX_META, indexLabel } from "@/src/lib/chcCatalog";
import {
  MODE_META,
  type AnomalyKind,
  type AnomalyHit,
  type CognitiveIndexId,
  type IqResult,
  type PrecisionDiagnosis,
  type TimeMetrics,
} from "@/src/types/quiz";

export type ProfileAssistantContext = {
  participantName: string;
  rank: number | null;
  rankTotal: number;
  result: IqResult;
};

export type ProfileChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Soft non-clinical note — show once in the UI, not on every reply. */
export const PROFILE_ASSISTANT_DISCLAIMER =
  "Nota: este chat interpreta só os números desta sessão. Não substitui avaliação clínica, laudo psicológico nem orientação médica.";

const ANOMALY_KINDS = new Set<AnomalyKind>([
  "chute_rapido",
  "padrao_erratico",
  "incompleto",
  "hesitacao_alta",
  "distrator_sistematico",
  "latencia_anomala",
]);

const EMPTY_ANOMALIES: IqResult["anomalies"] = {
  count: 0,
  totalImpact: 0,
  hits: [],
};

const EMPTY_PROFILE: IqResult["cognitiveProfile"] = {
  shape: "equilibrado",
  label: "Perfil indeterminado",
  detail: "Dados de perfil incompletos nesta sessão.",
  spread: 0,
  strengths: [],
  improvements: [],
};

const EMPTY_DIAGNOSIS: PrecisionDiagnosis = {
  precisionScore: 0,
  reliabilityIndex: 0,
  consistencyIndex: 0,
  consistencyScore: 0,
  guessingFlag: false,
  incompleteFlag: false,
  inconsistentFlag: false,
  warnings: [],
  bandTelemetry: [],
  hardAccuracy: 0,
  avgOptionSwitches: 0,
  answeredInTime: 0,
  timedOut: false,
};

const EMPTY_TIME: TimeMetrics = {
  totalMs: 0,
  avgMs: 0,
  medianMs: 0,
  answeredCount: 0,
  unansweredCount: 0,
};

function asAnomalyKind(v: unknown): AnomalyKind {
  return typeof v === "string" && ANOMALY_KINDS.has(v as AnomalyKind)
    ? (v as AnomalyKind)
    : "padrao_erratico";
}

function isCognitiveIndexId(v: unknown): v is CognitiveIndexId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(INDEX_META, v);
}

function safeIndexLabel(id: unknown, fallback = "Índice"): string {
  if (!isCognitiveIndexId(id)) return fallback;
  try {
    return indexLabel(id);
  } catch {
    return fallback;
  }
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Normalize sparse / partial IqResult from older persisted state so
 * snapshot + prompts never crash on missing nested fields.
 */
export function normalizeIqResult(raw: Partial<IqResult> | null | undefined): IqResult | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.iq !== "number" || !Number.isFinite(raw.iq)) return null;

  const anomaliesRaw = raw.anomalies;
  const profileRaw = raw.cognitiveProfile;
  const diagnosisRaw = raw.diagnosis;

  const hits: AnomalyHit[] = asArray(anomaliesRaw?.hits).map((h) => ({
    kind: asAnomalyKind((h as { kind?: string }).kind),
    label: asString((h as { label?: string }).label, "Sinal"),
    detail: asString((h as { detail?: string }).detail, ""),
    marginImpact: asNumber((h as { marginImpact?: number }).marginImpact, 0),
  }));

  const anomalies: IqResult["anomalies"] = {
    count: asNumber(anomaliesRaw?.count, hits.length),
    totalImpact: asNumber(anomaliesRaw?.totalImpact, 0),
    hits,
  };

  const cognitiveProfile: IqResult["cognitiveProfile"] = {
    shape:
      profileRaw?.shape === "assimetrico" || profileRaw?.shape === "equilibrado"
        ? profileRaw.shape
        : EMPTY_PROFILE.shape,
    label: asString(profileRaw?.label, EMPTY_PROFILE.label),
    detail: asString(profileRaw?.detail, EMPTY_PROFILE.detail),
    spread: asNumber(profileRaw?.spread, 0),
    strengths: asArray(profileRaw?.strengths)
      .filter((s) => isCognitiveIndexId((s as { id?: unknown }).id))
      .map((s) => ({
        id: (s as { id: CognitiveIndexId }).id,
        score: asNumber((s as { score?: number }).score, 0),
        label: asString(
          (s as { label?: string }).label,
          safeIndexLabel((s as { id: CognitiveIndexId }).id),
        ),
      })),
    improvements: asArray(profileRaw?.improvements)
      .filter((s) => isCognitiveIndexId((s as { id?: unknown }).id))
      .map((s) => ({
        id: (s as { id: CognitiveIndexId }).id,
        score: asNumber((s as { score?: number }).score, 0),
        label: asString(
          (s as { label?: string }).label,
          safeIndexLabel((s as { id: CognitiveIndexId }).id),
        ),
      })),
  };

  const consistencyScore = asNumber(
    diagnosisRaw?.consistencyScore ??
      diagnosisRaw?.consistencyIndex ??
      raw.consistencyScore,
    0,
  );

  const diagnosis: PrecisionDiagnosis = {
    precisionScore: asNumber(diagnosisRaw?.precisionScore, consistencyScore),
    reliabilityIndex: asNumber(diagnosisRaw?.reliabilityIndex, consistencyScore),
    consistencyIndex: asNumber(diagnosisRaw?.consistencyIndex, consistencyScore),
    consistencyScore,
    guessingFlag: Boolean(diagnosisRaw?.guessingFlag),
    incompleteFlag: Boolean(diagnosisRaw?.incompleteFlag),
    inconsistentFlag: Boolean(diagnosisRaw?.inconsistentFlag),
    warnings: asArray<string>(diagnosisRaw?.warnings),
    bandTelemetry: asArray(diagnosisRaw?.bandTelemetry),
    hardAccuracy: asNumber(diagnosisRaw?.hardAccuracy, 0),
    avgOptionSwitches: asNumber(diagnosisRaw?.avgOptionSwitches, 0),
    answeredInTime: asNumber(diagnosisRaw?.answeredInTime, 0),
    timedOut: Boolean(diagnosisRaw?.timedOut),
  };

  const confidenceMargin = asNumber(
    raw.confidenceMargin ?? raw.marginOfError,
    0,
  );

  return {
    mode: (raw.mode ?? "hybrid") as IqResult["mode"],
    rawScore: asNumber(raw.rawScore, 0),
    maxScore: asNumber(raw.maxScore, 0),
    accuracy: asNumber(raw.accuracy, 0),
    iq: raw.iq,
    theta: asNumber(raw.theta, 0),
    marginOfError: confidenceMargin,
    confidenceMargin,
    consistencyScore: asNumber(raw.consistencyScore, diagnosis.consistencyScore),
    iqLow: asNumber(raw.iqLow, raw.iq),
    iqHigh: asNumber(raw.iqHigh, raw.iq),
    percentile: asNumber(raw.percentile, 50),
    band: asString(raw.band, "—"),
    competences: (raw.competences ?? {}) as IqResult["competences"],
    activeCompetences: asArray(raw.activeCompetences),
    indexScores: asArray(raw.indexScores),
    subtestScores: asArray(raw.subtestScores),
    anomalies: anomalies.count || anomalies.hits.length ? anomalies : EMPTY_ANOMALIES,
    cognitiveProfile:
      profileRaw && typeof profileRaw === "object"
        ? cognitiveProfile
        : EMPTY_PROFILE,
    avgTimeMs: asNumber(raw.avgTimeMs, 0),
    timeMetrics: raw.timeMetrics
      ? {
          totalMs: asNumber(raw.timeMetrics.totalMs, 0),
          avgMs: asNumber(raw.timeMetrics.avgMs, 0),
          medianMs: asNumber(raw.timeMetrics.medianMs, 0),
          answeredCount: asNumber(raw.timeMetrics.answeredCount, 0),
          unansweredCount: asNumber(raw.timeMetrics.unansweredCount, 0),
        }
      : EMPTY_TIME,
    answers: asArray(raw.answers),
    diagnosis: diagnosisRaw && typeof diagnosisRaw === "object" ? diagnosis : EMPTY_DIAGNOSIS,
  };
}

export function normalizeAssistantContext(
  ctx: ProfileAssistantContext,
): ProfileAssistantContext | null {
  const result = normalizeIqResult(ctx?.result);
  if (!result) return null;
  return {
    participantName: asString(ctx.participantName, "Participante"),
    rank: ctx.rank == null ? null : asNumber(ctx.rank, 0),
    rankTotal: asNumber(ctx.rankTotal, 0),
    result,
  };
}

const SYSTEM_GUIDANCE_PT = `Você é o assistente conversacional do Teste de QI (Aether).
Fale em português do Brasil, de forma natural e fluida — como um educador claro, nunca como um dump de JSON ou lista crua de anomalias.

Fonte de verdade: o JSON IqResult + ranking local + o histórico deste chat.
Nunca invente números que não estejam no JSON.

Como responder por intenção:
1) Forças / destaques → explique o que brilha no perfil (índices altos, forma, detalhe) com linguagem humana; cite 1–2 números só para ancorar.
2) Fraquezas / o que melhorar / anomalias / consistência → NÃO repita o relatório bruto de anomalias. Traduza o sinal em linguagem prática (ex.: ritmo impulsivo, hesitação, sessão incompleta) e ofereça 2–3 dicas concretas e leves para a próxima sessão (pausar 2s antes de marcar, reler o enunciado, terminar com calma, treinar o índice mais baixo com exercícios curtos). Tom encorajador, sem patologizar.
3) QI / percentil / IC / ranking / índices → explique o significado na escala desta sessão, com os números do JSON.
4) Fora do escopo ou pedido clínico (diagnóstico, transtorno, medicação, laudo) → recuse com delicadeza e diga que só interpreta o painel desta sessão.

Estilo:
- 2–6 frases, conversacionais; evite bullets longos e markdown pesado.
- NÃO cole o disclaimer clínico em toda resposta (a UI já mostra uma nota suave uma vez). Só mencione se a pessoa pedir opinião clínica.
- Use o histórico para não se repetir e para aprofundar follow-ups.
- Se um campo estiver vazio/ausente no JSON, diga que não há dado suficiente — não preencha com chute.`;

/** Compact snapshot for the LLM — no item-level answers. */
export function buildGroundedSnapshot(ctx: ProfileAssistantContext) {
  const normalized = normalizeAssistantContext(ctx) ?? ctx;
  const { result, participantName, rank, rankTotal } = normalized;
  const ci = result.confidenceMargin ?? result.marginOfError;
  const profile = result.cognitiveProfile ?? EMPTY_PROFILE;
  const anomalies = result.anomalies ?? EMPTY_ANOMALIES;
  const diagnosis = result.diagnosis ?? EMPTY_DIAGNOSIS;

  return {
    nome: participantName?.trim() || "Participante",
    modo: MODE_META[result.mode]?.label ?? result.mode,
    qi: result.iq,
    intervaloConfianca: {
      low: result.iqLow,
      high: result.iqHigh,
      meiaLargura: ci,
    },
    percentil: result.percentile,
    faixa: result.band,
    consistencia: result.consistencyScore,
    perfil: {
      forma: profile.shape,
      rotulo: profile.label,
      detalhe: profile.detail,
      amplitude: profile.spread,
      forcas: (profile.strengths ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        score: s.score,
      })),
      aDesenvolver: (profile.improvements ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        score: s.score,
      })),
    },
    indices: (result.indexScores ?? []).map((ix) => ({
      id: ix.id,
      label: safeIndexLabel(ix.id, asString(ix.id, "Índice")),
      score: ix.score,
      qiAprox: ix.iqApprox,
      descriptor: ix.descriptor,
      respondidos: `${ix.answered}/${ix.total}`,
    })),
    anomalias: (() => {
      const hits = (anomalies.hits ?? []).map((h) => ({
        kind: h.kind,
        label: h.label,
        detail: h.detail,
        marginImpact: h.marginImpact,
      }));
      // Exact coherence: N in count === hits.length === UI list (never invent extras)
      const count = hits.length;
      return {
        count,
        impactoMargem: anomalies.totalImpact,
        resumo:
          count === 0
            ? "Nenhuma anomalia relevante nesta sessão."
            : `${count} anomalia(s) com detalhe próprio — cite só estes hits, sem inventar outras.`,
        hits,
      };
    })(),
    rankingLocal:
      rank != null
        ? { lugar: rank, total: rankTotal }
        : {
            lugar: null,
            total: rankTotal,
            nota: "Sem entrada de ranking nesta sessão.",
          },
    diagnosticoSessao: {
      timedOut: diagnosis.timedOut,
      answeredInTime: diagnosis.answeredInTime,
      guessingFlag: diagnosis.guessingFlag,
      incompleteFlag: diagnosis.incompleteFlag,
      inconsistentFlag: diagnosis.inconsistentFlag,
      warnings: (diagnosis.warnings ?? []).slice(0, 6),
    },
  };
}

export function buildProfileAssistantSystemPrompt(
  ctx: ProfileAssistantContext,
): string {
  const snapshot = buildGroundedSnapshot(ctx);
  return `${SYSTEM_GUIDANCE_PT}

JSON do perfil (única fonte de verdade):
${JSON.stringify(snapshot, null, 2)}`;
}

/**
 * Safe fallback ONLY when Gemini/OpenAI fail or keys are missing.
 * Natural PT-BR, no keyword templates, no raw anomaly dumps.
 */
export function answerProfileDoubtLocally(
  _question: string,
  ctx: ProfileAssistantContext,
): string {
  const normalized = normalizeAssistantContext(ctx);
  if (!normalized) {
    return "Não consegui ler o perfil desta sessão agora. Tente de novo em instantes ou refaça o teste para gerar um resultado completo.";
  }
  const { result, participantName } = normalized;
  const name = participantName.trim() || "Participante";
  const ci = result.confidenceMargin ?? result.marginOfError;
  const label = result.cognitiveProfile?.label || "perfil desta sessão";
  return `${name}, a IA conversacional está temporariamente indisponível. Pelo painel desta sessão: QI estimado ${result.iq} (±${ci}), perfil "${label}". Quando a conexão voltar, pergunte de novo sobre forças, o que treinar ou como interpretar o resultado — sem precisar repetir a pergunta com palavras-chave.`;
}

export const PROFILE_ASSISTANT_SUGGESTIONS = [
  "O que brilha no meu perfil?",
  "Como posso melhorar na próxima sessão?",
  "O que meu QI e o percentil querem dizer?",
  "Como estou no ranking local?",
] as const;
