/**
 * Catálogo CHC-inspirado (6 índices + subtestes) — rótulos 100% originais em PT-BR.
 * Não copia manuais clínicos; nomes e descritores são autoria própria do produto.
 */
import type {
  CognitiveIndexId,
  SubtestId,
} from "@/src/types/quiz";

export interface SubtestMeta {
  id: SubtestId;
  index: CognitiveIndexId;
  label: string;
  short: string;
  help: string;
}

export interface IndexMeta {
  id: CognitiveIndexId;
  label: string;
  short: string;
  help: string;
  subtests: SubtestId[];
}

export const INDEX_ORDER: CognitiveIndexId[] = [
  "verbal",
  "fluido",
  "espacial",
  "memoria_trabalho",
  "velocidade_processamento",
  "tempo_reacao",
];

export const SUBTEST_META: Record<SubtestId, SubtestMeta> = {
  vocabulario: {
    id: "vocabulario",
    index: "verbal",
    label: "Vocabulário preciso",
    short: "Vocabulário",
    help: "Escolher o sentido mais fiel de uma palavra ou expressão no contexto dado.",
  },
  analogias_verbais: {
    id: "analogias_verbais",
    index: "verbal",
    label: "Analogias verbais",
    short: "Analogias",
    help: "Completar relações do tipo A está para B como C está para ?",
  },
  compreensao_verbal: {
    id: "compreensao_verbal",
    index: "verbal",
    label: "Compreensão de premissas",
    short: "Compreensão",
    help: "Ler enunciados e extrair o que necessariamente se segue — sem inventar premissas.",
  },
  matrizes_abstratas: {
    id: "matrizes_abstratas",
    index: "fluido",
    label: "Matrizes abstratas",
    short: "Matrizes",
    help: "Descobrir a regra visual que fecha a célula vazia de uma matriz 3×3.",
  },
  inducao_regras: {
    id: "inducao_regras",
    index: "fluido",
    label: "Indução de regras",
    short: "Indução",
    help: "Induzir a lei que governa uma série e aplicá-la ao próximo passo.",
  },
  sequencias_logicas: {
    id: "sequencias_logicas",
    index: "fluido",
    label: "Sequências lógicas",
    short: "Sequências",
    help: "Encadear operações ou transformações até a conclusão válida.",
  },
  rotacao_mental: {
    id: "rotacao_mental",
    index: "espacial",
    label: "Rotação mental",
    short: "Rotação",
    help: "Imaginar o giro de formas sem mover o objeto de verdade.",
  },
  visualizacao: {
    id: "visualizacao",
    index: "espacial",
    label: "Visualização espacial",
    short: "Visualização",
    help: "Montar ou decompor estruturas espaciais a partir de pistas parciais.",
  },
  completamento_espacial: {
    id: "completamento_espacial",
    index: "espacial",
    label: "Completamento espacial",
    short: "Completar",
    help: "Preencher a lacuna que respeita simetria, contagem ou posição no plano.",
  },
  span_digitos: {
    id: "span_digitos",
    index: "memoria_trabalho",
    label: "Span de dígitos",
    short: "Span",
    help: "Reter e manipular sequências curtas de números ou símbolos na mente.",
  },
  atualizacao_mental: {
    id: "atualizacao_mental",
    index: "memoria_trabalho",
    label: "Atualização mental",
    short: "Atualização",
    help: "Substituir informação antiga por nova sem perder o fio da operação.",
  },
  sequencia_reversa: {
    id: "sequencia_reversa",
    index: "memoria_trabalho",
    label: "Sequência reversa",
    short: "Reversa",
    help: "Repetir ou transformar uma série na ordem inversa à apresentada.",
  },
  busca_simbolos: {
    id: "busca_simbolos",
    index: "velocidade_processamento",
    label: "Busca de símbolos",
    short: "Busca",
    help: "Localizar rapidamente um alvo numa grade ou lista sem perder precisão.",
  },
  pareamento_rapido: {
    id: "pareamento_rapido",
    index: "velocidade_processamento",
    label: "Pareamento rápido",
    short: "Pareamento",
    help: "Decidir se dois padrões são iguais ou distintos sob pressão de tempo.",
  },
  codificacao: {
    id: "codificacao",
    index: "velocidade_processamento",
    label: "Codificação simbólica",
    short: "Código",
    help: "Aplicar uma legenda (código → símbolo) com ritmo constante e poucos erros.",
  },
  decisao_rapida: {
    id: "decisao_rapida",
    index: "tempo_reacao",
    label: "Decisão rápida",
    short: "Decisão",
    help: "Escolher a alternativa correta com latência curta, sem chute cego.",
  },
  julgamento_latencia: {
    id: "julgamento_latencia",
    index: "tempo_reacao",
    label: "Julgamento de latência",
    short: "Latência",
    help: "Calibrar quando responder: nem impulsivo demais, nem excessivamente lento.",
  },
  resposta_deliberada: {
    id: "resposta_deliberada",
    index: "tempo_reacao",
    label: "Resposta deliberada",
    short: "Deliberada",
    help: "Manter acerto mesmo quando o item pede comparação rápida de alternativas.",
  },
};

export const INDEX_META: Record<CognitiveIndexId, IndexMeta> = {
  verbal: {
    id: "verbal",
    label: "Verbal",
    short: "Verbal",
    help: "Linguagem, significado e inferência a partir de texto.",
    subtests: ["vocabulario", "analogias_verbais", "compreensao_verbal"],
  },
  fluido: {
    id: "fluido",
    label: "Raciocínio fluido",
    short: "Fluido",
    help: "Resolver problemas novos por indução de regras, sem depender de conhecimento escolar.",
    subtests: ["matrizes_abstratas", "inducao_regras", "sequencias_logicas"],
  },
  espacial: {
    id: "espacial",
    label: "Espacial",
    short: "Espacial",
    help: "Manipular formas e posições no espaço mental.",
    subtests: ["rotacao_mental", "visualizacao", "completamento_espacial"],
  },
  memoria_trabalho: {
    id: "memoria_trabalho",
    label: "Memória de trabalho",
    short: "Memória",
    help: "Reter, atualizar e reordenar informação enquanto resolve o item.",
    subtests: ["span_digitos", "atualizacao_mental", "sequencia_reversa"],
  },
  velocidade_processamento: {
    id: "velocidade_processamento",
    label: "Velocidade de processamento",
    short: "Velocidade",
    help: "Processar estímulos simples com rapidez e poucos erros de omissão.",
    subtests: ["busca_simbolos", "pareamento_rapido", "codificacao"],
  },
  tempo_reacao: {
    id: "tempo_reacao",
    label: "Tempo de reação",
    short: "Reação",
    help: "Latência de resposta útil — equilíbrio entre impulso e deliberação.",
    subtests: ["decisao_rapida", "julgamento_latencia", "resposta_deliberada"],
  },
};

export function indexLabel(id: CognitiveIndexId): string {
  return INDEX_META[id].label;
}

export function subtestLabel(id: SubtestId): string {
  return SUBTEST_META[id].label;
}

export function indexHelp(id: CognitiveIndexId): string {
  return INDEX_META[id].help;
}

export function subtestHelp(id: SubtestId): string {
  return SUBTEST_META[id].help;
}

/** Descritor qualitativo a partir de escore 0–100 (ou QI de índice). */
export function scoreDescriptor(score: number): string {
  if (!Number.isFinite(score)) return "Indeterminado";
  if (score >= 90) return "Muito elevado";
  if (score >= 75) return "Elevado";
  if (score >= 55) return "Adequado";
  if (score >= 35) return "Moderado";
  if (score >= 20) return "Em desenvolvimento";
  return "Frágil nesta sessão";
}
