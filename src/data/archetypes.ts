import type { BehavioralTag } from "./behavioralTags";

export type ArchetypeId =
  | "inocente"
  | "explorador"
  | "sabio"
  | "heroi"
  | "rebelde"
  | "mago"
  | "pessoa_comum"
  | "amante"
  | "bobo_da_corte"
  | "cuidador"
  | "criador"
  | "governante";

export type ArchetypeProfile = {
  id: ArchetypeId;
  title: string;
  subtitle: string;
  grupo: string;
  desejo: string;
  forcas: string;
  medo: string;
  sombra: string;
  modificador: string;
  dominantRole: string;
  subRole: string;
  traitKeyword: string;
  typicalTrap: string;
  balanceBenefit: string;
  /** Tailwind text/bg helpers for UI chips */
  colorClass: string;
  /** Hex for charts */
  accent: string;
  /** Portrait card under public/images/archetypes */
  image: string;
};

export type QuestionOption = {
  id: string;
  letter: "A" | "B" | "C" | "D";
  text: string;
  /** +3 points */
  primary: ArchetypeId;
  /** +1 point */
  secondary: ArchetypeId;
  tags: BehavioralTag[];
  /** Short human summary of the choice for diagnosis */
  summary: string;
};

export type AxisId = 1 | 2 | 3 | 4;

export type Question = {
  id: string;
  number: number;
  stage: AxisId;
  stageTitle: string;
  text: string;
  options: QuestionOption[];
};

export const ARCHETYPE_ORDER: ArchetypeId[] = [
  "inocente",
  "explorador",
  "sabio",
  "heroi",
  "rebelde",
  "mago",
  "pessoa_comum",
  "amante",
  "bobo_da_corte",
  "cuidador",
  "criador",
  "governante",
];

export const ARCHETYPES: Record<ArchetypeId, ArchetypeProfile> = {
  inocente: {
    id: "inocente",
    title: "O Inocente",
    subtitle: "O Otimista Puro",
    grupo: "Buscar liberdade",
    desejo: "Segurança, felicidade e simplicidade",
    forcas: "Otimismo, fé, transparência, perdão",
    medo: "Fazer algo errado e perder a paz",
    sombra: "Ingenuidade excessiva e negação de problemas",
    modificador:
      "adiciona leveza, esperança e busca por soluções simples ao seu perfil.",
    dominantRole:
      "Arquétipo Dominante (sua busca por paz, ética e simplicidade)",
    subRole: "Sub-arquétipo de Harmonia (sua leveza e otimismo)",
    traitKeyword: "otimismo",
    typicalTrap: "um Inocente ingênuo diante dos problemas",
    balanceBenefit:
      "mantém a esperança, a transparência e a busca por soluções simples e éticas sem perder a leveza",
    colorClass: "text-amber-300 border-amber-400/40 bg-amber-400/10",
    accent: "#F5D76E",
    image: "/images/archetypes/inocente.jpg",
  },
  explorador: {
    id: "explorador",
    title: "O Explorador",
    subtitle: "O Desbravador Livre",
    grupo: "Buscar liberdade",
    desejo: "Liberdade para descobrir o mundo",
    forcas: "Autonomia, curiosidade, adaptabilidade",
    medo: "Ficar preso ou conformismo",
    sombra: "Dificuldade de criar raízes e fuga de compromissos",
    modificador: "traz sede de novidade, independência e aversão a rotinas.",
    dominantRole:
      "Arquétipo Dominante (sua busca por liberdade e autenticidade)",
    subRole: "Sub-arquétipo de Liberdade (sua curiosidade e independência)",
    traitKeyword: "liberdade",
    typicalTrap: "um Explorador inquieto que foge de compromissos",
    balanceBenefit:
      "impede que você fique preso em rotinas engessadas, trazendo sede de novidade e adaptação rápida",
    colorClass: "text-teal-300 border-teal-400/40 bg-teal-400/10",
    accent: "#2DD4BF",
    image: "/images/archetypes/explorador.jpg",
  },
  sabio: {
    id: "sabio",
    title: "O Sábio",
    subtitle: "O Buscador da Verdade",
    grupo: "Buscar liberdade",
    desejo: "Encontrar a verdade pela inteligência",
    forcas: "Pensamento crítico, objetividade, clareza",
    medo: "Ser enganado ou agir na ignorância",
    sombra: "Paralisia por análise e frieza emocional",
    modificador:
      "garante decisões embasadas em lógica e profundo entendimento.",
    dominantRole:
      "Arquétipo Dominante (como você analisa e busca sentido)",
    subRole: "Sub-arquétipo Analítico (sua lógica e busca por clareza)",
    traitKeyword: "clareza",
    typicalTrap: "um Sábio puramente teórico",
    balanceBenefit:
      "garante que suas atitudes sejam embasadas em lógica, pesquisa e profundo entendimento antes de agir",
    colorClass: "text-indigo-300 border-indigo-400/40 bg-indigo-400/10",
    accent: "#818CF8",
    image: "/images/archetypes/sabio.jpg",
  },
  heroi: {
    id: "heroi",
    title: "O Herói",
    subtitle: "O Guerreiro Determinado",
    grupo: "Deixar uma marca",
    desejo: "Provar valor por coragem e superação",
    forcas: "Disciplina, determinação, foco, justiça",
    medo: "Fraqueza ou covardia",
    sombra: "Arrogância e exaustão por excesso de luta",
    modificador:
      "impulsiona para a ação prática e coragem diante de obstáculos.",
    dominantRole:
      "Arquétipo Dominante (sua força de superação e propósito)",
    subRole: "Sub-arquétipo de Ação (sua coragem e senso de propósito)",
    traitKeyword: "coragem",
    typicalTrap: "um Herói que entra em batalhas sem estratégia",
    balanceBenefit:
      "tira as ideias do papel para superar desafios reais com disciplina, foco e determinação",
    colorClass: "text-orange-300 border-orange-400/40 bg-orange-400/10",
    accent: "#FB923C",
    image: "/images/archetypes/heroi.jpg",
  },
  rebelde: {
    id: "rebelde",
    title: "O Rebelde",
    subtitle: "O Agente da Ruptura",
    grupo: "Deixar uma marca",
    desejo: "Revolução e destruir o que não funciona",
    forcas: "Autenticidade radical, inovação disruptiva",
    medo: "Ser impotente ou submisso",
    sombra: "Cinismo ou rebeldia sem propósito",
    modificador:
      "dá coragem para quebrar padrões e questionar o status quo.",
    dominantRole:
      "Arquétipo Dominante (sua coragem para romper padrões)",
    subRole: "Sub-arquétipo de Ruptura (sua autenticidade e ousadia)",
    traitKeyword: "ousadia",
    typicalTrap: "um Rebelde que destrói sem construir nada no lugar",
    balanceBenefit:
      "dá coragem para questionar regras ultrapassadas e provocar mudanças necessárias onde outros se acomodam",
    colorClass: "text-rose-300 border-rose-400/40 bg-rose-400/10",
    accent: "#FB7185",
    image: "/images/archetypes/rebelde.jpg",
  },
  mago: {
    id: "mago",
    title: "O Mago",
    subtitle: "O Catalisador de Mudanças",
    grupo: "Deixar uma marca",
    desejo: "Transformar realidades",
    forcas: "Visão sistêmica, carisma, intuição estratégica",
    medo: "Estagnação ou efeitos colaterais negativos",
    sombra: "Manipulação ou desconexão prática",
    modificador:
      "adiciona visão estratégica para transformar ideias em realidade.",
    dominantRole:
      "Arquétipo Dominante (sua visão e poder de transformação)",
    subRole: "Sub-arquétipo de Solução (sua visão e poder de transformação)",
    traitKeyword: "transformação",
    typicalTrap: "um Mago desconectado da execução prática",
    balanceBenefit:
      "conecta ideias distantes para transformar problemas complexos em soluções inovadoras",
    colorClass: "text-violet-300 border-violet-400/40 bg-violet-400/10",
    accent: "#A78BFA",
    image: "/images/archetypes/mago.jpg",
  },
  pessoa_comum: {
    id: "pessoa_comum",
    title: "O Órfão",
    subtitle: "O Realista Empático",
    grupo: "Conectar-se",
    desejo: "Pertencimento, conexão e igualdade",
    forcas: "Empatia, realismo, lealdade, acessibilidade",
    medo: "Ser excluído ou parecer arrogante",
    sombra: "Anular a própria identidade para agradar",
    modificador:
      "mantém os pés no chão e cria conexões de igual para igual.",
    dominantRole:
      "Arquétipo Dominante (sua empatia e conexão humana)",
    subRole: "Sub-arquétipo Social (sua empatia, lealdade e pés no chão)",
    traitKeyword: "empatia",
    typicalTrap: "alguém que anula a própria voz para agradar",
    balanceBenefit:
      "mantém os pés no chão, valoriza a igualdade e cria conexões genuínas sem soar arrogante ou inacessível",
    colorClass: "text-slate-300 border-slate-400/40 bg-slate-400/10",
    accent: "#94A3B8",
    image: "/images/archetypes/pessoa_comum.jpg",
  },
  amante: {
    id: "amante",
    title: "O Amante",
    subtitle: "O Apaixonado Intenso",
    grupo: "Conectar-se",
    desejo: "Intimidade, paixão e experiência profunda",
    forcas: "Entusiasmo, comprometimento, senso estético",
    medo: "Solidão ou rejeição",
    sombra: "Dependência emocional e ciúme",
    modificador: "traz intensidade emocional, beleza e foco nas relações.",
    dominantRole:
      "Arquétipo Dominante (sua paixão, estética e entrega)",
    subRole: "Sub-arquétipo Relacional (sua intensidade e conexão emocional)",
    traitKeyword: "paixão",
    typicalTrap: "um Amante guiado apenas pelo impulso emocional",
    balanceBenefit:
      "traz entusiasmo, sensibilidade estética e profundidade humana para tudo o que você constrói",
    colorClass: "text-pink-300 border-pink-400/40 bg-pink-400/10",
    accent: "#F472B6",
    image: "/images/archetypes/amante.jpg",
  },
  bobo_da_corte: {
    id: "bobo_da_corte",
    title: "O Bobo da Corte",
    subtitle: "O Espírito Livre",
    grupo: "Conectar-se",
    desejo: "Viver o presente com alegria e leveza",
    forcas: "Humor, criatividade espontânea, carisma",
    medo: "Tédio ou ser chato",
    sombra: "Irresponsabilidade ou fuga de problemas sérios",
    modificador: "suaviza a seriedade com bom humor e espontaneidade.",
    dominantRole:
      "Arquétipo Dominante (sua leveza, humor e espontaneidade)",
    subRole: "Sub-arquétipo de Leveza (seu bom humor e criatividade)",
    traitKeyword: "leveza",
    typicalTrap: "alguém que usa o humor para fugir de responsabilidades",
    balanceBenefit:
      "dissolve tensões, traz criatividade espontânea e impede que você leve a vida de forma rígida demais",
    colorClass: "text-yellow-300 border-yellow-400/40 bg-yellow-400/10",
    accent: "#FACC15",
    image: "/images/archetypes/bobo_da_corte.jpg",
  },
  cuidador: {
    id: "cuidador",
    title: "O Cuidador",
    subtitle: "O Protetor Generoso",
    grupo: "Prover estrutura",
    desejo: "Proteger, acolher e ajudar o próximo",
    forcas: "Generosidade, compaixão, paciência",
    medo: "Egoísmo e ingratidão",
    sombra: "Síndrome do mártir e esquecer de si mesmo",
    modificador:
      "direciona suas habilidades para servir e proteger os outros.",
    dominantRole:
      "Arquétipo Dominante (seu instinto de proteção e generosidade)",
    subRole: "Sub-arquétipo de Acolhimento (sua empatia e suporte)",
    traitKeyword: "generosidade",
    typicalTrap: "um Cuidador que esquece de si mesmo pelos outros",
    balanceBenefit:
      "direciona suas habilidades para apoiar, proteger e gerar impacto positivo real na vida das pessoas",
    colorClass: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
    accent: "#34D399",
    image: "/images/archetypes/cuidador.jpg",
  },
  criador: {
    id: "criador",
    title: "O Criador",
    subtitle: "O Visionário Original",
    grupo: "Prover estrutura",
    desejo: "Criar algo original e duradouro",
    forcas: "Imaginação, originalidade, senso estético",
    medo: "Mediocridade",
    sombra: "Perfeccionismo paralisante e autocrítica severa",
    modificador: "impulsiona a originalidade e soluções autorais.",
    dominantRole:
      "Arquétipo Dominante (sua necessidade de criar e inovar)",
    subRole: "Sub-arquétipo Criativo (sua originalidade e visão autoral)",
    traitKeyword: "originalidade",
    typicalTrap: "um Criador preso no perfeccionismo inacabado",
    balanceBenefit:
      "impulsiona você a criar soluções autorais, originais e com alto senso estético",
    colorClass: "text-sky-300 border-sky-400/40 bg-sky-400/10",
    accent: "#38BDF8",
    image: "/images/archetypes/criador.jpg",
  },
  governante: {
    id: "governante",
    title: "O Governante",
    subtitle: "O Líder Estruturador",
    grupo: "Prover estrutura",
    desejo: "Controle, ordem e prosperidade (estrutura sólida)",
    forcas: "Liderança, responsabilidade, visão organizacional, excelência",
    medo: "Caos, desorganização, perda de autoridade",
    sombra: "Controle excessivo, rigidez, micromanagement",
    modificador: "organiza sistemas, define metas e garante qualidade e ordem.",
    dominantRole:
      "Arquétipo Dominante (sua liderança e visão estratégica)",
    subRole: "Sub-arquétipo de Estrutura (sua organização e liderança)",
    traitKeyword: "estrutura",
    typicalTrap: "um Governante rígido e centralizador",
    balanceBenefit:
      "traz organização, visão estratégica e capacidade de transformar planos em estruturas sólidas e prósperas",
    colorClass: "text-amber-200 border-amber-500/40 bg-amber-500/10",
    accent: "#C9A227",
    image: "/images/archetypes/governante.jpg",
  },
};

export const STAGE_TITLES: Record<AxisId, string> = {
  1: "Reação sob Pressão e Crise",
  2: "Relação com Poder, Regras e Autonomia",
  3: "Vínculos, Afeto e Vulnerabilidade",
  4: "Ambição, Criação e Autossabotagem",
};

export const PRIMARY_POINTS = 3;
export const SECONDARY_POINTS = 1;
/** Points injected per answered question (primary + secondary). */
export const POINTS_PER_ANSWER = PRIMARY_POINTS + SECONDARY_POINTS;

export function emptyScores(): Record<ArchetypeId, number> {
  return ARCHETYPE_ORDER.reduce(
    (acc, id) => {
      acc[id] = 0;
      return acc;
    },
    {} as Record<ArchetypeId, number>,
  );
}

export type ChoiceRecord = {
  questionId: string;
  optionId: string;
  primary: ArchetypeId;
  secondary: ArchetypeId;
  tags: BehavioralTag[];
  summary: string;
  optionText: string;
  axis: AxisId;
};

export type HybridScoreBundle = {
  scores: Record<ArchetypeId, number>;
  choices: ChoiceRecord[];
  tagCounts: Partial<Record<BehavioralTag, number>>;
  totalPoints: number;
};

export type RankedArchetype = {
  id: ArchetypeId;
  score: number;
};

export function rankArchetypes(
  scores: Record<ArchetypeId, number>,
): RankedArchetype[] {
  return ARCHETYPE_ORDER.map((id) => ({
    id,
    score: scores[id],
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export type ScoredBandEntry = {
  profile: ArchetypeProfile;
  score: number;
  /** Affinity vs theoretical max if always chosen as primary (16×3). */
  affinityPct: number;
};

export type NarrativeResult = {
  hybrid: boolean;
  primary: ArchetypeProfile;
  /** Clear 2nd place (sub-archetype); null only if no answers. */
  secondaryProfile: ArchetypeProfile | null;
  dominantPct: number;
  secondaryPct: number;
  dominants: ScoredBandEntry[];
  secondaries: ScoredBandEntry[];
  complementary: ScoredBandEntry[];
  ranked: RankedArchetype[];
  choices: ChoiceRecord[];
  tagCounts: Partial<Record<BehavioralTag, number>>;
  totalPoints: number;
};

/** Join list in pt-BR: A · A e B · A, B e C */
export function joinPt(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function affinityVsMax(score: number, questionCount: number): number {
  const max = questionCount * PRIMARY_POINTS;
  if (max <= 0) return 0;
  return Math.round((score / max) * 100);
}

/**
 * Band scored archetypes (>0):
 * - dominants: highest score (ties allowed → hybrid)
 * - secondaries: second-highest band
 * - complementary: remaining with points
 */
export function calculateResult(
  bundle: HybridScoreBundle,
  questionCount: number,
): NarrativeResult {
  const { scores, choices, tagCounts, totalPoints } = bundle;
  const ranked = rankArchetypes(scores).filter((r) => r.score > 0);

  const toEntry = (r: RankedArchetype): ScoredBandEntry => ({
    profile: ARCHETYPES[r.id],
    score: r.score,
    affinityPct: affinityVsMax(r.score, questionCount),
  });

  if (ranked.length === 0) {
    const fallback = ARCHETYPES.inocente;
    return {
      hybrid: false,
      primary: fallback,
      secondaryProfile: null,
      dominantPct: 0,
      secondaryPct: 0,
      dominants: [{ profile: fallback, score: 0, affinityPct: 0 }],
      secondaries: [],
      complementary: [],
      ranked: rankArchetypes(scores),
      choices,
      tagCounts,
      totalPoints,
    };
  }

  const topScore = ranked[0].score;
  const dominants = ranked.filter((r) => r.score === topScore).map(toEntry);

  const rest = ranked.filter((r) => r.score < topScore);
  const secondScore = rest[0]?.score ?? 0;
  const secondaries = rest
    .filter((r) => r.score === secondScore && secondScore > 0)
    .map(toEntry);
  const complementary = rest
    .filter((r) => r.score < secondScore)
    .map(toEntry);

  const primary = dominants[0].profile;
  const secondaryProfile =
    secondaries[0]?.profile ??
    (dominants.length > 1 ? dominants[1].profile : null);

  const domScore = dominants[0].score;
  const subScore =
    secondaryProfile != null
      ? scores[secondaryProfile.id]
      : 0;
  const pair = domScore + subScore;
  const dominantPct =
    pair > 0 ? Math.round((domScore / pair) * 100) : dominants[0].affinityPct;
  const secondaryPct =
    secondaryProfile != null ? Math.max(0, 100 - dominantPct) : 0;

  return {
    hybrid: dominants.length > 1,
    primary,
    secondaryProfile,
    dominantPct,
    secondaryPct,
    dominants,
    secondaries,
    complementary,
    ranked: rankArchetypes(scores),
    choices,
    tagCounts,
    totalPoints,
  };
}

/** @deprecated use calculateResult */
export function resolveOutcome(
  bundle: HybridScoreBundle,
  questionCount: number,
): NarrativeResult {
  return calculateResult(bundle, questionCount);
}

export function buildIntro(result: NarrativeResult): string {
  const sub = result.secondaryProfile;
  if (result.hybrid) {
    const leaders = joinPt(result.dominants.map((d) => d.profile.title));
    const sec = sub
      ? `, com subarquétipo ${sub.title} (${result.secondaryPct}% de afinidade relativa)`
      : "";
    return `Você possui um perfil híbrido liderado por ${leaders}${sec}.`;
  }

  const name = result.primary.title;
  if (!sub) {
    return `Com base nas suas respostas, o seu arquétipo dominante é ${name} (${result.dominantPct}% na confluência).`;
  }
  return `Com base nas suas respostas, o seu arquétipo dominante é ${name} (${result.dominantPct}%), com ${sub.title} como subarquétipo (${result.secondaryPct}%).`;
}

export function formatShareText(result: NarrativeResult): string {
  const lines: string[] = [];
  lines.push(buildIntro(result));
  lines.push("");
  lines.push("Resultado Completo da Sua Pontuação");
  lines.push("Arquétipo | Pontos | Afinidade | Papel no Seu Perfil");

  for (const d of result.dominants) {
    lines.push(
      `${d.profile.title} | ${d.score} pts | ${d.affinityPct}% | ${d.profile.dominantRole}`,
    );
  }
  for (const s of result.secondaries) {
    lines.push(
      `${s.profile.title} | ${s.score} pts | ${s.affinityPct}% | ${s.profile.subRole}`,
    );
  }
  if (result.complementary.length > 0) {
    const names = result.complementary
      .map((c) => c.profile.title)
      .join(" / ");
    const pts = result.complementary.map((c) => `${c.score}`).join(", ");
    const traits = joinPt(
      result.complementary.map((c) => c.profile.traitKeyword),
    );
    lines.push(
      `${names} | ${pts} pts | — | Traços complementares de ${traits}`,
    );
  }

  const principal = result.primary;
  lines.push("");
  lines.push(`Perfil Principal: ${principal.title} (${principal.subtitle})`);
  lines.push(`Grupo: ${principal.grupo}`);
  lines.push(`Desejo Central: ${principal.desejo}`);
  lines.push(`• Pontos fortes: ${principal.forcas}`);
  lines.push(`• Maior medo: ${principal.medo}`);
  lines.push(
    `• Ponto de atenção (Sombra): ${principal.sombra}. Observe esse padrão na prática e use seu subarquétipo para equilibrá-lo.`,
  );

  if (result.secondaries.length > 0 || result.secondaryProfile) {
    lines.push("");
    lines.push("Como o Subarquétipo Equilibra Você");
    const subs =
      result.secondaries.length > 0
        ? result.secondaries
        : result.secondaryProfile
          ? [
              {
                profile: result.secondaryProfile,
                score: 0,
                affinityPct: result.secondaryPct,
              },
            ]
          : [];
    lines.push(
      `Diferente de ${principal.typicalTrap}, a sua combinação cria um perfil muito completo:`,
    );
    for (const s of subs) {
      lines.push(
        `• O toque de ${s.profile.title}: Você ${s.profile.balanceBenefit}.`,
      );
    }
  }

  lines.push("");
  lines.push("Faça o teste: Descubra o Seu Arquétipo Dominante");
  return lines.join("\n");
}

/** Count primary/secondary appearances across the question bank (balance audit). */
export function countOptionBalance(questions: Question[]): {
  primary: Record<ArchetypeId, number>;
  secondary: Record<ArchetypeId, number>;
} {
  const primary = emptyScores();
  const secondary = emptyScores();
  for (const q of questions) {
    for (const o of q.options) {
      primary[o.primary] += 1;
      secondary[o.secondary] += 1;
    }
  }
  return { primary, secondary };
}
