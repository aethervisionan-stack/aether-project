import { indexLabel } from "@/src/lib/chcCatalog";
import { MODE_META, type IqResult } from "@/src/types/quiz";

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

export const PROFILE_ASSISTANT_DISCLAIMER =
  "Este assistente explica apenas os números desta sessão. Não é aconselhamento clínico, diagnóstico psicológico nem orientação médica.";

const SYSTEM_GUIDANCE_PT = `Você é um assistente educacional do Teste de QI (app Aether).
Responda SOMENTE com base no JSON de resultado (IqResult) e no ranking local fornecidos.
Regras:
- Idioma: português do Brasil, tom claro e direto.
- Cite números concretos do perfil (QI, IC, percentil, índices, forças/fraquezas, anomalias, consistência, ranking).
- NÃO invente dados ausentes do JSON.
- NÃO faça diagnósticos clínicos, patologize, prescreva tratamento ou afirme transtornos.
- Se a pergunta for clínica/médica, recuse e lembre o disclaimer.
- Se a pergunta não couber no perfil, diga o que o painel cobre e convide a perguntar sobre QI, índices, forças, anomalias ou ranking.
- Respostas curtas (2–5 frases), sem markdown excessivo.`;

/** Compact snapshot sent to the optional LLM — no item-level answers. */
export function buildGroundedSnapshot(ctx: ProfileAssistantContext) {
  const { result, participantName, rank, rankTotal } = ctx;
  const ci = result.confidenceMargin ?? result.marginOfError;
  return {
    nome: participantName || "Participante",
    modo: MODE_META[result.mode]?.label ?? result.mode,
    qi: result.iq,
    intervaloConfianca: { low: result.iqLow, high: result.iqHigh, meiaLargura: ci },
    percentil: result.percentile,
    faixa: result.band,
    consistencia: result.consistencyScore,
    perfil: {
      forma: result.cognitiveProfile.shape,
      rotulo: result.cognitiveProfile.label,
      detalhe: result.cognitiveProfile.detail,
      amplitude: result.cognitiveProfile.spread,
      forcas: result.cognitiveProfile.strengths.map((s) => ({
        id: s.id,
        label: s.label,
        score: s.score,
      })),
      aDesenvolver: result.cognitiveProfile.improvements.map((s) => ({
        id: s.id,
        label: s.label,
        score: s.score,
      })),
    },
    indices: result.indexScores.map((ix) => ({
      id: ix.id,
      label: indexLabel(ix.id),
      score: ix.score,
      qiAprox: ix.iqApprox,
      descriptor: ix.descriptor,
      respondidos: `${ix.answered}/${ix.total}`,
    })),
    anomalias: {
      count: result.anomalies.count,
      impactoMargem: result.anomalies.totalImpact,
      hits: result.anomalies.hits.map((h) => ({
        kind: h.kind,
        label: h.label,
        detail: h.detail,
        marginImpact: h.marginImpact,
      })),
    },
    rankingLocal:
      rank != null
        ? { lugar: rank, total: rankTotal }
        : { lugar: null, total: rankTotal, nota: "Sem entrada de ranking nesta sessão." },
    diagnosticoSessao: {
      timedOut: result.diagnosis.timedOut,
      answeredInTime: result.diagnosis.answeredInTime,
      guessingFlag: result.diagnosis.guessingFlag,
      incompleteFlag: result.diagnosis.incompleteFlag,
      inconsistentFlag: result.diagnosis.inconsistentFlag,
      warnings: result.diagnosis.warnings.slice(0, 6),
    },
  };
}

export function buildProfileAssistantSystemPrompt(
  ctx: ProfileAssistantContext,
): string {
  const snapshot = buildGroundedSnapshot(ctx);
  return `${SYSTEM_GUIDANCE_PT}

Disclaimer obrigatório (mencione se a pergunta for clínica): ${PROFILE_ASSISTANT_DISCLAIMER}

JSON do perfil (única fonte de verdade):
${JSON.stringify(snapshot, null, 2)}`;
}

function norm(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function looksClinical(q: string): boolean {
  const n = norm(q);
  return /\b(diagnost|transtorno|doenca|doença|tdah|autis|depress|ansied|medic|psiquiat|psicolog|clinico|clínico|tratamento|terapia|laudo)\b/.test(
    n,
  );
}

function listStrengths(ctx: ProfileAssistantContext): string {
  const s = ctx.result.cognitiveProfile.strengths;
  if (!s.length) return "Nenhum ponto forte destacado nesta sessão.";
  return s.map((x) => `${x.label} (${x.score}%)`).join("; ");
}

function listImprovements(ctx: ProfileAssistantContext): string {
  const s = ctx.result.cognitiveProfile.improvements;
  if (!s.length) return "Nenhum ponto a desenvolver destacado nesta sessão.";
  return s.map((x) => `${x.label} (${x.score}%)`).join("; ");
}

function listIndices(ctx: ProfileAssistantContext): string {
  return ctx.result.indexScores
    .map(
      (ix) =>
        `${indexLabel(ix.id)}: ${ix.score}% (QI≈${ix.iqApprox}, ${ix.descriptor})`,
    )
    .join("; ");
}

function listAnomalies(ctx: ProfileAssistantContext): string {
  const a = ctx.result.anomalies;
  if (a.count === 0) {
    return "Nenhuma anomalia comportamental foi marcada nesta sessão.";
  }
  const hits = a.hits
    .map((h) => `${h.label} (+${h.marginImpact} na margem): ${h.detail}`)
    .join(" ");
  return `${a.count} anomalia(s), impacto aproximado +${a.totalImpact} na margem. ${hits}`;
}

function rankLine(ctx: ProfileAssistantContext): string {
  if (ctx.rank == null) {
    return `Não há posição de ranking registrada para esta sessão (total local: ${ctx.rankTotal}).`;
  }
  return `Você está em #${ctx.rank} entre ${ctx.rankTotal} resultado(s) neste navegador.`;
}

/** Offline grounded replies — answers only from IqResult + ranking. */
export function answerProfileDoubtLocally(
  question: string,
  ctx: ProfileAssistantContext,
): string {
  const q = question.trim();
  if (!q) {
    return "Faça uma pergunta sobre seu QI, índices, forças, anomalias ou ranking.";
  }

  if (looksClinical(q)) {
    return `Não posso oferecer interpretação clínica nem diagnóstico. ${PROFILE_ASSISTANT_DISCLAIMER} Posso explicar os números desta sessão: QI, índices, forças/fraquezas, anomalias e ranking.`;
  }

  const n = norm(q);
  const r = ctx.result;
  const ci = r.confidenceMargin ?? r.marginOfError;
  const name = ctx.participantName?.trim() || "Participante";

  if (
    /\b(qi|qi estimado|score|pontuacao|pontuação|nota|resultado geral|meu resultado)\b/.test(
      n,
    ) ||
    /\biq\b/.test(n)
  ) {
    return `${name}, seu QI estimado nesta sessão é ${r.iq} (±${ci}), intervalo aproximado ${r.iqLow}–${r.iqHigh}, na faixa "${r.band}". Percentil ${r.percentile.toFixed(1)}. ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (/\b(percentil|raridade|populacao|população)\b/.test(n)) {
    return `Seu percentil é ${r.percentile.toFixed(1)} (faixa "${r.band}"). Isso descreve a posição relativa estimada nesta escala 100/15 da sessão — não um laudo. ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (/\b(indice|índice|indices|índices|chc|verbal|fluido|espacial|memoria|memória|velocidade|reacao|reação)\b/.test(n)) {
    return `Índices desta sessão: ${listIndices(ctx)}. Perfil: ${r.cognitiveProfile.label}. ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (/\b(forca|força|forte|destaque|brilho|melhor)\b/.test(n)) {
    return `Pontos fortes no perfil: ${listStrengths(ctx)}. ${r.cognitiveProfile.detail} ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (
    /\b(fraco|fraqueza|melhorar|desenvolver|ponto a|limitacao|limitação|pior)\b/.test(
      n,
    )
  ) {
    return `Pontos a desenvolver nesta sessão: ${listImprovements(ctx)}. São diferenças relativas entre índices desta bateria, não um diagnóstico. ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (/\b(anomalia|anomalias|chute|impulso|hesit|erratic|incomplet)\b/.test(n)) {
    return `${listAnomalies(ctx)} Consistência da sessão: ${r.consistencyScore}/100. ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (/\b(ranking|rank|lugar|posicao|posição|classificacao|classificação|leaderboard|colocacao|colocação)\b/.test(n)) {
    return `${rankLine(ctx)} O ranking é local neste navegador e usa o QI IRT da sessão. ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (/\b(consistencia|consistência|confiabilidade|sessao|sessão)\b/.test(n)) {
    const flags = [
      r.diagnosis.guessingFlag ? "sinal de chute/impulso" : null,
      r.diagnosis.incompleteFlag ? "sessão incompleta" : null,
      r.diagnosis.inconsistentFlag ? "padrão inconsistente" : null,
      r.diagnosis.timedOut ? "tempo esgotado" : null,
    ].filter(Boolean);
    const flagTxt = flags.length
      ? ` Alertas: ${flags.join("; ")}.`
      : " Sem alertas graves de consistência.";
    return `Consistência ${r.consistencyScore}/100.${flagTxt} ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  if (/\b(perfil|resumo|overview|explique|explicar|duvida|dúvida|ajuda|o que significa)\b/.test(n)) {
    return `${name}: QI ${r.iq} (±${ci}), percentil ${r.percentile.toFixed(1)}, perfil "${r.cognitiveProfile.label}". Forças: ${listStrengths(ctx)}. A desenvolver: ${listImprovements(ctx)}. ${rankLine(ctx)} ${PROFILE_ASSISTANT_DISCLAIMER}`;
  }

  return `Posso responder só com base no seu IqResult desta sessão. Pergunte sobre QI, percentil, índices, forças/fraquezas, anomalias, consistência ou ranking. Resumo rápido: QI ${r.iq} (±${ci}), ${r.cognitiveProfile.label}. ${PROFILE_ASSISTANT_DISCLAIMER}`;
}

export const PROFILE_ASSISTANT_SUGGESTIONS = [
  "O que meu QI significa nesta sessão?",
  "Quais são meus pontos fortes?",
  "Onde estão as anomalias?",
  "Qual é minha posição no ranking?",
] as const;
