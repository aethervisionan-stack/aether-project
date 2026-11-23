export type ArchetypeId =
  | "inocente"
  | "sabio"
  | "explorador"
  | "fora-da-lei"
  | "mago"
  | "heroi"
  | "amante"
  | "bobo-da-corte"
  | "cara-comum"
  | "prestativo"
  | "governante"
  | "criador";

export type Archetype = {
  id: ArchetypeId;
  name: string;
  lema: string;
  summary: string;
  strengths: string[];
  shadows: string[];
  life: string;
  business: string;
  accent: string;
};

export type QuestionOption = {
  id: string;
  text: string;
  weights: Partial<Record<ArchetypeId, number>>;
};

export type Question = {
  id: string;
  text: string;
  options: QuestionOption[];
};

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  inocente: {
    id: "inocente",
    name: "Inocente",
    lema: "Liberdade para ser você mesmo.",
    summary:
      "Você busca pureza, otimismo e um caminho simples. Confia no bem e inspira segurança emocional em quem está ao seu redor.",
    strengths: [
      "Otimismo genuíno e fé no potencial humano",
      "Autenticidade e comunicação transparente",
      "Capacidade de renovar a esperança em equipes",
    ],
    shadows: [
      "Ingenuidade diante de riscos reais",
      "Negação de conflitos necessários",
      "Dependência de validação externa",
    ],
    life: "Priorize ambientes seguros e relações honestas. Proteja seu otimismo com limites claros — não com cinismo.",
    business:
      "Brilhe em marcas de bem-estar, educação e experiências que prometem simplicidade e confiança. Sua narrativa vende clareza.",
    accent: "#E8C547",
  },
  sabio: {
    id: "sabio",
    name: "Sábio",
    lema: "A verdade te libertará.",
    summary:
      "Você orienta decisões pela análise, aprendizado contínuo e visão de longo prazo. Busca compreender o mundo antes de agir.",
    strengths: [
      "Pensamento crítico e profundidade analítica",
      "Paciência para estudar padrões complexos",
      "Credibilidade como conselheiro e mentor",
    ],
    shadows: [
      "Paralisia por excesso de análise",
      "Distância emocional em momentos críticos",
      "Arrogância intelectual",
    ],
    life: "Equilibre estudo com experimentação. Conhecimento sem ação vira biblioteca; ação sem reflexão vira ruído.",
    business:
      "Ideal para consultoria, pesquisa, educação e produtos baseados em dados. Posicione-se como a voz que reduz incerteza.",
    accent: "#7C9CFF",
  },
  explorador: {
    id: "explorador",
    name: "Explorador",
    lema: "Não me prenda — eu preciso descobrir.",
    summary:
      "Você é movido pela autonomia, curiosidade e pela fronteira do desconhecido. Evita rotinas que sufocam a identidade.",
    strengths: [
      "Coragem para sair da zona de conforto",
      "Adaptabilidade em contextos novos",
      "Inspiração para inovar processos e rotas",
    ],
    shadows: [
      "Inquietação crônica e dificuldade de compromisso",
      "Fuga quando a estabilidade exige presença",
      "Espalhamento de energia em muitas frentes",
    ],
    life: "Construa ritual mínimo de âncora (saúde, finanças, relações) para sustentar suas expedições sem se perder.",
    business:
      "Destaque-se em viagem, outdoor, startups e marcas de descoberta. Venda liberdade com método — não só aventura.",
    accent: "#3DD6C6",
  },
  "fora-da-lei": {
    id: "fora-da-lei",
    name: "Fora-da-lei",
    lema: "As regras são feitas para serem questionadas.",
    summary:
      "Você desafia o status quo, provoca mudança e rejeita o que parece injusto ou artificial. Sua força é a ruptura criativa.",
    strengths: [
      "Coragem para confrontar sistemas ultrapassados",
      "Identidade marcante e discurso disruptivo",
      "Capacidade de catalisar movimentos",
    ],
    shadows: [
      "Rebelião sem propósito construtivo",
      "Autossabotagem por oposição automática",
      "Dificuldade de colaborar em estruturas",
    ],
    life: "Canalize a revolta em projetos concretos. Destruir sem reconstruir só aumenta o vazio.",
    business:
      "Perfeito para marcas underground, ativismo, tech disruptiva e posicionamento anti-establishment com proposta clara.",
    accent: "#E85D4C",
  },
  mago: {
    id: "mago",
    name: "Mago",
    lema: "Se você pode imaginar, pode transformar.",
    summary:
      "Você conecta visão e realidade. Enxerga padrões invisíveis e orquestra mudanças que parecem mágicas para os outros.",
    strengths: [
      "Visão sistêmica e influência sutil",
      "Capacidade de catalisar transformações",
      "Intuição estratégica afiada",
    ],
    shadows: [
      "Manipulação disfarçada de visão",
      "Promessas que fogem do operacional",
      "Isolamento por se sentir incompreendido",
    ],
    life: "Traduza insights em rituais e experimentos mensuráveis. Magia sustentável é processo, não mistério.",
    business:
      "Excelente em branding, coaching de transformação, produto e inovação. Sua narrativa vende virada de chave.",
    accent: "#A78BFA",
  },
  heroi: {
    id: "heroi",
    name: "Herói",
    lema: "Onde há vontade, há um caminho.",
    summary:
      "Você enfrenta desafios de frente, eleva o padrão e busca provar valor pela conquista. Competência é o seu idioma.",
    strengths: [
      "Disciplina e resiliência sob pressão",
      "Liderança pelo exemplo",
      "Foco em resultados e superação",
    ],
    shadows: [
      "Burnout por exigência excessiva",
      "Dificuldade de pedir ajuda",
      "Competição que esvazia relações",
    ],
    life: "Defina vitórias que incluam descanso e vínculo. Heroísmo sem recuperação vira martírio.",
    business:
      "Forte em performance, esportes, carreira e produtos de alta exigência. Venda a jornada da conquista com ética.",
    accent: "#F0A500",
  },
  amante: {
    id: "amante",
    name: "Amante",
    lema: "Estou apaixonado pela vida.",
    summary:
      "Você valoriza conexão, estética, sensualidade e profundidade afetiva. Busca experiências que toquem a alma.",
    strengths: [
      "Empatia e presença emocional",
      "Sensibilidade estética e relacional",
      "Capacidade de criar vínculo autêntico",
    ],
    shadows: [
      "Ciúme, dependência afetiva ou idealização",
      "Decisões guiadas só pela emoção",
      "Medo do abandono que limita autonomia",
    ],
    life: "Cuide do prazer sem perder o centro. Amor próprio é a base de toda intimidade duradoura.",
    business:
      "Brilha em moda, hospitalidade, bem-estar, arte e marcas sensoriais. Venda desejo com elegância e verdade.",
    accent: "#E879A9",
  },
  "bobo-da-corte": {
    id: "bobo-da-corte",
    name: "Bobo da Corte",
    lema: "Se não for divertido, para quê?",
    summary:
      "Você desarma tensões com humor, leveza e improvisação. Lembra ao mundo que alegria também é sabedoria.",
    strengths: [
      "Criatividade espontânea e carisma",
      "Capacidade de quebrar gelo e hierarquias",
      "Resiliência emocional pelo riso",
    ],
    shadows: [
      "Fuga de responsabilidade via piada",
      "Superficialidade em temas sérios",
      "Medo de ser levado a sério demais",
    ],
    life: "Use o humor como ponte, não como esconderijo. Sua leveza ganha força quando também segura o peso.",
    business:
      "Ideal para entretenimento, conteúdo, eventos e marcas jovens. Venda alegria com inteligência cultural.",
    accent: "#F4C430",
  },
  "cara-comum": {
    id: "cara-comum",
    name: "Cara Comum",
    lema: "Todos têm valor — eu também.",
    summary:
      "Você valoriza pertencimento, igualdade e realismo. Prefere o sólido ao glamouroso e conecta-se pelo cotidiano.",
    strengths: [
      "Empatia com a maioria e pé no chão",
      "Confiabilidade e senso de comunidade",
      "Comunicação acessível e sem pretensão",
    ],
    shadows: [
      "Medo de se destacar e se limitar",
      "Conformismo que adia potencial",
      "Ressentimento com quem brilha",
    ],
    life: "Pertencer não exige desaparecer. Sua autenticidade simples é poder — use-a sem se encolher.",
    business:
      "Forte em produtos de massa, serviços essenciais e marcas de confiança cotidiana. Venda inclusão sem discurso vazio.",
    accent: "#8FA3B8",
  },
  prestativo: {
    id: "prestativo",
    name: "Prestativo",
    lema: "Ame o próximo como a si mesmo.",
    summary:
      "Você encontra sentido em cuidar, apoiar e aliviar o sofrimento alheio. Generosidade é o centro da sua identidade.",
    strengths: [
      "Empatia prática e escuta generosa",
      "Lealdade e presença em crises",
      "Capacidade de construir segurança emocional",
    ],
    shadows: [
      "Autossacrifício e burnout cuidador",
      "Dificuldade de dizer não",
      "Ajuda que gera dependência",
    ],
    life: "Cuidar de si é pré-requisito ético do cuidado. Estabeleça reciprocidade sem culpa.",
    business:
      "Excelente em saúde, educação, ONG, RH e serviços de suporte. Venda cuidado com limites saudáveis.",
    accent: "#5BB8A8",
  },
  governante: {
    id: "governante",
    name: "Governante",
    lema: "O poder é responsabilidade.",
    summary:
      "Você organiza, decide e cria ordem. Busca estabilidade, status legítimo e sistemas que funcionem para o coletivo.",
    strengths: [
      "Visão de estrutura e governança",
      "Decisão sob pressão e autoridade natural",
      "Capacidade de construir legados",
    ],
    shadows: [
      "Controle excessivo e rigidez",
      "Medo de caos que inibe inovação",
      "Status como máscara de insegurança",
    ],
    life: "Liderar é servir à ordem justa — não ao ego. Delegue e cultive confiança nos processos.",
    business:
      "Natural em gestão, luxury com substância, política organizacional e marcas de autoridade. Venda estabilidade premium.",
    accent: "#C9A227",
  },
  criador: {
    id: "criador",
    name: "Criador",
    lema: "Se pode ser imaginado, pode ser criado.",
    summary:
      "Você dá forma ao que ainda não existe. Motivado por visão estética, inovação e a necessidade de deixar uma marca única.",
    strengths: [
      "Imaginação fértil e senso estético",
      "Persistência para materializar ideias",
      "Identidade autoral forte",
    ],
    shadows: [
      "Perfeccionismo que trava entregas",
      "Isolamento criativo e medo de julgamento",
      "Identidade fundida demais à obra",
    ],
    life: "Crie ciclos de rascunho → feedback → entrega. A obra viva supera a obra perfeita na gaveta.",
    business:
      "Ideal para design, produto, arte, mídia e marcas autorais. Venda originalidade com processo de produção claro.",
    accent: "#6EC1E4",
  },
};

export const ARCHETYPE_ORDER: ArchetypeId[] = [
  "inocente",
  "sabio",
  "explorador",
  "fora-da-lei",
  "mago",
  "heroi",
  "amante",
  "bobo-da-corte",
  "cara-comum",
  "prestativo",
  "governante",
  "criador",
];

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Uma decisão importante aparece sem aviso. Qual é o seu primeiro impulso?",
    options: [
      {
        id: "q1a",
        text: "Confiar que tudo se ajeita e escolher o caminho mais honesto.",
        weights: { inocente: 3, prestativo: 1 },
      },
      {
        id: "q1b",
        text: "Pesquisar a fundo até entender riscos, dados e padrões.",
        weights: { sabio: 3, governante: 1 },
      },
      {
        id: "q1c",
        text: "Testar o caminho menos óbvio — a descoberta importa mais.",
        weights: { explorador: 3, criador: 1 },
      },
      {
        id: "q1d",
        text: "Agir com força e assumir a responsabilidade do resultado.",
        weights: { heroi: 3, "fora-da-lei": 1 },
      },
    ],
  },
  {
    id: "q2",
    text: "No trabalho, o que mais te energiza no dia a dia?",
    options: [
      {
        id: "q2a",
        text: "Transformar uma visão em algo concreto e original.",
        weights: { criador: 3, mago: 1 },
      },
      {
        id: "q2b",
        text: "Organizar pessoas e recursos para tudo funcionar bem.",
        weights: { governante: 3, heroi: 1 },
      },
      {
        id: "q2c",
        text: "Ajudar alguém a superar um problema real.",
        weights: { prestativo: 3, "cara-comum": 1 },
      },
      {
        id: "q2d",
        text: "Quebrar uma regra inútil que trava o progresso.",
        weights: { "fora-da-lei": 3, explorador: 1 },
      },
    ],
  },
  {
    id: "q3",
    text: "Em um conflito com alguém próximo, você tende a…",
    options: [
      {
        id: "q3a",
        text: "Buscar reconexão emocional e entender o desejo do outro.",
        weights: { amante: 3, prestativo: 1 },
      },
      {
        id: "q3b",
        text: "Aliviar o clima com humor e perspectiva leve.",
        weights: { "bobo-da-corte": 3, inocente: 1 },
      },
      {
        id: "q3c",
        text: "Analisar o que cada lado precisa e propor um acordo justo.",
        weights: { sabio: 2, governante: 2, "cara-comum": 1 },
      },
      {
        id: "q3d",
        text: "Confrontar direto o que está errado, sem rodeios.",
        weights: { heroi: 2, "fora-da-lei": 2 },
      },
    ],
  },
  {
    id: "q4",
    text: "Qual cenário de fim de semana mais te atrai?",
    options: [
      {
        id: "q4a",
        text: "Uma viagem improvisada para um lugar que você nunca foi.",
        weights: { explorador: 3, "bobo-da-corte": 1 },
      },
      {
        id: "q4b",
        text: "Um jantar íntimo, belo e sensorialmente cuidado.",
        weights: { amante: 3, criador: 1 },
      },
      {
        id: "q4c",
        text: "Um encontro simples com amigos de sempre, sem frescura.",
        weights: { "cara-comum": 3, prestativo: 1 },
      },
      {
        id: "q4d",
        text: "Um workshop, livro ou conversa que expanda sua mente.",
        weights: { sabio: 3, mago: 1 },
      },
    ],
  },
  {
    id: "q5",
    text: "Quando um projeto trava, sua reação mais natural é…",
    options: [
      {
        id: "q5a",
        text: "Reimaginar a abordagem até surgir uma solução elegante.",
        weights: { mago: 3, criador: 2 },
      },
      {
        id: "q5b",
        text: "Dobrar o esforço e superar o obstáculo na força.",
        weights: { heroi: 3, governante: 1 },
      },
      {
        id: "q5c",
        text: "Manter a fé e lembrar o time do propósito maior.",
        weights: { inocente: 3, prestativo: 1 },
      },
      {
        id: "q5d",
        text: "Questionar se o sistema inteiro precisa ser redesenhado.",
        weights: { "fora-da-lei": 3, sabio: 1 },
      },
    ],
  },
  {
    id: "q6",
    text: "Como você prefere ser lembrado pelas pessoas?",
    options: [
      {
        id: "q6a",
        text: "Como alguém que elevou o padrão e inspirou coragem.",
        weights: { heroi: 3, governante: 1 },
      },
      {
        id: "q6b",
        text: "Como alguém que fez os outros se sentirem vistos e amados.",
        weights: { amante: 3, prestativo: 2 },
      },
      {
        id: "q6c",
        text: "Como alguém que criou algo único e deixou marca.",
        weights: { criador: 3, mago: 1 },
      },
      {
        id: "q6d",
        text: "Como alguém acessível, justo e parte da comunidade.",
        weights: { "cara-comum": 3, inocente: 1 },
      },
    ],
  },
  {
    id: "q7",
    text: "Diante de uma regra absurda na empresa, você…",
    options: [
      {
        id: "q7a",
        text: "Expõe o absurdo com ironia e provoca o debate.",
        weights: { "bobo-da-corte": 3, "fora-da-lei": 2 },
      },
      {
        id: "q7b",
        text: "Propõe uma estrutura nova, mais clara e eficiente.",
        weights: { governante: 3, sabio: 1 },
      },
      {
        id: "q7c",
        text: "Ajuda quem sofre com a regra a contornar o impacto.",
        weights: { prestativo: 3, "cara-comum": 1 },
      },
      {
        id: "q7d",
        text: "Sai em busca de outro território onde possa ser livre.",
        weights: { explorador: 3, "fora-da-lei": 1 },
      },
    ],
  },
  {
    id: "q8",
    text: "O que mais te motiva a aprender algo novo?",
    options: [
      {
        id: "q8a",
        text: "Compreender a verdade por trás das aparências.",
        weights: { sabio: 3, mago: 1 },
      },
      {
        id: "q8b",
        text: "Ganhar poder para transformar situações difíceis.",
        weights: { mago: 3, heroi: 1 },
      },
      {
        id: "q8c",
        text: "Expressar uma visão criativa que ainda não existe.",
        weights: { criador: 3, amante: 1 },
      },
      {
        id: "q8d",
        text: "Tornar a vida mais leve e divertida para mim e para os outros.",
        weights: { "bobo-da-corte": 3, inocente: 2 },
      },
    ],
  },
  {
    id: "q9",
    text: "Em um grupo novo, qual papel você assume com mais naturalidade?",
    options: [
      {
        id: "q9a",
        text: "O anfitrião que cuida para ninguém ficar de fora.",
        weights: { prestativo: 3, "cara-comum": 1 },
      },
      {
        id: "q9b",
        text: "O catalisador que muda o clima e a direção da conversa.",
        weights: { mago: 2, "bobo-da-corte": 2, amante: 1 },
      },
      {
        id: "q9c",
        text: "O líder que define prioridades e decide o próximo passo.",
        weights: { governante: 3, heroi: 1 },
      },
      {
        id: "q9d",
        text: "O observador curioso que mapeia o território antes de agir.",
        weights: { explorador: 2, sabio: 2 },
      },
    ],
  },
  {
    id: "q10",
    text: "Qual medo mais te incomoda admitir?",
    options: [
      {
        id: "q10a",
        text: "Ser engolido pela mediocridade ou pela rotina.",
        weights: { explorador: 2, criador: 2, "fora-da-lei": 1 },
      },
      {
        id: "q10b",
        text: "Perder o controle e ver o caos dominar.",
        weights: { governante: 3, heroi: 1 },
      },
      {
        id: "q10c",
        text: "Ser rejeitado ou ficar emocionalmente só.",
        weights: { amante: 3, "cara-comum": 1 },
      },
      {
        id: "q10d",
        text: "Descobrir que o mundo não é tão bom quanto eu esperava.",
        weights: { inocente: 3, prestativo: 1 },
      },
    ],
  },
  {
    id: "q11",
    text: "Se pudesse redesenhar sua marca pessoal, o que priorizaria?",
    options: [
      {
        id: "q11a",
        text: "Autoridade, excelência e presença inconfundível.",
        weights: { governante: 2, heroi: 2, criador: 1 },
      },
      {
        id: "q11b",
        text: "Proximidade, humor e humanidade sem pose.",
        weights: { "bobo-da-corte": 2, "cara-comum": 2, inocente: 1 },
      },
      {
        id: "q11c",
        text: "Mistério, visão e capacidade de virar o jogo.",
        weights: { mago: 3, "fora-da-lei": 1 },
      },
      {
        id: "q11d",
        text: "Beleza, conexão e experiências memoráveis.",
        weights: { amante: 3, criador: 1 },
      },
    ],
  },
  {
    id: "q12",
    text: "Olhando cinco anos à frente, o sucesso ideal para você é…",
    options: [
      {
        id: "q12a",
        text: "Ter construído um sistema sólido que outros confiam e seguem.",
        weights: { governante: 3, sabio: 1 },
      },
      {
        id: "q12b",
        text: "Ter ajudado muitas pessoas a viver melhor.",
        weights: { prestativo: 3, inocente: 1 },
      },
      {
        id: "q12c",
        text: "Ter vivido livre, com histórias e horizontes ampliados.",
        weights: { explorador: 3, "bobo-da-corte": 1 },
      },
      {
        id: "q12d",
        text: "Ter materializado uma obra ou movimento que muda o jogo.",
        weights: { criador: 2, mago: 2, "fora-da-lei": 1 },
      },
    ],
  },
];

/** Set to `true` to show the email/WhatsApp capture modal before results. */
export const LEAD_CAPTURE_ENABLED = false;

export function emptyScores(): Record<ArchetypeId, number> {
  return ARCHETYPE_ORDER.reduce(
    (acc, id) => {
      acc[id] = 0;
      return acc;
    },
    {} as Record<ArchetypeId, number>,
  );
}

export function scoreAnswers(
  answers: Record<string, string>,
): Record<ArchetypeId, number> {
  const scores = emptyScores();
  for (const question of QUESTIONS) {
    const optionId = answers[question.id];
    if (!optionId) continue;
    const option = question.options.find((o) => o.id === optionId);
    if (!option) continue;
    for (const [id, weight] of Object.entries(option.weights)) {
      const key = id as ArchetypeId;
      if (key in scores && typeof weight === "number") {
        scores[key] += weight;
      }
    }
  }
  return scores;
}

export type RankedArchetype = {
  id: ArchetypeId;
  score: number;
  percent: number;
};

export function rankArchetypes(
  scores: Record<ArchetypeId, number>,
): RankedArchetype[] {
  const max = Math.max(1, ...Object.values(scores));
  return ARCHETYPE_ORDER.map((id) => ({
    id,
    score: scores[id],
    // Affinity relative to the user's strongest archetype (dominant = 100%).
    percent: Math.round((scores[id] / max) * 100),
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function formatShareText(
  dominant: Archetype,
  secondary: Archetype,
  dominantPct: number,
  secondaryPct: number,
): string {
  return [
    `Meu arquétipo dominante: ${dominant.name} (${dominantPct}% de afinidade)`,
    `Lema: "${dominant.lema}"`,
    `Secundário: ${secondary.name} (${secondaryPct}%)`,
    "",
    dominant.summary,
    "",
    "Descubra o seu em Arquétipo.",
  ].join("\n");
}
