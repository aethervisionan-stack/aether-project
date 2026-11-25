import {
  ARCHETYPES,
  joinPt,
  type ArchetypeId,
  type ArchetypeProfile,
  type ChoiceRecord,
  type NarrativeResult,
} from "./archetypes";
import { TAG_LABELS, type BehavioralTag } from "./behavioralTags";

export type ConfluenceMode = "potencializa" | "equilibra" | "tensiona";

export type DiagnosisReport = {
  dominant: ArchetypeProfile;
  sub: ArchetypeProfile;
  dominantPct: number;
  secondaryPct: number;
  confluenceMode: ConfluenceMode;
  confluenceTitle: string;
  confluenceText: string;
  mirror: string;
  strengths: string;
  weaknesses: string;
  shadow: string;
  integrationSteps: [string, string, string];
  topTags: { tag: BehavioralTag; count: number; label: string }[];
  choiceSummaries: string[];
};

const TENSION_PAIRS: Array<[ArchetypeId, ArchetypeId]> = [
  ["governante", "rebelde"],
  ["governante", "explorador"],
  ["heroi", "cuidador"],
  ["heroi", "inocente"],
  ["sabio", "amante"],
  ["sabio", "bobo_da_corte"],
  ["criador", "pessoa_comum"],
  ["mago", "inocente"],
  ["explorador", "cuidador"],
  ["rebelde", "inocente"],
  ["amante", "governante"],
  ["bobo_da_corte", "governante"],
];

function pairKey(a: ArchetypeId, b: ArchetypeId): string {
  return [a, b].sort().join("|");
}

const TENSION_SET = new Set(TENSION_PAIRS.map(([a, b]) => pairKey(a, b)));

export function resolveConfluenceMode(
  dominant: ArchetypeId,
  sub: ArchetypeId,
): ConfluenceMode {
  if (dominant === sub) return "potencializa";
  if (TENSION_SET.has(pairKey(dominant, sub))) return "tensiona";
  const g1 = ARCHETYPES[dominant].grupo;
  const g2 = ARCHETYPES[sub].grupo;
  if (g1 === g2) return "potencializa";
  return "equilibra";
}

function confluenceTitleFor(
  dominant: ArchetypeProfile,
  sub: ArchetypeProfile,
  mode: ConfluenceMode,
): string {
  const base = `${dominant.title.replace(/^O |^A /, "")}–${sub.title.replace(/^O |^A /, "")}`;
  if (mode === "potencializa") return `Confluência ${base}: Ressonância Intensificada`;
  if (mode === "tensiona") return `Confluência ${base}: Polaridade Criativa`;
  return `Confluência ${base}: Equilíbrio Dinâmico`;
}

function confluenceParagraph(
  dominant: ArchetypeProfile,
  sub: ArchetypeProfile,
  mode: ConfluenceMode,
  dominantPct: number,
  secondaryPct: number,
): string {
  const d = dominant.title;
  const s = sub.title;
  if (mode === "potencializa") {
    return `${d} (${dominantPct}%) e ${s} (${secondaryPct}%) pertencem à mesma gravitação interior — ${dominant.grupo.toLowerCase()}. Juntos, eles potencializam ${dominant.traitKeyword} e ${sub.traitKeyword}: o desejo de “${dominant.desejo}” ganha reforço de “${sub.desejo}”. O risco é ecoar o mesmo padrão em volume alto, sem contrapeso externo.`;
  }
  if (mode === "tensiona") {
    return `${d} (${dominantPct}%) e ${s} (${secondaryPct}%) puxam cordas opostas. Enquanto ${d} insiste em ${dominant.traitKeyword}, ${s} exige ${sub.traitKeyword}. Essa tensão não é defeito: é o motor do seu perfil — desde que você nomeie o conflito em vez de viver oscilando entre os extremos (${dominant.typicalTrap} versus o polo de ${s}).`;
  }
  return `${d} (${dominantPct}%) opera como eixo; ${s} (${secondaryPct}%) funciona como contrapeso. Você ${sub.balanceBenefit}. Na prática, ${d} define a direção (“${dominant.desejo}”) e ${s} impede que você vire ${dominant.typicalTrap}.`;
}

function topTagsFrom(
  tagCounts: Partial<Record<BehavioralTag, number>>,
  limit = 5,
): DiagnosisReport["topTags"] {
  return (Object.entries(tagCounts) as [BehavioralTag, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({
      tag,
      count,
      label: TAG_LABELS[tag] ?? tag,
    }));
}

function customExcerpts(choices: ChoiceRecord[], limit = 2): string[] {
  return choices
    .filter((c) => c.isCustom && c.customText && c.customText.trim().length >= 15)
    .map((c) => {
      const t = c.customText!.replace(/\s+/g, " ").trim();
      const cut = t.slice(0, 110).trim();
      return t.length > 110 ? `${cut}…` : cut;
    })
    .slice(0, limit);
}

function mirrorFromChoices(
  choices: ChoiceRecord[],
  tags: DiagnosisReport["topTags"],
): string {
  if (choices.length === 0) {
    return "Ainda não há escolhas suficientes para espelhar padrões.";
  }

  const summaries = choices.map((c) => c.summary);
  const pick = (idxs: number[]) =>
    idxs
      .filter((i) => i < summaries.length)
      .map((i) => summaries[i])
      .filter(Boolean);

  // Sample across axes: early pressure, mid power/bonds, late ambition
  const highlighted = pick([0, 1, 4, 8, 12, 15]);
  const unique = [...new Set(highlighted.length >= 3 ? highlighted : summaries.slice(0, 6))];

  const tagPhrase =
    tags.length > 0
      ? ` Os padrões que mais se repetiram nas suas 16 respostas foram: ${joinPt(
          tags.slice(0, 4).map((t) => t.label),
        )}.`
      : "";

  const customs = customExcerpts(choices, 2);
  const customPhrase =
    customs.length > 0
      ? ` Nas suas palavras livres, você deixou ver: ${joinPt(
          customs.map((t) => `“${t}”`),
        )}.`
      : "";

  return `Nas situações de crise, poder, vínculo e ambição, suas escolhas revelam alguém que ${joinPt(
    unique.slice(0, 4),
  )}.${tagPhrase}${customPhrase} Esse espelho não é um julgamento moral — é o mapa do que você já faz quando a máscara social cai.`;
}

function strengthsText(
  dominant: ArchetypeProfile,
  sub: ArchetypeProfile,
  tags: DiagnosisReport["topTags"],
  choices: ChoiceRecord[] = [],
): string {
  const positiveHints: Partial<Record<BehavioralTag, string>> = {
    confronto_direto: "capacidade de nomear o elefante na sala",
    visao_transformadora: "olho para mudanças de sistema, não só de sintoma",
    pragmatismo_frio: "lucidez sob pressão emocional",
    impulsividade_criativa: "velocidade para prototipar o novo",
    heroismo_compulsivo: "disposição de carregar o peso quando ninguém quer",
    cuidado_sem_limites: "radar agudo para a dor alheia",
    necessidade_ordem: "talento para estabilizar o caos",
    intensidade_emocional: "presença que faz o outro se sentir vivo",
    excesso_autonomia: "autossuficiência que desbloqueia caminhos",
    lealdade_excessiva: "confiabilidade rara em tempos líquidos",
    resposta_unica_pessoal: "coragem de nomear o próprio impulso sem menu pronto",
  };

  const fromTags = tags
    .map((t) => positiveHints[t.tag])
    .filter(Boolean)
    .slice(0, 3) as string[];

  const customs = customExcerpts(choices, 1);
  const customBoost =
    customs.length > 0
      ? ` Sua resposta livre reforça essa luz: “${customs[0]}”.`
      : "";

  const core = `A luz da união ${dominant.title} + ${sub.title} aparece quando você combina ${dominant.forcas.toLowerCase()} com o toque de ${sub.traitKeyword}. ${dominant.modificador} Ao mesmo tempo, ${sub.modificador}`;

  if (fromTags.length === 0) {
    return `${core} Na prática, isso vira força operacional — não só ideal.${customBoost}`;
  }
  return `${core} Nos seus padrões recentes, brilham especialmente: ${joinPt(fromTags)}.${customBoost}`;
}

function weaknessesText(
  dominant: ArchetypeProfile,
  sub: ArchetypeProfile,
  tags: DiagnosisReport["topTags"],
  choices: ChoiceRecord[],
): string {
  const trapHints: Partial<Record<BehavioralTag, string>> = {
    hipercontrole: "asfixixar pessoas e processos até matar a vitalidade",
    evitacao_conflito: "engolir verdades até o corpo protestar",
    excesso_autonomia: "romper vínculos no momento em que eles pedem raiz",
    busca_aprovacao: "terceirizar o direito de desejar",
    paralisia_analitica: "perder a janela de ação em nome de certeza impossível",
    impulsividade_criativa: "abrir frentes demais e entregar de menos",
    autossacrificio: "sumir de si para não parecer egoísta",
    perfeccionismo: "nunca lançar o que já seria suficiente",
    dependencia_afetiva: "confundir intensidade com segurança",
    humor_como_escudo: "rir para não sentir o que precisa ser sentido",
    rebeldia_reativa: "quebrar o jogo quando a conquista fica perto",
    heroismo_compulsivo: "provar valor até a exaustão",
    fuga_compromisso: "sumir quando a intimidade pede constância",
    criatividade_procrastinada: "cultuar o potencial inacabado",
    otimismo_defensivo: "negar a gravidade até ela crescer",
    ambiguidade_situacional: "hesitar tanto que a janela de ação fecha sozinha",
  };

  const fromTags = tags
    .map((t) => trapHints[t.tag])
    .filter(Boolean)
    .slice(0, 3) as string[];

  const late = choices.filter((c) => c.axis === 4).map((c) => c.summary);
  const sabotageHint =
    late.length > 0
      ? ` No eixo de ambição, você mesmo apontou: ${joinPt(late.slice(0, 2))}.`
      : "";

  const customLate = customExcerpts(
    choices.filter((c) => c.isCustom && (c.axis === 3 || c.axis === 4)),
    1,
  );
  const customTrap =
    customLate.length > 0
      ? ` Na sua linguagem espontânea, o gatilho ecoa em: “${customLate[0]}”.`
      : "";

  const base = `Os gatilhos de autossabotagem nascem do excesso de ${dominant.traitKeyword} sem a integração madura de ${sub.traitKeyword}. O medo central de ${dominant.title} (“${dominant.medo}”) encontra eco em ${sub.title} (“${sub.medo}”).`;

  if (fromTags.length === 0) {
    return `${base}${sabotageHint}${customTrap}`;
  }
  return `${base} Pelas suas escolhas, o risco concreto é ${joinPt(fromTags)}.${sabotageHint}${customTrap}`;
}

function shadowAndSteps(
  dominant: ArchetypeProfile,
  sub: ArchetypeProfile,
  tags: DiagnosisReport["topTags"],
  choices: ChoiceRecord[] = [],
): { shadow: string; steps: [string, string, string] } {
  const leadTag = tags[0]?.tag;
  const customShadow = customExcerpts(choices, 1);

  const shadow =
    `A sombra deste perfil não é “ser ${dominant.title}” — é operar ${dominant.sombra.toLowerCase()} sem perceber, enquanto ${sub.title} tenta compensar por baixo do pano. ` +
    `O mecanismo inconsciente: quando ${dominant.medo.toLowerCase()} se ativa, você reforça ${dominant.traitKeyword} e silencia o antídoto que ${sub.title} oferece (${sub.balanceBenefit}).` +
    (leadTag
      ? ` O sintoma mais visível nas suas respostas foi o padrão de ${TAG_LABELS[leadTag]}.`
      : "") +
    (customShadow.length > 0
      ? ` No que você escreveu com as próprias palavras, a sombra já assoma: “${customShadow[0]}”.`
      : "");

  const stepByDominant: Record<ArchetypeId, [string, string, string]> = {
    inocente: [
      "Durante 7 dias, nomeie por escrito um risco real que você estava suavizando — sem otimismo automático.",
      "Peça a uma pessoa de confiança um ‘feedback sem anestesia’ e escute 3 minutos sem se defender.",
      `Use ${sub.title} como âncora: aja em uma microdecisão difícil hoje, mesmo sem garantia de que ‘vai dar certo’.`,
    ],
    explorador: [
      "Escolha um compromisso pequeno e cumpra-o por 14 dias sem renegociar a rota.",
      "Quando bater impulso de sumir, espere 24h e escreva o que você está evitando sentir.",
      `Integre ${sub.title}: traduza liberdade em experimento com início, meio e fim — não só partida.`,
    ],
    sabio: [
      "Defina um prazo para decidir com 70% de informação; publique a decisão sem mais pesquisa.",
      "Em uma conversa emocional, responda primeiro com uma frase de acolhimento antes de qualquer análise.",
      `Deixe ${sub.title} puxar o corpo: uma ação física concreta no mundo, sem novo framework.`,
    ],
    heroi: [
      "Liste batalhas atuais e abandone uma que só serve para provar valor.",
      "Peça ajuda em algo que você ‘aguentaria sozinho’ — pratique receber sem retribuir na hora.",
      `Canalize ${sub.title}: escolha estratégia e recuperação, não só coragem bruta.`,
    ],
    rebelde: [
      "Antes de romper um sistema, escreva o que você construiria no lugar — se não houver resposta, pause 48h.",
      "Pratique um ‘não’ limpo sem discurso revolucionário; só limite claro.",
      `Deixe ${sub.title} ensinar continuidade: mantenha uma estrutura mínima por 21 dias.`,
    ],
    mago: [
      "Escolha uma transformação e traduza em 3 passos observáveis nesta semana — sem metáfora.",
      "Peça a alguém afetado pela sua visão um impacto concreto (positivo ou colateral).",
      `Use ${sub.title} para aterrar: entregue um protótipo imperfeito antes do ‘grande reset’.`,
    ],
    pessoa_comum: [
      "Diga em voz alta um desejo próprio que você vinha disfarçando de ‘o que o grupo quer’.",
      "Aceite um elogio sem minimizar; fique 10 segundos no desconforto de ser visto.",
      `Ative ${sub.title}: ocupe um lugar de diferença consciente sem pedir permissão a todos.`,
    ],
    amante: [
      "Separe desejo de urgência: espere 24h antes de buscar reparação afetiva impulsiva.",
      "Cultive uma hora de prazer solitário (arte, corpo, beleza) sem audiência.",
      `Deixe ${sub.title} trazer eixo: intimidade com soberania, não fusão.`,
    ],
    bobo_da_corte: [
      "Quando vier o impulso de ironizar, diga a emoção real em uma frase sem piada.",
      "Escolha uma responsabilidade ‘chata’ e execute-a com presença — sem alívio cômico.",
      `Integre ${sub.title}: use leveza como tempero, não como fuga do legado.`,
    ],
    cuidador: [
      "Pratique um ‘não’ generoso por dia; registre a culpa sem obedecer a ela.",
      "Peça cuidado concreto a alguém (tempo, escuta, tarefa) e receba sem retribuir imediatamente.",
      `Deixe ${sub.title} lembrar: sua vida também é território a proteger.`,
    ],
    criador: [
      "Lance uma versão 0.9 esta semana com critério de ‘bom o bastante’ definido a priori.",
      "Limite projetos ativos a três; archive o resto por 30 dias.",
      `Use ${sub.title} para fechar ciclos: acabamento e presença no mundo > potencial infinito.`,
    ],
    governante: [
      "Delegue uma decisão inteira (não só a execução) e não retome o controle por 7 dias.",
      "Pergunte à equipe: ‘onde meu controle atrapalha?’ — escute sem justificar.",
      `Integre ${sub.title}: troque micromanagement por visão e confiança calibrada.`,
    ],
  };

  // Soft-adjust first step if a strong tag is present
  const steps = [...stepByDominant[dominant.id]] as [string, string, string];
  if (leadTag === "paralisia_analitica") {
    steps[0] =
      "Hoje, tome uma decisão de médio impacto com no máximo 30 minutos de análise — e comunique-a.";
  } else if (leadTag === "autossacrificio" || leadTag === "cuidado_sem_limites") {
    steps[0] =
      "Bloqueie 45 minutos na agenda só para você nesta semana e trate como compromisso inegociável.";
  } else if (leadTag === "hipercontrole" || leadTag === "necessidade_ordem") {
    steps[0] =
      "Solte o controle de um processo visível por 72h e observe o que o sistema resolve sem você.";
  } else if (leadTag === "fuga_compromisso" || leadTag === "excesso_autonomia") {
    steps[0] =
      "Assuma um compromisso público pequeno e cumpra a data — sem renegociar a rota.";
  }

  return { shadow, steps };
}

/**
 * Dynamic diagnosis crossing dominant + sub + real choice tags/summaries.
 */
export function buildDiagnosis(result: NarrativeResult): DiagnosisReport {
  const dominant = result.primary;
  const sub =
    result.secondaryProfile ??
    result.secondaries[0]?.profile ??
    (result.dominants[1]?.profile ?? dominant);

  const mode = resolveConfluenceMode(dominant.id, sub.id);
  const tags = topTagsFrom(result.tagCounts);
  const { shadow, steps } = shadowAndSteps(
    dominant,
    sub,
    tags,
    result.choices,
  );
  const choiceSummaries = result.choices.map((c) => c.summary);

  return {
    dominant,
    sub,
    dominantPct: result.dominantPct,
    secondaryPct: result.secondaryPct,
    confluenceMode: mode,
    confluenceTitle: confluenceTitleFor(dominant, sub, mode),
    confluenceText: confluenceParagraph(
      dominant,
      sub,
      mode,
      result.dominantPct,
      result.secondaryPct,
    ),
    mirror: mirrorFromChoices(result.choices, tags),
    strengths: strengthsText(dominant, sub, tags, result.choices),
    weaknesses: weaknessesText(dominant, sub, tags, result.choices),
    shadow,
    integrationSteps: steps,
    topTags: tags,
    choiceSummaries,
  };
}

export function formatDiagnosisShareText(
  result: NarrativeResult,
  diagnosis: DiagnosisReport,
): string {
  const lines: string[] = [
    diagnosis.confluenceTitle,
    diagnosis.confluenceText,
    "",
    "Espelho das Suas Escolhas",
    diagnosis.mirror,
    "",
    "Pontos Fortes (Sua Luz em Ação)",
    diagnosis.strengths,
    "",
    "Pontos Fracos (Gatilhos de Autossabotagem)",
    diagnosis.weaknesses,
    "",
    "A Sombra",
    diagnosis.shadow,
    "",
    "3 Passos de Integração",
    ...diagnosis.integrationSteps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Faça o teste: Descubra o Seu Arquétipo Dominante",
  ];
  return lines.join("\n");
}
