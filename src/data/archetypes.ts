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
  /** Tailwind text/bg helpers for UI chips */
  colorClass: string;
  /** Hex for charts */
  accent: string;
};

export type QuestionOption = {
  id: string;
  letter: "A" | "B" | "C" | "D";
  text: string;
  archetype: ArchetypeId;
};

export type Question = {
  id: string;
  number: number;
  stage: 1 | 2 | 3;
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
    colorClass: "text-amber-300 border-amber-400/40 bg-amber-400/10",
    accent: "#F5D76E",
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
    colorClass: "text-teal-300 border-teal-400/40 bg-teal-400/10",
    accent: "#2DD4BF",
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
    colorClass: "text-indigo-300 border-indigo-400/40 bg-indigo-400/10",
    accent: "#818CF8",
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
    colorClass: "text-orange-300 border-orange-400/40 bg-orange-400/10",
    accent: "#FB923C",
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
    colorClass: "text-rose-300 border-rose-400/40 bg-rose-400/10",
    accent: "#FB7185",
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
    colorClass: "text-violet-300 border-violet-400/40 bg-violet-400/10",
    accent: "#A78BFA",
  },
  pessoa_comum: {
    id: "pessoa_comum",
    title: "A Pessoa Comum",
    subtitle: "O Conector Empático",
    grupo: "Conectar-se",
    desejo: "Pertencimento, conexão e igualdade",
    forcas: "Empatia, realismo, lealdade, acessibilidade",
    medo: "Ser excluído ou parecer arrogante",
    sombra: "Anular a própria identidade para agradar",
    modificador:
      "mantém os pés no chão e cria conexões de igual para igual.",
    colorClass: "text-slate-300 border-slate-400/40 bg-slate-400/10",
    accent: "#94A3B8",
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
    colorClass: "text-pink-300 border-pink-400/40 bg-pink-400/10",
    accent: "#F472B6",
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
    colorClass: "text-yellow-300 border-yellow-400/40 bg-yellow-400/10",
    accent: "#FACC15",
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
    colorClass: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
    accent: "#34D399",
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
    colorClass: "text-sky-300 border-sky-400/40 bg-sky-400/10",
    accent: "#38BDF8",
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
    colorClass: "text-amber-200 border-amber-500/40 bg-amber-500/10",
    accent: "#C9A227",
  },
};

export const STAGE_TITLES: Record<1 | 2 | 3, string> = {
  1: "Motivação e Propósito",
  2: "Comportamento e Decisões",
  3: "Medos e Legado",
};

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    number: 1,
    stage: 1,
    stageTitle: STAGE_TITLES[1],
    text: "O que mais traz sensação de realização na sua vida?",
    options: [
      {
        id: "q1a",
        letter: "A",
        text: "Superar um grande obstáculo, vencer um desafio difícil ou defender quem precisa.",
        archetype: "heroi",
      },
      {
        id: "q1b",
        letter: "B",
        text: "Entender profundamente como o mundo funciona, aprender algo novo e encontrar a verdade.",
        archetype: "sabio",
      },
      {
        id: "q1c",
        letter: "C",
        text: "Criar algo original do zero que expresse a minha visão única.",
        archetype: "criador",
      },
      {
        id: "q1d",
        letter: "D",
        text: "Fazer a diferença na vida das pessoas através do cuidado, acolhimento e generosidade.",
        archetype: "cuidador",
      },
    ],
  },
  {
    id: "q2",
    number: 2,
    stage: 1,
    stageTitle: STAGE_TITLES[1],
    text: "Qual destas situações mais gera desconforto ou frustração em você?",
    options: [
      {
        id: "q2a",
        letter: "A",
        text: "Sentir-se preso, sem liberdade de escolha ou obrigado a seguir uma rotina rígida.",
        archetype: "explorador",
      },
      {
        id: "q2b",
        letter: "B",
        text: "Ser excluído, parecer arrogante ou não se sentir parte do grupo.",
        archetype: "pessoa_comum",
      },
      {
        id: "q2c",
        letter: "C",
        text: "Perder o controle da situação, lidar com desorganização ou falta de liderança.",
        archetype: "governante",
      },
      {
        id: "q2d",
        letter: "D",
        text: "Viver em um ambiente pesado, cheio de regras chatas, sem humor ou espontaneidade.",
        archetype: "bobo_da_corte",
      },
    ],
  },
  {
    id: "q3",
    number: 3,
    stage: 1,
    stageTitle: STAGE_TITLES[1],
    text: "Quando você enfrenta uma crise ou problema sério, qual é a sua reação natural?",
    options: [
      {
        id: "q3a",
        letter: "A",
        text: "Quebrar as regras antigas e buscar uma mudança radical para resolver o problema na raiz.",
        archetype: "rebelde",
      },
      {
        id: "q3b",
        letter: "B",
        text: "Encontrar uma solução inovadora, mudando a perspectiva ou transformando o cenário.",
        archetype: "mago",
      },
      {
        id: "q3c",
        letter: "C",
        text: "Manter o otimismo, confiar que as coisas vão dar certo e buscar a solução mais simples.",
        archetype: "inocente",
      },
      {
        id: "q3d",
        letter: "D",
        text: "Mergulhar de cabeça nas emoções, fortalecer os laços com quem amo e buscar harmonia.",
        archetype: "amante",
      },
    ],
  },
  {
    id: "q4",
    number: 4,
    stage: 1,
    stageTitle: STAGE_TITLES[1],
    text: "Como as pessoas mais próximas costumam descrever a sua presença?",
    options: [
      {
        id: "q4a",
        letter: "A",
        text: "Alguém confiável, pé no chão, acessível e fácil de conviver.",
        archetype: "pessoa_comum",
      },
      {
        id: "q4b",
        letter: "B",
        text: "Alguém inspirador, intenso, apaixonado e que valoriza a beleza e as conexões.",
        archetype: "amante",
      },
      {
        id: "q4c",
        letter: "C",
        text: "Alguém visionário, que parece saber como transformar ideias em realidade.",
        archetype: "mago",
      },
      {
        id: "q4d",
        letter: "D",
        text: "Alguém independente, curioso e sempre pronto para uma nova experiência.",
        archetype: "explorador",
      },
    ],
  },
  {
    id: "q5",
    number: 5,
    stage: 2,
    stageTitle: STAGE_TITLES[2],
    text: "Em um projeto em grupo ou trabalho em equipe, qual papel você assume naturalmente?",
    options: [
      {
        id: "q5a",
        letter: "A",
        text: "O que organiza tudo, define as metas e garante a ordem e a qualidade.",
        archetype: "governante",
      },
      {
        id: "q5b",
        letter: "B",
        text: "O que traz ideias fora da caixa, protótipos e soluções criativas.",
        archetype: "criador",
      },
      {
        id: "q5c",
        letter: "C",
        text: "O que pesquisa os dados, analisa os fatos e aconselha o grupo com lógica.",
        archetype: "sabio",
      },
      {
        id: "q5d",
        letter: "D",
        text: "O que quebra o gelo, mantém o astral leve e faz todo mundo dar risada.",
        archetype: "bobo_da_corte",
      },
    ],
  },
  {
    id: "q6",
    number: 6,
    stage: 2,
    stageTitle: STAGE_TITLES[2],
    text: "Qual dessas frases mais parece um lema de vida para você?",
    options: [
      {
        id: "q6a",
        letter: "A",
        text: '"A vida é feita para ser explorada, sem fronteiras."',
        archetype: "explorador",
      },
      {
        id: "q6b",
        letter: "B",
        text: '"Regras existem para serem questionadas e transformadas."',
        archetype: "rebelde",
      },
      {
        id: "q6c",
        letter: "C",
        text: '"Onde há vontade, há um caminho para a vitória."',
        archetype: "heroi",
      },
      {
        id: "q6d",
        letter: "D",
        text: '"A simplicidade e a esperança sempre vencem no final."',
        archetype: "inocente",
      },
    ],
  },
  {
    id: "q7",
    number: 7,
    stage: 2,
    stageTitle: STAGE_TITLES[2],
    text: "O que você mais valoriza nos seus relacionamentos (amizades ou amor)?",
    options: [
      {
        id: "q7a",
        letter: "A",
        text: "Intimidade profunda, entrega, conexão emocional e admiração mútua.",
        archetype: "amante",
      },
      {
        id: "q7b",
        letter: "B",
        text: "Lealdade, igualdade e sentir que podemos ser quem realmente somos, sem máscaras.",
        archetype: "pessoa_comum",
      },
      {
        id: "q7c",
        letter: "C",
        text: "Apoio mútuo, segurança e saber que um sempre vai proteger e ajudar o outro.",
        archetype: "cuidador",
      },
      {
        id: "q7d",
        letter: "D",
        text: "Trocas intelectuais estimulantes, respeito à individualidade e conversas profundas.",
        archetype: "sabio",
      },
    ],
  },
  {
    id: "q8",
    number: 8,
    stage: 2,
    stageTitle: STAGE_TITLES[2],
    text: "Se você ganhasse um ano sabático totalmente pago, o que faria primeiro?",
    options: [
      {
        id: "q8a",
        letter: "A",
        text: "Viajaria sem roteiro fixo para lugares desconhecidos em busca de aventura.",
        archetype: "explorador",
      },
      {
        id: "q8b",
        letter: "B",
        text: "Dedicaria o tempo para escrever, pintar, empreender ou construir um projeto pessoal.",
        archetype: "criador",
      },
      {
        id: "q8c",
        letter: "C",
        text: "Faria cursos, leria dezenas de livros e estudaria assuntos que sempre quis dominar.",
        archetype: "sabio",
      },
      {
        id: "q8d",
        letter: "D",
        text: "Aproveitaria para curtir os prazeres da vida, viajar com quem amo e viver intensamente.",
        archetype: "amante",
      },
    ],
  },
  {
    id: "q9",
    number: 9,
    stage: 3,
    stageTitle: STAGE_TITLES[3],
    text: "Qual destes cenários representa o seu maior medo interno?",
    options: [
      {
        id: "q9a",
        letter: "A",
        text: "Ser enganado, manipulado ou viver na ignorância sem saber a verdade.",
        archetype: "sabio",
      },
      {
        id: "q9b",
        letter: "B",
        text: "Ser fraco, covarde ou falhar quando mais precisarem de mim.",
        archetype: "heroi",
      },
      {
        id: "q9c",
        letter: "C",
        text: "Ser comum demais, medíocre ou não deixar nenhuma marca original no mundo.",
        archetype: "criador",
      },
      {
        id: "q9d",
        letter: "D",
        text: "Ficar preso em uma vida entediante, previsível e sem liberdade.",
        archetype: "explorador",
      },
    ],
  },
  {
    id: "q10",
    number: 10,
    stage: 3,
    stageTitle: STAGE_TITLES[3],
    text: "Quando você olha para o seu trabalho ou projetos, o que te deixa mais orgulhoso?",
    options: [
      {
        id: "q10a",
        letter: "A",
        text: "Ter construído uma estrutura sólida, próspera e que funciona com excelência.",
        archetype: "governante",
      },
      {
        id: "q10b",
        letter: "B",
        text: "Ter ajudado alguém a se reerguer ou tornado a vida de outras pessoas mais fácil.",
        archetype: "cuidador",
      },
      {
        id: "q10c",
        letter: "C",
        text: "Ter causado uma verdadeira revolução ou mudado um padrão que parecia imutável.",
        archetype: "rebelde",
      },
      {
        id: "q10d",
        letter: "D",
        text: 'Ter catalisado uma transformação, fazendo algo parecer "mágica" de tão bem-feito.',
        archetype: "mago",
      },
    ],
  },
  {
    id: "q11",
    number: 11,
    stage: 3,
    stageTitle: STAGE_TITLES[3],
    text: "Qual tipo de ambiente ou cultura te faz sentir mais em casa?",
    options: [
      {
        id: "q11a",
        letter: "A",
        text: "Um lugar leve, divertido, onde ninguém se leva a sério demais e o humor reina.",
        archetype: "bobo_da_corte",
      },
      {
        id: "q11b",
        letter: "B",
        text: "Um lugar acolhedor, sem julgamentos, onde todos são tratados de igual para igual.",
        archetype: "pessoa_comum",
      },
      {
        id: "q11c",
        letter: "C",
        text: "Um lugar harmonioso, seguro, otimista e sem conflitos desnecessários.",
        archetype: "inocente",
      },
      {
        id: "q11d",
        letter: "D",
        text: "Um lugar dinâmico, cheio de novidades, estímulos e oportunidades de descoberta.",
        archetype: "explorador",
      },
    ],
  },
  {
    id: "q12",
    number: 12,
    stage: 3,
    stageTitle: STAGE_TITLES[3],
    text: "Se você pudesse deixar um único legado para o mundo, qual seria?",
    options: [
      {
        id: "q12a",
        letter: "A",
        text: "Ter sido uma fonte de sabedoria, clareza e conhecimento para as futuras gerações.",
        archetype: "sabio",
      },
      {
        id: "q12b",
        letter: "B",
        text: "Ter inspirado paixão, beleza e conexões humanas verdadeiras.",
        archetype: "amante",
      },
      {
        id: "q12c",
        letter: "C",
        text: "Ter criado obras, ideias ou soluções que continuam funcionando e encantando.",
        archetype: "criador",
      },
      {
        id: "q12d",
        letter: "D",
        text: "Ter lutado pelo que é certo e inspirado outros a terem coragem.",
        archetype: "heroi",
      },
    ],
  },
];

export const TOTAL_QUESTIONS = QUESTIONS.length; // 12

export function emptyScores(): Record<ArchetypeId, number> {
  return ARCHETYPE_ORDER.reduce(
    (acc, id) => {
      acc[id] = 0;
      return acc;
    },
    {} as Record<ArchetypeId, number>,
  );
}

/** +1 per answer mapped to that archetype (range 0–12). */
export function scoreAnswers(
  answers: Record<string, string>,
): Record<ArchetypeId, number> {
  const scores = emptyScores();
  for (const question of QUESTIONS) {
    const optionId = answers[question.id];
    if (!optionId) continue;
    const option = question.options.find((o) => o.id === optionId);
    if (!option) continue;
    scores[option.archetype] += 1;
  }
  return scores;
}

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

export type QuizOutcome =
  | {
      kind: "dominant";
      dominant: ArchetypeProfile;
      sub: ArchetypeProfile;
      dominantScore: number;
      subScore: number;
      ranked: RankedArchetype[];
    }
  | {
      kind: "hybrid";
      tied: [ArchetypeProfile, ArchetypeProfile];
      score: number;
      ranked: RankedArchetype[];
    };

export function resolveOutcome(
  scores: Record<ArchetypeId, number>,
): QuizOutcome {
  const ranked = rankArchetypes(scores);
  const top = ranked[0];
  const second = ranked[1];
  const topProfile = ARCHETYPES[top.id];
  const secondProfile = ARCHETYPES[second.id];

  if (top.score === second.score && top.score > 0) {
    return {
      kind: "hybrid",
      tied: [topProfile, secondProfile],
      score: top.score,
      ranked,
    };
  }

  return {
    kind: "dominant",
    dominant: topProfile,
    sub: secondProfile,
    dominantScore: top.score,
    subScore: second.score,
    ranked,
  };
}

export function buildResumo(outcome: QuizOutcome): string {
  if (outcome.kind === "hybrid") {
    const [a, b] = outcome.tied;
    return `Perfil Híbrido: ${a.title} + ${b.title}. Você equilibra a energia de ${a.subtitle.toLowerCase()} com ${b.subtitle.toLowerCase()}. ${a.title} ${a.modificador} Enquanto isso, ${b.title} ${b.modificador}`;
  }
  const { dominant, sub } = outcome;
  return `${dominant.title} (${dominant.subtitle}) é o seu Arquétipo Dominante, no grupo "${dominant.grupo}". Como Sub-arquétipo, ${sub.title} ${sub.modificador}`;
}

export function formatShareText(outcome: QuizOutcome): string {
  const resumo = buildResumo(outcome);
  if (outcome.kind === "hybrid") {
    const [a, b] = outcome.tied;
    return [
      "Meu resultado no Arquétipo: Perfil Híbrido",
      `${a.title} + ${b.title} (${outcome.score}/12 cada)`,
      "",
      resumo,
      "",
      `${a.title} — Desejo: ${a.desejo}`,
      `${b.title} — Desejo: ${b.desejo}`,
      "",
      "Faça o teste: Descubra o Seu Arquétipo Dominante",
    ].join("\n");
  }
  const { dominant, sub, dominantScore, subScore } = outcome;
  return [
    `Meu Arquétipo Dominante: ${dominant.title} (${dominantScore}/12)`,
    `Sub-arquétipo: ${sub.title} (${subScore}/12)`,
    "",
    resumo,
    `Desejo Central: ${dominant.desejo}`,
    `Pontos Fortes: ${dominant.forcas}`,
    `Maior Medo: ${dominant.medo}`,
    `Sombra: ${dominant.sombra}`,
    "",
    "Faça o teste: Descubra o Seu Arquétipo Dominante",
  ].join("\n");
}
