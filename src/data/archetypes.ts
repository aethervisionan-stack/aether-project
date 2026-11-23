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
    dominantRole:
      "Arquétipo Dominante (sua busca por paz, ética e simplicidade)",
    subRole: "Sub-arquétipo de Harmonia (sua leveza e otimismo)",
    traitKeyword: "otimismo",
    typicalTrap: "um Inocente ingênuo diante dos problemas",
    balanceBenefit:
      "mantém a esperança, a transparência e a busca por soluções simples e éticas sem perder a leveza",
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
    dominantRole:
      "Arquétipo Dominante (sua busca por liberdade e autenticidade)",
    subRole: "Sub-arquétipo de Liberdade (sua curiosidade e independência)",
    traitKeyword: "liberdade",
    typicalTrap: "um Explorador inquieto que foge de compromissos",
    balanceBenefit:
      "impede que você fique preso em rotinas engessadas, trazendo sede de novidade e adaptação rápida",
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
    dominantRole:
      "Arquétipo Dominante (como você analisa e busca sentido)",
    subRole: "Sub-arquétipo Analítico (sua lógica e busca por clareza)",
    traitKeyword: "clareza",
    typicalTrap: "um Sábio puramente teórico",
    balanceBenefit:
      "garante que suas atitudes sejam embasadas em lógica, pesquisa e profundo entendimento antes de agir",
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
    dominantRole:
      "Arquétipo Dominante (sua força de superação e propósito)",
    subRole: "Sub-arquétipo de Ação (sua coragem e senso de propósito)",
    traitKeyword: "coragem",
    typicalTrap: "um Herói que entra em batalhas sem estratégia",
    balanceBenefit:
      "tira as ideias do papel para superar desafios reais com disciplina, foco e determinação",
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
    dominantRole:
      "Arquétipo Dominante (sua coragem para romper padrões)",
    subRole: "Sub-arquétipo de Ruptura (sua autenticidade e ousadia)",
    traitKeyword: "ousadia",
    typicalTrap: "um Rebelde que destrói sem construir nada no lugar",
    balanceBenefit:
      "dá coragem para questionar regras ultrapassadas e provocar mudanças necessárias onde outros se acomodam",
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
    dominantRole:
      "Arquétipo Dominante (sua visão e poder de transformação)",
    subRole: "Sub-arquétipo de Solução (sua visão e poder de transformação)",
    traitKeyword: "transformação",
    typicalTrap: "um Mago desconectado da execução prática",
    balanceBenefit:
      "conecta ideias distantes para transformar problemas complexos em soluções inovadoras",
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
    dominantRole:
      "Arquétipo Dominante (sua empatia e conexão humana)",
    subRole: "Sub-arquétipo Social (sua empatia, lealdade e pés no chão)",
    traitKeyword: "empatia",
    typicalTrap: "alguém que anula a própria voz para agradar",
    balanceBenefit:
      "mantém os pés no chão, valoriza a igualdade e cria conexões genuínas sem soar arrogante ou inacessível",
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
    dominantRole:
      "Arquétipo Dominante (sua paixão, estética e entrega)",
    subRole: "Sub-arquétipo Relacional (sua intensidade e conexão emocional)",
    traitKeyword: "paixão",
    typicalTrap: "um Amante guiado apenas pelo impulso emocional",
    balanceBenefit:
      "traz entusiasmo, sensibilidade estética e profundidade humana para tudo o que você constrói",
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
    dominantRole:
      "Arquétipo Dominante (sua leveza, humor e espontaneidade)",
    subRole: "Sub-arquétipo de Leveza (seu bom humor e criatividade)",
    traitKeyword: "leveza",
    typicalTrap: "alguém que usa o humor para fugir de responsabilidades",
    balanceBenefit:
      "dissolve tensões, traz criatividade espontânea e impede que você leve a vida de forma rígida demais",
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
    dominantRole:
      "Arquétipo Dominante (seu instinto de proteção e generosidade)",
    subRole: "Sub-arquétipo de Acolhimento (sua empatia e suporte)",
    traitKeyword: "generosidade",
    typicalTrap: "um Cuidador que esquece de si mesmo pelos outros",
    balanceBenefit:
      "direciona suas habilidades para apoiar, proteger e gerar impacto positivo real na vida das pessoas",
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
    dominantRole:
      "Arquétipo Dominante (sua necessidade de criar e inovar)",
    subRole: "Sub-arquétipo Criativo (sua originalidade e visão autoral)",
    traitKeyword: "originalidade",
    typicalTrap: "um Criador preso no perfeccionismo inacabado",
    balanceBenefit:
      "impulsiona você a criar soluções autorais, originais e com alto senso estético",
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
    dominantRole:
      "Arquétipo Dominante (sua liderança e visão estratégica)",
    subRole: "Sub-arquétipo de Estrutura (sua organização e liderança)",
    traitKeyword: "estrutura",
    typicalTrap: "um Governante rígido e centralizador",
    balanceBenefit:
      "traz organização, visão estratégica e capacidade de transformar planos em estruturas sólidas e prósperas",
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

export type ScoredBandEntry = {
  profile: ArchetypeProfile;
  score: number;
};

export type NarrativeResult = {
  hybrid: boolean;
  primary: ArchetypeProfile;
  dominants: ScoredBandEntry[];
  secondaries: ScoredBandEntry[];
  complementary: ScoredBandEntry[];
  ranked: RankedArchetype[];
};

/** Join list in pt-BR: A · A e B · A, B e C */
export function joinPt(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/**
 * Band scored archetypes (>0):
 * - dominants: highest score
 * - secondaries: second-highest (may be 1–3 tied)
 * - complementary: remaining with points
 */
export function calculateResult(
  scores: Record<ArchetypeId, number>,
): NarrativeResult {
  const ranked = rankArchetypes(scores).filter((r) => r.score > 0);
  if (ranked.length === 0) {
    const fallback = ARCHETYPES.inocente;
    return {
      hybrid: false,
      primary: fallback,
      dominants: [{ profile: fallback, score: 0 }],
      secondaries: [],
      complementary: [],
      ranked: rankArchetypes(scores),
    };
  }

  const topScore = ranked[0].score;
  const dominants = ranked
    .filter((r) => r.score === topScore)
    .map((r) => ({ profile: ARCHETYPES[r.id], score: r.score }));

  const rest = ranked.filter((r) => r.score < topScore);
  const secondScore = rest[0]?.score ?? 0;
  const secondaries = rest
    .filter((r) => r.score === secondScore && secondScore > 0)
    .map((r) => ({ profile: ARCHETYPES[r.id], score: r.score }));
  const complementary = rest
    .filter((r) => r.score < secondScore)
    .map((r) => ({ profile: ARCHETYPES[r.id], score: r.score }));

  return {
    hybrid: dominants.length > 1,
    primary: dominants[0].profile,
    dominants,
    secondaries,
    complementary,
    ranked: rankArchetypes(scores),
  };
}

/** @deprecated use calculateResult */
export function resolveOutcome(
  scores: Record<ArchetypeId, number>,
): NarrativeResult {
  return calculateResult(scores);
}

export function buildIntro(result: NarrativeResult): string {
  if (result.hybrid) {
    const leaders = joinPt(result.dominants.map((d) => d.profile.title));
    const sec =
      result.secondaries.length > 0
        ? `, com influências secundárias de ${joinPt(
            result.secondaries.map((s) => s.profile.title),
          )}`
        : "";
    return `Você possui um perfil híbrido liderado por ${leaders}${sec}.`;
  }

  const name = result.dominants[0].profile.title;
  if (result.secondaries.length === 0) {
    return `Com base nas suas 12 respostas, o seu arquétipo dominante é ${name}.`;
  }
  const subs = joinPt(result.secondaries.map((s) => s.profile.title));
  return `Com base nas suas 12 respostas, o seu arquétipo dominante é ${name}, acompanhado por um forte equilíbrio entre ${subs} como influências secundárias.`;
}

export function formatShareText(result: NarrativeResult): string {
  const lines: string[] = [];
  lines.push(buildIntro(result));
  lines.push("");
  lines.push("Resultado Completo da Sua Pontuação");
  lines.push("Arquétipo | Pontos | Papel no Seu Perfil");

  for (const d of result.dominants) {
    lines.push(
      `${d.profile.title} | ${d.score} pts | ${d.profile.dominantRole}`,
    );
  }
  for (const s of result.secondaries) {
    lines.push(`${s.profile.title} | ${s.score} pts | ${s.profile.subRole}`);
  }
  if (result.complementary.length > 0) {
    const names = result.complementary
      .map((c) => c.profile.title)
      .join(" / ");
    const pts = result.complementary.every((c) => c.score === 1)
      ? "1 pt cada"
      : result.complementary.map((c) => `${c.score} pts`).join(", ");
    const traits = joinPt(
      result.complementary.map((c) => c.profile.traitKeyword),
    );
    lines.push(
      `${names} | ${pts} | Traços complementares de ${traits}`,
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
    `• Ponto de atenção (Sombra): ${principal.sombra}. Observe esse padrão na prática e use seus sub-arquétipos para equilibrá-lo.`,
  );

  if (result.secondaries.length > 0) {
    lines.push("");
    lines.push("Como os Seus Sub-arquétipos Equilibram Você");
    lines.push(
      `Diferente de ${principal.typicalTrap}, a sua combinação cria um perfil muito completo:`,
    );
    for (const s of result.secondaries) {
      lines.push(
        `• O toque de ${s.profile.title}: Você ${s.profile.balanceBenefit}.`,
      );
    }
  }

  lines.push("");
  lines.push("Faça o teste: Descubra o Seu Arquétipo Dominante");
  return lines.join("\n");
}
