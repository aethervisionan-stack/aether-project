/**
 * Heuristic analyzer for free-text (5th) quiz answers.
 * Infers primary/secondary archetype (+3/+1 parity with closed options),
 * behavioral tags, confidence, emotional tone and action stance.
 */

import type { ArchetypeId, AxisId } from "@/src/data/archetypes";
import type { BehavioralTag } from "@/src/data/behavioralTags";

export const CUSTOM_OPTION_ID = "__custom__";
export const CUSTOM_ANSWER_MIN_CHARS = 15;
export const CUSTOM_ANSWER_MAX_CHARS = 500;
export const CUSTOM_ANSWER_SOFT_MIN = 15;

export type EmotionalTone =
  | "calmo"
  | "ansioso"
  | "assertivo"
  | "vulneravel"
  | "ambivalente"
  | "neutro";

export type ActionStance =
  | "proativo"
  | "reativo"
  | "analitico"
  | "cuidativo"
  | "evasivo"
  | "criativo"
  | "indefinido";

export type CustomAnswerAnalysis = {
  custom_answer_text: string;
  question_id: string;
  eixo: AxisId;
  inferred_primary: ArchetypeId;
  inferred_secondary: ArchetypeId;
  confidence_score: number;
  detected_tags: BehavioralTag[];
  emotional_tone: EmotionalTone;
  action_stance: ActionStance;
};

type LexEntry = {
  weight: number;
  patterns: RegExp[];
};

const ARCHETYPE_LEXICON: Record<ArchetypeId, LexEntry> = {
  governante: {
    weight: 1,
    patterns: [
      /\b(comando|lider[oa]?|ordem|controlo?|organiz|deleg|estrutura|hierarquia|decidir|mando|autoridade|regras?\b.*\bdefinir)/i,
      /\b(assumo o comando|corto o debate|quem faz o qu[eê]|imponho)/i,
    ],
  },
  heroi: {
    weight: 1,
    patterns: [
      /\b(coragem|enfrento|batalha|lut[oa]|protejo|salvo|responso?abilidade|vence?r|hero[ií]|desafio|aguento)/i,
      /\b(não fujo|nao fujo|vou à frente|vou a frente|carreg[oa] o peso)/i,
    ],
  },
  sabio: {
    weight: 1,
    patterns: [
      /\b(analis|lógica|logica|estudo|pesquis|entend|clareza|raz[aã]o|dados?|mapeio|variáveis|variaveis|reflet)/i,
      /\b(preciso entender|antes de agir|pensar bem|avaliar)/i,
    ],
  },
  mago: {
    weight: 1,
    patterns: [
      /\b(transform|visão|visao|sistema|insight|mudan[cç]a|reinvent|símbolo|simbolo|padr[aã]o|estratégia|estrategia)/i,
      /\b(mudo o jogo|por trás|por tras|tabuleiro|reframe)/i,
    ],
  },
  rebelde: {
    weight: 1,
    patterns: [
      /\b(quebr[oa]|romp[eo]|protocolo|regra|improviso|atalho|insubordin|revolt|desafio a regra|não aceito|nao aceito)/i,
      /\b(contra o sistema|fora do script|do meu jeito)/i,
    ],
  },
  explorador: {
    weight: 1,
    patterns: [
      /\b(explor|liberdade|novo caminho|aventura|independ|descobr|rota|horizonte|viaj|fugir do conhecido)/i,
      /\b(preciso de espaço|preciso de espaco|sair da caixa|sem amarras)/i,
    ],
  },
  cuidador: {
    weight: 1,
    patterns: [
      /\b(cuid[oa]|acolh|apoio|suporte|protege?r quem|vulneráv|vulnerav|ajuda|conforto|escuta)/i,
      /\b(quem precisa|estar presente|abraç|abrac)/i,
    ],
  },
  amante: {
    weight: 1,
    patterns: [
      /\b(amor|intimidade|conexão|conexao|paixão|paixao|sentimento|coração|coracao|afet[oa]|desejo|beleza)/i,
      /\b(preciso de alguém|preciso de alguem|relação|relacao|vínculo|vinculo)/i,
    ],
  },
  criador: {
    weight: 1,
    patterns: [
      /\b(cri[oa]|invent|original|arte|design|express|vis[aã]o autoral|prototip|imaginar|inov)/i,
      /\b(do zero|algo novo|minha assinatura|obra)/i,
    ],
  },
  bobo_da_corte: {
    weight: 1,
    patterns: [
      /\b(piada|humor|rir|leveza|ironia|brinc|descontra|alegria|divers[aã]o|sarcasm)/i,
      /\b(faço uma graça|faco uma graca|desvio o clima|alivio)/i,
    ],
  },
  inocente: {
    weight: 1,
    patterns: [
      /\b(otimis|esperança|esperanca|fé|fe\b|confiança|confianca|simplicidade|bondade|inocên|inocen|vai dar certo)/i,
      /\b(olho o lado bom|acredito|positivo)/i,
    ],
  },
  pessoa_comum: {
    weight: 1,
    patterns: [
      /\b(grupo|comunidade|pertenc|simples|pés no ch[aã]o|pes no chao|humilde|igualdade|junto|coletiv|ordinár|ordinar)/i,
      /\b(sem holofote|como todo mundo|no time|pertencer)/i,
    ],
  },
};

const TAG_LEXICON: Array<{ tag: BehavioralTag; patterns: RegExp[] }> = [
  {
    tag: "hipercontrole",
    patterns: [/\b(controlo tudo|preciso controlar|não delego|nao delego|microger)/i],
  },
  {
    tag: "evitacao_conflito",
    patterns: [/\b(evito conflito|não enfrento|nao enfrento|fujo da briga|passo por cima)/i],
  },
  {
    tag: "excesso_autonomia",
    patterns: [/\b(sozinho|sozinha|não dependo|nao dependo|sem ninguém|sem ninguem)/i],
  },
  {
    tag: "busca_aprovacao",
    patterns: [/\b(aprovação|aprovacao|gostem de mim|reconhecimento|validação|validacao)/i],
  },
  {
    tag: "paralisia_analitica",
    patterns: [/\b(analiso demais|não consigo decidir|nao consigo decidir|preciso de mais dados|travo)/i],
  },
  {
    tag: "impulsividade_criativa",
    patterns: [/\b(no impulso|sem pensar|já faço|ja faco|saio fazendo)/i],
  },
  {
    tag: "autossacrificio",
    patterns: [/\b(me sacrifico|abro mão|abro mao|deixo de lado|em último|em ultimo)/i],
  },
  {
    tag: "confronto_direto",
    patterns: [/\b(enfrento de frente|falo na cara|confronto|não engulo|nao engulo)/i],
  },
  {
    tag: "intensidade_emocional",
    patterns: [/\b(sinto demais|muito intenso|emoção forte|emocao forte|coração aperta|coracao aperta)/i],
  },
  {
    tag: "pragmatismo_frio",
    patterns: [/\b(pragmático|pragmatico|frio|objetivo|sem drama|só o resultado|so o resultado)/i],
  },
  {
    tag: "otimismo_defensivo",
    patterns: [/\b(vai dar certo|não é tão grave|nao e tao grave|lado bom|nega)/i],
  },
  {
    tag: "fuga_compromisso",
    patterns: [/\b(não me prendo|nao me prendo|fujo de compromisso|sem amarras|sumo)/i],
  },
  {
    tag: "perfeccionismo",
    patterns: [/\b(perfeito|não está pronto|nao esta pronto|mais um detalhe|impecável|impecavel)/i],
  },
  {
    tag: "lealdade_excessiva",
    patterns: [/\b(lealdade|fiel demais|não abandono|nao abandono|pelo time)/i],
  },
  {
    tag: "humor_como_escudo",
    patterns: [/\b(faço piada|faco piada|rir para não|rir para nao|humor para)/i],
  },
  {
    tag: "visao_transformadora",
    patterns: [/\b(transformar o sistema|mudar o jogo|visão maior|visao maior)/i],
  },
  {
    tag: "necessidade_ordem",
    patterns: [/\b(preciso de ordem|organizar o caos|estruturar|sem bagunça|sem bagunca)/i],
  },
  {
    tag: "rebeldia_reativa",
    patterns: [/\b(quebro a regra|contra a regra|reajo|não obedeço|nao obedeço)/i],
  },
  {
    tag: "cuidado_sem_limites",
    patterns: [/\b(cuido demais|não sei dizer não|nao sei dizer nao|sempre disponível|sempre disponivel)/i],
  },
  {
    tag: "ambicao_silenciosa",
    patterns: [/\b(ambição|ambicao|quero subir|nos bastidores|silenciosamente)/i],
  },
  {
    tag: "dependencia_afetiva",
    patterns: [/\b(preciso de alguém|preciso de alguem|não aguento sozinho|nao aguento sozinho|fusão|fusao)/i],
  },
  {
    tag: "heroismo_compulsivo",
    patterns: [/\b(salvo todo mundo|tenho que aguentar|eu resolvo|provar valor)/i],
  },
  {
    tag: "isolamento_estrategico",
    patterns: [/\b(me isolo|observo de longe|recuo estratégico|recuo estrategico|silêncio|silencio)/i],
  },
  {
    tag: "criatividade_procrastinada",
    patterns: [/\b(depois eu crio|ainda não lancei|ainda nao lancei|ideia sem executar)/i],
  },
];

const TONE_PATTERNS: Array<{ tone: EmotionalTone; patterns: RegExp[] }> = [
  {
    tone: "ansioso",
    patterns: [/\b(ansioso|preocup|medo|aperto|nervos|insegur)/i],
  },
  {
    tone: "vulneravel",
    patterns: [/\b(ferido|dor|choro|exposto|frágil|fragil|precisava de)/i],
  },
  {
    tone: "assertivo",
    patterns: [/\b(decido|imponho|limpo|claro|direto|não hesito|nao hesito)/i],
  },
  {
    tone: "calmo",
    patterns: [/\b(calmo|tranquilo|sereno|pauso|respiro|com calma)/i],
  },
  {
    tone: "ambivalente",
    patterns: [/\b(ao mesmo tempo|por um lado|não sei bem|nao sei bem|misturado|conflito interno)/i],
  },
];

const STANCE_PATTERNS: Array<{ stance: ActionStance; patterns: RegExp[] }> = [
  {
    stance: "proativo",
    patterns: [/\b(tomo a frente|aj[oa]|inicio|provo[ck]|assumo)/i],
  },
  {
    stance: "analitico",
    patterns: [/\b(analis|penso|estudo|avali|mape)/i],
  },
  {
    stance: "cuidativo",
    patterns: [/\b(cuido|acolho|ajudo|protejo|escuto)/i],
  },
  {
    stance: "evasivo",
    patterns: [/\b(fujo|evito|recuo|sumo|adi[oa])/i],
  },
  {
    stance: "criativo",
    patterns: [/\b(crio|improviso|invento|reinvento|prototip)/i],
  },
  {
    stance: "reativo",
    patterns: [/\b(reajo|respondo|contra-atac|depois que)/i],
  },
];

const FALLBACK_PRIMARY: ArchetypeId = "pessoa_comum";
const FALLBACK_SECONDARY: ArchetypeId = "explorador";

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function scoreLexicon(
  text: string,
  lexicon: Record<ArchetypeId, LexEntry>,
): Record<ArchetypeId, number> {
  const scores = {} as Record<ArchetypeId, number>;
  for (const id of Object.keys(lexicon) as ArchetypeId[]) {
    let s = 0;
    for (const re of lexicon[id].patterns) {
      if (re.test(text)) s += lexicon[id].weight;
    }
    scores[id] = s;
  }
  return scores;
}

function detectTags(text: string): BehavioralTag[] {
  const found: BehavioralTag[] = [];
  for (const entry of TAG_LEXICON) {
    if (entry.patterns.some((re) => re.test(text))) {
      found.push(entry.tag);
    }
  }
  return found;
}

function detectTone(text: string): EmotionalTone {
  for (const entry of TONE_PATTERNS) {
    if (entry.patterns.some((re) => re.test(text))) return entry.tone;
  }
  return "neutro";
}

function detectStance(text: string): ActionStance {
  for (const entry of STANCE_PATTERNS) {
    if (entry.patterns.some((re) => re.test(text))) return entry.stance;
  }
  return "indefinido";
}

function rankArchetypes(
  scores: Record<ArchetypeId, number>,
): Array<{ id: ArchetypeId; score: number }> {
  return (Object.entries(scores) as [ArchetypeId, number][])
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * Analyze a free-text quiz answer for one question.
 * Short/ambiguous text → safe fallback tags without breaking typing.
 */
export function analyzeCustomAnswer(
  text: string,
  questionId: string,
  eixo: AxisId,
): CustomAnswerAnalysis {
  const custom_answer_text = normalizeText(text).slice(0, CUSTOM_ANSWER_MAX_CHARS);
  const len = custom_answer_text.length;

  if (len < CUSTOM_ANSWER_SOFT_MIN) {
    return {
      custom_answer_text,
      question_id: questionId,
      eixo,
      inferred_primary: FALLBACK_PRIMARY,
      inferred_secondary: FALLBACK_SECONDARY,
      confidence_score: 0.15,
      detected_tags: ["ambiguidade_situacional", "resposta_unica_pessoal"],
      emotional_tone: "neutro",
      action_stance: "indefinido",
    };
  }

  const archScores = scoreLexicon(custom_answer_text, ARCHETYPE_LEXICON);
  const ranked = rankArchetypes(archScores);
  const top = ranked[0];
  const second = ranked.find((r) => r.id !== top.id && r.score > 0) ?? ranked[1];

  const hitCount = ranked.filter((r) => r.score > 0).length;
  const ambiguous = top.score === 0 || (hitCount >= 3 && top.score === ranked[1]?.score);

  if (ambiguous) {
    const tags = detectTags(custom_answer_text);
    return {
      custom_answer_text,
      question_id: questionId,
      eixo,
      inferred_primary: FALLBACK_PRIMARY,
      inferred_secondary: FALLBACK_SECONDARY,
      confidence_score: top.score === 0 ? 0.25 : 0.35,
      detected_tags:
        tags.length > 0
          ? [...new Set([...tags, "ambiguidade_situacional" as BehavioralTag])].slice(0, 5)
          : ["ambiguidade_situacional", "resposta_unica_pessoal"],
      emotional_tone: detectTone(custom_answer_text),
      action_stance: detectStance(custom_answer_text),
    };
  }

  const primary = top.id;
  const secondary =
    second && second.id !== primary ? second.id : FALLBACK_SECONDARY === primary
      ? "sabio"
      : FALLBACK_SECONDARY;

  const rawConfidence = Math.min(1, 0.4 + top.score * 0.18 + (second?.score ?? 0) * 0.06);
  const lengthBoost = len >= 40 ? 0.08 : len >= 25 ? 0.04 : 0;
  const confidence_score = Math.round(Math.min(0.95, rawConfidence + lengthBoost) * 100) / 100;

  const tags = detectTags(custom_answer_text);
  if (tags.length === 0) {
    tags.push("resposta_unica_pessoal");
  }

  return {
    custom_answer_text,
    question_id: questionId,
    eixo,
    inferred_primary: primary,
    inferred_secondary: secondary,
    confidence_score,
    detected_tags: tags.slice(0, 5),
    emotional_tone: detectTone(custom_answer_text),
    action_stance: detectStance(custom_answer_text),
  };
}

export function isCustomOptionId(optionId: string | undefined): boolean {
  return optionId === CUSTOM_OPTION_ID;
}

export function customAnswerSummary(analysis: CustomAnswerAnalysis): string {
  const excerpt = analysis.custom_answer_text
    .replace(/\s+/g, " ")
    .slice(0, 90)
    .trim();
  const ellipsis = analysis.custom_answer_text.length > 90 ? "…" : "";
  if (!excerpt) {
    return "ofereceu uma resposta pessoal única nesta situação";
  }
  return `nas próprias palavras, descreveu: “${excerpt}${ellipsis}”`;
}

export function validateCustomAnswerText(text: string): {
  ok: boolean;
  trimmed: string;
  tooShort: boolean;
  empty: boolean;
} {
  const trimmed = normalizeText(text).slice(0, CUSTOM_ANSWER_MAX_CHARS);
  const empty = trimmed.length === 0;
  const tooShort = trimmed.length > 0 && trimmed.length < CUSTOM_ANSWER_SOFT_MIN;
  return {
    ok: trimmed.length >= CUSTOM_ANSWER_SOFT_MIN,
    trimmed,
    tooShort,
    empty,
  };
}
