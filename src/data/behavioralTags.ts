/** Behavioral tags collected from hybrid quiz options. */
export type BehavioralTag =
  | "hipercontrole"
  | "evitacao_conflito"
  | "excesso_autonomia"
  | "busca_aprovacao"
  | "paralisia_analitica"
  | "impulsividade_criativa"
  | "autossacrificio"
  | "confronto_direto"
  | "intensidade_emocional"
  | "pragmatismo_frio"
  | "otimismo_defensivo"
  | "fuga_compromisso"
  | "perfeccionismo"
  | "lealdade_excessiva"
  | "humor_como_escudo"
  | "visao_transformadora"
  | "necessidade_ordem"
  | "rebeldia_reativa"
  | "cuidado_sem_limites"
  | "ambicao_silenciosa"
  | "dependencia_afetiva"
  | "heroismo_compulsivo"
  | "isolamento_estrategico"
  | "criatividade_procrastinada"
  /** Safe fallbacks for free-text (5th option) answers */
  | "ambiguidade_situacional"
  | "resposta_unica_pessoal";

export const TAG_LABELS: Record<BehavioralTag, string> = {
  hipercontrole: "hipercontrole",
  evitacao_conflito: "evitação de conflito",
  excesso_autonomia: "excesso de autonomia",
  busca_aprovacao: "busca de aprovação",
  paralisia_analitica: "paralisia analítica",
  impulsividade_criativa: "impulsividade criativa",
  autossacrificio: "autossacrifício",
  confronto_direto: "confronto direto",
  intensidade_emocional: "intensidade emocional",
  pragmatismo_frio: "pragmatismo frio",
  otimismo_defensivo: "otimismo defensivo",
  fuga_compromisso: "fuga de compromisso",
  perfeccionismo: "perfeccionismo",
  lealdade_excessiva: "lealdade excessiva",
  humor_como_escudo: "humor como escudo",
  visao_transformadora: "visão transformadora",
  necessidade_ordem: "necessidade de ordem",
  rebeldia_reativa: "rebeldia reativa",
  cuidado_sem_limites: "cuidado sem limites",
  ambicao_silenciosa: "ambição silenciosa",
  dependencia_afetiva: "dependência afetiva",
  heroismo_compulsivo: "heroísmo compulsivo",
  isolamento_estrategico: "isolamento estratégico",
  criatividade_procrastinada: "criatividade procrastinada",
  ambiguidade_situacional: "ambiguidade situacional",
  resposta_unica_pessoal: "resposta única pessoal",
};

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag as BehavioralTag] ?? tag.replace(/_/g, " ");
}
