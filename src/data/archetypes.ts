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
  /** Short shareable line — the vibe people quote. */
  vibe: string;
  /** Longer energy / “era” description. */
  era: string;
  greenFlags: string[];
  redFlags: string[];
  /** Where this archetype lights up in life, work, and online. */
  ondeBrilha: string;
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
    vibe: "Ainda acredito que pode dar certo — e isso não é ingenuidade, é escolha.",
    era: "Sua era é a do feed limpo e da conversa sem cinismo. Você protege um núcleo de esperança mesmo quando o algoritmo empurra pânico. Amigos te procuram pra lembrar que não está tudo perdido.",
    greenFlags: [
      "Fala o que sente sem performance",
      "Mantém fé sem ignorar o que dói",
      "Cria espaços onde dá pra baixar a guarda",
    ],
    redFlags: [
      "Evita conflito até o close friends virar pressão",
      "Confia demais em narrativa bonita",
      "Precisa de validação constante pra se sentir ok",
    ],
    ondeBrilha:
      "Comunidades acolhedoras, wellness honesto, educação leve e marcas que prometem clareza sem gaslighting. Você vende paz que ainda parece verdadeira.",
    accent: "#E8C547",
  },
  sabio: {
    id: "sabio",
    name: "Sábio",
    vibe: "Antes de opinar, eu abro 14 abas — e ainda acho pouco.",
    era: "Sua era é thread longa, podcast 2h e print de artigo. Você desconfia do hype até entender o mecanismo. No Discord, é a pessoa que manda o link certo no meio do caos.",
    greenFlags: [
      "Separa fato de vibe com paciência",
      "Explica complexo sem humilhar",
      "Pensa em segundo e terceiro efeito",
    ],
    redFlags: [
      "Paralisia por pesquisa infinita",
      "Fica frio quando o assunto é sentimento",
      "Usa inteligência pra se afastar em vez de chegar",
    ],
    ondeBrilha:
      "Pesquisa, educação, data, consultoria e conteúdo que reduz ansiedade com clareza. Você é a voz anti-FOMO com método.",
    accent: "#7C9CFF",
  },
  explorador: {
    id: "explorador",
    name: "Explorador",
    vibe: "Se a rotina apertar o peito, eu já estou no próximo mapa.",
    era: "Sua era é aba anônima, cidade nova, servidor novo. Identidade pra você é movimento — não um bio fixo. Prefere errar longe a acertar preso.",
    greenFlags: [
      "Entra no desconhecido sem pedir roteiro",
      "Adapta rápido quando o plano quebra",
      "Inspira gente travada a tentar outra rota",
    ],
    redFlags: [
      "Some quando compromisso pede presença",
      "Coleciona começos e evita finais",
      "Confunde liberdade com fuga",
    ],
    ondeBrilha:
      "Viagem, outdoor, startups, creator nomad e produtos de descoberta. Venda liberdade com um ritual mínimo de âncora — senão a vibe vira só escape.",
    accent: "#3DD6C6",
  },
  "fora-da-lei": {
    id: "fora-da-lei",
    name: "Fora-da-lei",
    vibe: "Se a regra é injusta, eu não vou performar obediência.",
    era: "Sua era é reply afiado, desabafo sem filtro e lado B do algoritmo. Você sente cheiro de sistema podre e não consegue fingir que está tudo ok só pra manter paz falsa.",
    greenFlags: [
      "Nomeia o absurdo quando ninguém quer",
      "Protege quem a regra esmaga",
      "Transforma revolta em movimento concreto",
    ],
    redFlags: [
      "Rebela por reflexo, sem projeto",
      "Queima ponte antes de construir saída",
      "Confunde autenticidade com autossabotagem",
    ],
    ondeBrilha:
      "Ativismo, underground, tech disruptiva e marcas anti-pose. Você brilha quando a ruptura tem proposta — não só vibe de cancelamento.",
    accent: "#E85D4C",
  },
  mago: {
    id: "mago",
    name: "Mago",
    vibe: "Eu não só vejo o padrão — eu mudo o clima da sala.",
    era: "Sua era é 2am com insight que reorganiza a semana. Você conecta pessoas, ideias e timing como se fosse óbvio. Pro mundo parece mágica; pra você é leitura de campo.",
    greenFlags: [
      "Enxerga o subtexto do grupo",
      "Vira chave sem precisar gritar",
      "Traduz visão em experimento testável",
    ],
    redFlags: [
      "Manipula com cara de visão",
      "Promete transformação sem operacional",
      "Se isola quando ninguém ‘pega’ a ideia",
    ],
    ondeBrilha:
      "Branding, produto, coaching de virada e inovação. Você vende a sensação de ‘agora faz sentido’ — desde que entregue o passo a passo.",
    accent: "#A78BFA",
  },
  heroi: {
    id: "heroi",
    name: "Herói",
    vibe: "Se tá difícil, eu entro. Depois a gente conversa sobre descanso.",
    era: "Sua era é streak, meta batida e inbox zerada às 23h. Você prova valor na entrega — e odeia parecer fraco no feed ou no time. Burnout digital te conhece pelo nome.",
    greenFlags: [
      "Segura pressão sem sumir",
      "Puxa o padrão pra cima pelo exemplo",
      "Transforma crise em missão clara",
    ],
    redFlags: [
      "Trabalha até apagar e chama de disciplina",
      "Pedir ajuda parece derrota",
      "Competição esvazia amizade",
    ],
    ondeBrilha:
      "Performance, esporte, carreira high-stakes e produtos de alta exigência. Sua narrativa de conquista só sustenta se incluir recuperação de verdade.",
    accent: "#F0A500",
  },
  amante: {
    id: "amante",
    name: "Amante",
    vibe: "Eu quero sentir de verdade — não só curtir e seguir.",
    era: "Sua era é estética 2am, playlist íntima e conversa que passa da meia-noite. Você lê o mood da pessoa antes do texto. Conexão > clout.",
    greenFlags: [
      "Presença emocional que desarma",
      "Senso estético que eleva o cotidiano",
      "Cria vínculo sem forçar performance",
    ],
    redFlags: [
      "Idealiza e depois se machuca com a realidade",
      "Decide só no feeling quando precisava de limite",
      "Medo de ficar só vira clingy ou ghosting",
    ],
    ondeBrilha:
      "Moda, hospitalidade, arte, bem-estar e marcas sensoriais. Você vende desejo com honestidade — sem romance tóxico disfarçado de profundidade.",
    accent: "#E879A9",
  },
  "bobo-da-corte": {
    id: "bobo-da-corte",
    name: "Bobo da Corte",
    vibe: "Se ninguém riu ainda, eu assumo o risco do primeiro meme.",
    era: "Sua era é story caótico, call no Discord e humor que corta tensão sem ser cruel. Você lembra o grupo que a vida não é só productivity porn.",
    greenFlags: [
      "Quebra gelo sem humilhar",
      "Improvisa quando o plano morre",
      "Usa leveza pra abrir assunto difícil",
    ],
    redFlags: [
      "Piada vira escudo pra não se comprometer",
      "Foge do sério até virar distância",
      "Medo de ser levado a sério demais",
    ],
    ondeBrilha:
      "Conteúdo, entretenimento, eventos e marcas com cultura jovem. Sua alegria vira poder quando também segura o peso da conversa.",
    accent: "#F4C430",
  },
  "cara-comum": {
    id: "cara-comum",
    name: "Cara Comum",
    vibe: "Sem pose. Se funciona na vida real, já é luxo.",
    era: "Sua era é grupo do zap da faculdade, almoço barato e feed sem estética forçada. Você desconfia de guru e prefere o que a maioria consegue viver de verdade.",
    greenFlags: [
      "Fala acessível, sem jargão pra impressionar",
      "Mantém pé no chão quando o hype explode",
      "Faz a comunidade se sentir incluída",
    ],
    redFlags: [
      "Se esconde pra não brilhar",
      "Confunde pertencimento com se apagar",
      "Resente quem ousa mais sem admitir inveja",
    ],
    ondeBrilha:
      "Produtos do dia a dia, serviços essenciais e marcas de confiança sem glamour fake. Você vende inclusão com realismo — não discurso vazio de ‘somos todos iguais’.",
    accent: "#8FA3B8",
  },
  prestativo: {
    id: "prestativo",
    name: "Prestativo",
    vibe: "Se alguém tá mal no close friends, eu já tô no privado.",
    era: "Sua era é ser o emotional support friend do servidor. Você sente o burnout alheio antes do ‘tô bem’. Cuidar é o seu idioma — e também o seu risco.",
    greenFlags: [
      "Escuta sem transformar em conselho automático",
      "Aparece na crise, não só no story feliz",
      "Cria segurança emocional no grupo",
    ],
    redFlags: [
      "Diz sim até se esvaziar",
      "Ajuda que gera dependência",
      "Culpa quando coloca limite",
    ],
    ondeBrilha:
      "Saúde, educação, RH, suporte e comunidades de cuidado. Você brilha quando reciprocidade entra no contrato — cuidar de si não é egoísmo.",
    accent: "#5BB8A8",
  },
  governante: {
    id: "governante",
    name: "Governante",
    vibe: "Alguém precisa organizar o caos — e eu não vou fingir que não sou essa pessoa.",
    era: "Sua era é planilha, papel definido e call que termina com dono de cada tarefa. Você quer sistemas que protejam o grupo, não só status no LinkedIn.",
    greenFlags: [
      "Decide quando todo mundo trava",
      "Cria ordem sem precisar de caos teatral",
      "Pensa legado e estabilidade de longo prazo",
    ],
    redFlags: [
      "Controla demais e sufoca o time",
      "Medo de bagunça trava inovação",
      "Usa cargo pra cobrir insegurança",
    ],
    ondeBrilha:
      "Gestão, operações, luxury com substância e marcas de autoridade. Você vende estabilidade premium — liderança como serviço, não ego.",
    accent: "#C9A227",
  },
  criador: {
    id: "criador",
    name: "Criador",
    vibe: "Se ainda não existe do jeito que eu imagino, eu faço.",
    era: "Sua era é moodboard às 2am, rascunho no Notes e obsessão por estética que carrega identidade. O algoritmo tenta te encaixar; você insiste em assinatura própria.",
    greenFlags: [
      "Materializa ideia em coisa tocável",
      "Mantém voz autoral sob pressão de tendência",
      "Itera sem perder a visão",
    ],
    redFlags: [
      "Perfeccionismo que nunca posta",
      "Identidade fundida demais à obra",
      "Isola-se no processo e some do mundo",
    ],
    ondeBrilha:
      "Design, produto, arte, mídia e marcas autorais. Você vende originalidade com processo: rascunho → feedback → entrega viva.",
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

/**
 * 12 Gen Z dilemmas — each option weights primary (3) + secondary (1)
 * so the twelve archetypes stay roughly balanced across the quiz.
 */
export const QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Você abre o celular e o feed já vem carregado de urgência. Qual é o seu primeiro movimento?",
    options: [
      {
        id: "q1a",
        text: "Silencio notificações e escolho só o que me deixa inteiro.",
        weights: { inocente: 3, prestativo: 1 },
      },
      {
        id: "q1b",
        text: "Abro abas, cruzo fontes e só então formo opinião.",
        weights: { sabio: 3, governante: 1 },
      },
      {
        id: "q1c",
        text: "Saio do app e vou atrás de algo que o algoritmo não escolheu pra mim.",
        weights: { explorador: 3, criador: 1 },
      },
      {
        id: "q1d",
        text: "Uso a pressão como combustível e ataco a próxima meta.",
        weights: { heroi: 3, "fora-da-lei": 1 },
      },
    ],
  },
  {
    id: "q2",
    text: "No Discord / close friends, o clima fica pesado. O que você faz?",
    options: [
      {
        id: "q2a",
        text: "Manda áudio curto pra quem tá mal e oferece presença de verdade.",
        weights: { prestativo: 3, "cara-comum": 1 },
      },
      {
        id: "q2b",
        text: "Muda o mood com humor — sem invalidar o que rolou.",
        weights: { "bobo-da-corte": 3, inocente: 1 },
      },
      {
        id: "q2c",
        text: "Lê o subtexto do grupo e propõe um reset de conversa.",
        weights: { mago: 3, amante: 1 },
      },
      {
        id: "q2d",
        text: "Organiza: o que é fato, o que é rumor, quem decide o quê.",
        weights: { governante: 3, sabio: 1 },
      },
    ],
  },
  {
    id: "q3",
    text: "Algoritmo vs identidade: a plataforma empurra um ‘você’ que rende view. Você…",
    options: [
      {
        id: "q3a",
        text: "Posta o que é seu, mesmo se engajar menos.",
        weights: { criador: 3, inocente: 1 },
      },
      {
        id: "q3b",
        text: "Estuda o jogo, depois decide o que vale a pena jogar.",
        weights: { sabio: 2, mago: 2 },
      },
      {
        id: "q3c",
        text: "Recusa o moldinho e aponta o absurdo do incentivo.",
        weights: { "fora-da-lei": 3, explorador: 1 },
      },
      {
        id: "q3d",
        text: "Entrega no nível máximo — quer provar que consegue no próprio critério.",
        weights: { heroi: 3, governante: 1 },
      },
    ],
  },
  {
    id: "q4",
    text: "É 2am. A estética da noite te puxa. O que você faz com essa energia?",
    options: [
      {
        id: "q4a",
        text: "Monta moodboard / rascunho de algo que ainda não existe.",
        weights: { criador: 3, mago: 1 },
      },
      {
        id: "q4b",
        text: "Manda mensagem íntima ou curte a vibe com quem importa.",
        weights: { amante: 3, prestativo: 1 },
      },
      {
        id: "q4c",
        text: "Cai numa spiral de pesquisa até achar o ‘porquê’ do que te inquieta.",
        weights: { sabio: 3, explorador: 1 },
      },
      {
        id: "q4d",
        text: "Ri sozinho de um meme e manda no grupo pra aliviar a cabeça.",
        weights: { "bobo-da-corte": 3, "cara-comum": 1 },
      },
    ],
  },
  {
    id: "q5",
    text: "Burnout digital bate: cérebro em 4K, corpo em 144p. Sua reação mais natural?",
    options: [
      {
        id: "q5a",
        text: "Forço mais um sprint — ‘depois eu descanso de verdade’.",
        weights: { heroi: 3, governante: 1 },
      },
      {
        id: "q5b",
        text: "Desapareço um tempo e volto quando a identidade respirar.",
        weights: { explorador: 3, inocente: 1 },
      },
      {
        id: "q5c",
        text: "Peço (ou ofereço) cuidado concreto: comida, call, silêncio compartilhado.",
        weights: { prestativo: 3, amante: 1 },
      },
      {
        id: "q5d",
        text: "Redesenho o sistema: limites, stack, rituais — pra não repetir.",
        weights: { mago: 2, criador: 2, sabio: 1 },
      },
    ],
  },
  {
    id: "q6",
    text: "Surge uma regra injusta no trampo / faculdade / servidor. Você…",
    options: [
      {
        id: "q6a",
        text: "Expõe o absurdo com ironia e abre o debate.",
        weights: { "bobo-da-corte": 2, "fora-da-lei": 3 },
      },
      {
        id: "q6b",
        text: "Propõe uma estrutura nova, clara e justa.",
        weights: { governante: 3, sabio: 1 },
      },
      {
        id: "q6c",
        text: "Protege quem a regra fere e ajuda a contornar o dano.",
        weights: { prestativo: 3, "cara-comum": 1 },
      },
      {
        id: "q6d",
        text: "Procura outro território onde não precise performar obediência.",
        weights: { explorador: 3, "fora-da-lei": 1 },
      },
    ],
  },
  {
    id: "q7",
    text: "Propósito: alguém pergunta ‘o que você quer da vida?’ no meio da call. Você sente…",
    options: [
      {
        id: "q7a",
        text: "Vontade de construir algo único que carregue a minha assinatura.",
        weights: { criador: 3, amante: 1 },
      },
      {
        id: "q7b",
        text: "Vontade de deixar o mundo um pouco menos hostil pra quem vem depois.",
        weights: { prestativo: 2, inocente: 3 },
      },
      {
        id: "q7c",
        text: "Vontade de entender o jogo fundo o bastante pra mudar as regras.",
        weights: { mago: 3, sabio: 1 },
      },
      {
        id: "q7d",
        text: "Vontade de viver livre, com histórias — não um roteiro engessado.",
        weights: { explorador: 3, "bobo-da-corte": 1 },
      },
    ],
  },
  {
    id: "q8",
    text: "Em um grupo novo (faculdade, trampo, server), qual papel cai natural?",
    options: [
      {
        id: "q8a",
        text: "O que garante que ninguém fica no canto.",
        weights: { prestativo: 2, "cara-comum": 3 },
      },
      {
        id: "q8b",
        text: "O que muda o clima e a direção sem parecer chefe.",
        weights: { mago: 2, "bobo-da-corte": 2, amante: 1 },
      },
      {
        id: "q8c",
        text: "O que define prioridade e fecha o próximo passo.",
        weights: { governante: 3, heroi: 1 },
      },
      {
        id: "q8d",
        text: "O que observa o território antes de se posicionar.",
        weights: { explorador: 2, sabio: 2 },
      },
    ],
  },
  {
    id: "q9",
    text: "Qual medo mais te incomoda admitir em voz alta?",
    options: [
      {
        id: "q9a",
        text: "Ser engolido pela mediocridade / rotina / bio genérica.",
        weights: { explorador: 2, criador: 2, "fora-da-lei": 1 },
      },
      {
        id: "q9b",
        text: "Perder o controle e ver o caos dominar o que construí.",
        weights: { governante: 3, heroi: 1 },
      },
      {
        id: "q9c",
        text: "Ser rejeitado ou ficar emocionalmente só no meio da multidão online.",
        weights: { amante: 3, "cara-comum": 1 },
      },
      {
        id: "q9d",
        text: "Descobrir que o mundo (e as pessoas) não são tão bons quanto eu esperava.",
        weights: { inocente: 3, prestativo: 1 },
      },
    ],
  },
  {
    id: "q10",
    text: "Seu perfil pessoal vira ‘marca’ por um mês. O que você prioriza?",
    options: [
      {
        id: "q10a",
        text: "Autoridade, excelência e presença inconfundível.",
        weights: { governante: 2, heroi: 2, criador: 1 },
      },
      {
        id: "q10b",
        text: "Proximidade, humor e humanidade sem pose.",
        weights: { "bobo-da-corte": 2, "cara-comum": 2, inocente: 1 },
      },
      {
        id: "q10c",
        text: "Mistério, visão e capacidade de virar o jogo.",
        weights: { mago: 3, "fora-da-lei": 1 },
      },
      {
        id: "q10d",
        text: "Beleza, conexão e experiências que a pessoa sente na pele.",
        weights: { amante: 3, criador: 1 },
      },
    ],
  },
  {
    id: "q11",
    text: "Um projeto trava no pior momento (deadline + notificação + dúvida). Você…",
    options: [
      {
        id: "q11a",
        text: "Reimagina a abordagem até surgir uma saída elegante.",
        weights: { mago: 3, criador: 2 },
      },
      {
        id: "q11b",
        text: "Dobra o esforço e empurra o obstáculo na raça.",
        weights: { heroi: 3, governante: 1 },
      },
      {
        id: "q11c",
        text: "Lembra o time do ‘pra quê’ e segura a fé no meio do caos.",
        weights: { inocente: 3, prestativo: 1 },
      },
      {
        id: "q11d",
        text: "Questiona se o sistema inteiro precisa ser redesenhado.",
        weights: { "fora-da-lei": 3, sabio: 1 },
      },
    ],
  },
  {
    id: "q12",
    text: "Daqui a cinco anos, sucesso de verdade pra você parece…",
    options: [
      {
        id: "q12a",
        text: "Um sistema sólido que outras pessoas confiam e seguem.",
        weights: { governante: 3, sabio: 1 },
      },
      {
        id: "q12b",
        text: "Ter ajudado muita gente a viver com menos peso.",
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
  const greens = dominant.greenFlags.slice(0, 2).join(" · ");
  return [
    `Meu arquétipo: ${dominant.name} (${dominantPct}%)`,
    `Vibe: ${dominant.vibe}`,
    `Era: ${dominant.era}`,
    `Green flags: ${greens}`,
    `Secundário: ${secondary.name} (${secondaryPct}%) — ${secondary.vibe}`,
    "",
    "Descobre o seu no Arquétipo ✨",
  ].join("\n");
}
