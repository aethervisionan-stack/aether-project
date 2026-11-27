/**
 * Compatibilidade por distância no círculo do zodíaco (passos de 30°).
 * Preciso: ângulo signo-a-signo, elemento, ritmo, planetas do signo.
 * Não substitui mapa de casal com horários e locais reais.
 */
import { SIGN_ORDER, ZODIAC_DATA } from '../data/zodiacData.js';

const ASPECTS = {
  0: {
    id: 'conjunction',
    name: 'Conjunção',
    angle: 0,
    category: 'mesma frequência',
    tone: 'mesmo “canal”',
    badge: 'mesmo signo',
  },
  1: {
    id: 'semisextile',
    name: 'Semissextil',
    angle: 30,
    category: 'ajuste fino',
    tone: 'vizinhos no zodíaco',
    badge: '30°',
  },
  2: {
    id: 'sextile',
    name: 'Sextil',
    angle: 60,
    category: 'flui fácil',
    tone: 'boa oportunidade a dois',
    badge: '60°',
  },
  3: {
    id: 'square',
    name: 'Quadratura',
    angle: 90,
    category: 'atrito que ensina',
    tone: 'atrito criativo',
    badge: '90°',
  },
  4: {
    id: 'trine',
    name: 'Trígono',
    angle: 120,
    category: 'flui fácil',
    tone: 'mesmo elemento, fácil',
    badge: '120°',
  },
  5: {
    id: 'quincunx',
    name: 'Quincúncio',
    angle: 150,
    category: 'atrito que ensina',
    tone: 'sempre recalibrando',
    badge: '150°',
  },
  6: {
    id: 'opposition',
    name: 'Oposição',
    angle: 180,
    category: 'puxa e completa',
    tone: 'espelho no outro polo',
    badge: '180°',
  },
};

const ELEMENT_MATRIX = {
  Fogo: {
    Fogo: {
      label: 'Dois Fogos',
      summary: 'Dois fogos acendem desejo, iniciativa e drama. Tem calor na hora — e risco de um queimar o ritmo do outro.',
      chemistry: 'alta',
      mind: 'rápida / competitiva',
      home: 'agitada, pouco de rotina',
    },
    Terra: {
      label: 'Fogo + Terra',
      summary: 'Fogo inspira; Terra concretiza. Ação encontra estabilidade — funciona se respeitarem o tempo um do outro.',
      chemistry: 'média-alta',
      mind: 'visão × pé no chão',
      home: 'precisa combinar ritmo e dinheiro/tempo',
    },
    Ar: {
      label: 'Fogo + Ar',
      summary: 'Ar alimenta o fogo: ideias, flerte mental e movimento. Clássico de estímulo e liberdade.',
      chemistry: 'alta',
      mind: 'estimulante e falante',
      home: 'leve, social, pouco grudenta',
    },
    Água: {
      label: 'Fogo + Água',
      summary: 'Vapor e intensidade: paixão que pode virar névoa emocional. Cuidado para não apagar nem escaldar.',
      chemistry: 'alta / volátil',
      mind: 'intuição × impulso',
      home: 'clima sobe e desce — depende da maturidade',
    },
  },
  Terra: {
    Terra: {
      label: 'Duas Terras',
      summary: 'Raiz em dobro: lealdade, corpo, valores e construção lenta. Muita segurança; pouca surpresa.',
      chemistry: 'média / sensual',
      mind: 'prática e concreta',
      home: 'estável, sensorial, previsível',
    },
    Fogo: {
      label: 'Terra + Fogo',
      summary: 'Terra segura o fogo; fogo aquece a terra. Bom para projetos e desejo se o ego não travar o movimento.',
      chemistry: 'média-alta',
      mind: 'pé no chão × visão',
      home: 'negociar espontaneidade vs. rotina',
    },
    Ar: {
      label: 'Terra + Ar',
      summary: 'Ideias encontram matéria — ou ficam no ar. Precisam traduzir a linguagem (corpo × mente).',
      chemistry: 'média',
      mind: 'complementar com esforço',
      home: 'um quer chão; o outro, janela aberta',
    },
    Água: {
      label: 'Terra + Água',
      summary: 'Combinação fértil: cuidado, carinho e intimidade no corpo. Bom solo para morar e criar juntos.',
      chemistry: 'alta / afetiva',
      mind: 'empática e prática',
      home: 'ninho confortável e protetor',
    },
  },
  Ar: {
    Ar: {
      label: 'Dois Ares',
      summary: 'Mentes em conversa constante. Liberdade, humor e ideias — risco de evitar o corpo e o compromisso fundo.',
      chemistry: 'mental / flerte',
      mind: 'excelente',
      home: 'leve, conversada, às vezes distante',
    },
    Fogo: {
      label: 'Ar + Fogo',
      summary: 'Um estimula o outro: Ar espalha a chama, Fogo dá calor às ideias. Parceria viva e pouco ciumenta por natureza.',
      chemistry: 'alta',
      mind: 'rápida e inspiradora',
      home: 'social e independente',
    },
    Terra: {
      label: 'Ar + Terra',
      summary: 'Teoria encontra prática. Pode virar respeito mútuo ou frustração se um invalidar o estilo do outro.',
      chemistry: 'média',
      mind: 'precisa de tradução',
      home: 'combinem espaço e deveres com clareza',
    },
    Água: {
      label: 'Ar + Água',
      summary: 'Poesia e análise: Água sente, Ar nomeia. Fica belo se o Ar não transformar a dor da Água em “só conversa”.',
      chemistry: 'média-alta / sutil',
      mind: 'empática se houver escuta',
      home: 'atmosférica, artística, sensível',
    },
  },
  Água: {
    Água: {
      label: 'Duas Águas',
      summary: 'Oceano compartilhado: empatia, fusão e intuição. Intimidade profunda — e risco de misturar limites.',
      chemistry: 'muito alta / emocional',
      mind: 'quase telepática, pouco literal',
      home: 'ninho emocional intenso',
    },
    Fogo: {
      label: 'Água + Fogo',
      summary: 'Paixão e vulnerabilidade em tensão. Pode ser alquimia ou tempestade — depende de freio e cuidado.',
      chemistry: 'alta / dramática',
      mind: 'emocional × impulsiva',
      home: 'precisa de rituais de segurança',
    },
    Terra: {
      label: 'Água + Terra',
      summary: 'Cuidado mútuo e sensualidade. Terra oferece chão; Água oferece profundidade — combinação clássica de morar junto.',
      chemistry: 'alta / nutritiva',
      mind: 'gentil e prática',
      home: 'doméstica e protetora',
    },
    Ar: {
      label: 'Água + Ar',
      summary: 'Sentir e pensar em dança. Ar pode refrescar a Água; Água humaniza o Ar — se houver paciência com ritmos diferentes.',
      chemistry: 'média-alta',
      mind: 'complementar',
      home: 'precisa de espaço emocional e mental',
    },
  },
};

const MODALITY_MATRIX = {
  Cardeal: {
    Cardeal: {
      label: 'Dois Cardeais',
      summary: 'Dois iniciadores: liderança dos dois lados, projetos em série e risco de briga por quem decide.',
      tip: 'Alternem quem manda e comecem coisas juntos.',
    },
    Fixo: {
      label: 'Cardeal + Fixo',
      summary: 'Um começa, o outro sustenta. Forte se o Fixo não travar e o Cardeal não sumir no meio.',
      tip: 'Cardeal traz prazos; Fixo traz rituais que mantêm o ritmo.',
    },
    Mutável: {
      label: 'Cardeal + Mutável',
      summary: 'Começo encontra adaptação. O Mutável flexiona; o Cardeal aponta o norte — ótimo se ninguém cobrar rigidez.',
      tip: 'Cardeal define o “para onde”; Mutável escolhe as rotas.',
    },
  },
  Fixo: {
    Fixo: {
      label: 'Dois Fixos',
      summary: 'Lealdade e teimosia em dobro. Vínculo que dura; mudanças pedem conversa paciente.',
      tip: 'Marquem revisões de propósito — senão o casal engessa.',
    },
    Cardeal: {
      label: 'Fixo + Cardeal',
      summary: 'Estabilidade versus impulso. Pode virar admiração ou impasse sobre ritmo e controle.',
      tip: 'Fixo ancora; Cardeal inaugura — combinem etapas claras.',
    },
    Mutável: {
      label: 'Fixo + Mutável',
      summary: 'Raiz encontra vento. O Fixo quer constância; o Mutável, variedade — atrito clássico de estilo.',
      tip: 'Deixem zonas fixas (casa, valores) e zonas mutáveis (lazer, aprendizado).',
    },
  },
  Mutável: {
    Mutável: {
      label: 'Dois Mutáveis',
      summary: 'Flexibilidade no máximo, planos fluidos. Adaptam-se bem — às vezes demais, sem âncora.',
      tip: 'Criem âncoras leves (rotina simples, metas escritas) para o vínculo não se dispersar.',
    },
    Cardeal: {
      label: 'Mutável + Cardeal',
      summary: 'Adaptação a serviço da iniciativa. Energiza se o Mutável não se sentir só “ajuste” permanente.',
      tip: 'Valorizem a inteligência adaptativa do Mutável como poder, não só suporte.',
    },
    Fixo: {
      label: 'Mutável + Fixo',
      summary: 'Mudança versus permanência. Cresce quando o Fixo confia e o Mutável honra o combinado-base.',
      tip: 'Combinem o que é inegociável (Fixo) e o que pode flutuar (Mutável).',
    },
  },
};

const ASPECT_COPY = {
  conjunction: {
    dynamic: (a, b) =>
      a === b
        ? `Dois ${a} sob a mesma estrela: se reconhecem na hora. A conjunção mistura motivações — e também as mesmas sombras.`
        : `${a} e ${b} na mesma “casa” do círculo: fusão de propósito.`,
    chemistry: (a, b) =>
      `Atração por familiaridade: ${a} vê em ${b} um espelho do próprio elemento e ritmo. O desejo nasce de “finalmente alguém que fala minha língua”.`,
    communication: (a, b) =>
      `A conversa costuma ser intuitiva e rápida no território do signo. O risco é repetir os mesmos pontos cegos sem ninguém de fora contradizer.`,
    affection: (a, b) =>
      `Morar junto flui no estilo de ${a}: mesmos rituais, mesmos gatilhos. Muito conforto; crescer juntos pede consciência.`,
    challenge: (a, b) =>
      `Competição sutil pelo mesmo “papel” no vínculo e reforço mútuo dos excessos típicos de ${a}.`,
    tips: (a) => [
      `Nomeiem a sombra clássica de ${a} e façam um pacto de não alimentá-la juntos.`,
      `Busquem amigos ou projetos de signos complementares para oxigenar o casal.`,
      `Celebrem a fusão, mas guardem hobbies individuais para não virarem a mesma pessoa.`,
    ],
  },
  semisextile: {
    dynamic: (a, b) =>
      `${a} e ${b} são vizinhos no zodíaco (30°): perto, mas não iguais. O semissextil pede cortesia e ajuste fino — como apartamentos na mesma parede.`,
    chemistry: (a, b) =>
      `Atração discreta e curiosa. Não é paixão óbvia de elemento, mas interesse por quem está “logo ao lado” do próprio mundo.`,
    communication: (a, b) =>
      `Precisam traduzir o óbvio: o que é claro para ${a} pode ser lateral para ${b}. Paciência na fala rende muito.`,
    affection: (a, b) =>
      `Morar junto melhora com micro-hábitos compartilhados. O carinho cresce na rotina, não no impacto inicial.`,
    challenge: (a, b) =>
      `Irritações pequenas e crônicas — diferenças de ritmo que parecem “bobas” até acumularem.`,
    tips: () => [
      'Tratem diferenças menores como preferências, não como defeito de caráter.',
      'Criem um ritual semanal de alinhamento prático (agenda, dinheiro, descanso).',
      'Evitem ironias sobre o “jeito estranho” do outro — esse ângulo é sensível a microdesdém.',
    ],
  },
  sextile: {
    dynamic: (a, b) =>
      `Sextil (60°) entre ${a} e ${b}: porta aberta. Há boa vontade natural e estímulo sem drama — alguém precisa atravessar a porta.`,
    chemistry: (a, b) =>
      `Química amigável e estimulante. O desejo cresce na conversa, no projeto conjunto e no prazer de facilitar a vida um do outro.`,
    communication: (a, b) =>
      `As mentes se encontram com facilidade relativa. ${a} e ${b} tendem a trocar ideias úteis e feedback construtivo.`,
    affection: (a, b) =>
      `Afeto leve, social e colaborativo. Boa base de amizade-amor; a profundidade depende de escolha consciente.`,
    challenge: (a, b) =>
      `Risco de comodismo: o sextil é tão fácil que o casal pode não investir na intimidade mais profunda.`,
    tips: () => [
      'Transformem a facilidade em projetos concretos a dois.',
      'Agendem conversas honestas — não só as agradáveis.',
      'Usem a boa vontade para falar de dinheiro, sexo e futuro sem medo de “estragar o clima”.',
    ],
  },
  square: {
    dynamic: (a, b) =>
      `Quadratura (90°) entre ${a} e ${b}: atrito que gera movimento. Há tensão de agendas — e potencial de crescimento se os dois aceitarem o desafio.`,
    chemistry: (a, b) =>
      `Atração por fricção: o outro provoca, acelera, irrita e excita. Química alta quando a rivalidade vira eros, não guerra.`,
    communication: (a, b) =>
      `Diálogos podem esquentar rápido. ${a} e ${b} precisam de regras de combate justo — senão cada conversa vira arena.`,
    affection: (a, b) =>
      `Morar junto exige negociar território e ritmo o tempo todo. Tem paixão; conforto doméstico pede trabalho.`,
    challenge: (a, b) =>
      `Choque de vontades e estilo: cada um aperta o ponto cego do outro com precisão irritante.`,
    tips: () => [
      'Separem “problema a resolver” de “quem está certo”.',
      'Usem pausas combinadas quando a discussão esquentar.',
      'Canalizem a tensão em meta compartilhada (esporte, obra, causa) em vez de crítica pessoal.',
    ],
  },
  trine: {
    dynamic: (a, b) =>
      `Trígono (120°) entre ${a} e ${b}: mesmo elemento em harmonia. Fluidez — compreensão quase automática do “clima” interno do outro.`,
    chemistry: (a, b) =>
      `Química natural e acolhedora. O corpo e o humor se reconhecem; há prazer em simplesmente estar juntos.`,
    communication: (a, b) =>
      `Pouca necessidade de traduzir emoções básicas. O risco é achar que já concordam demais e não falar as nuances.`,
    affection: (a, b) =>
      `Morar junto costuma ser confortável no registro do elemento. A casa tende a sentir-se “do mesmo time”.`,
    challenge: (a, b) =>
      `Excesso de facilidade pode adiar confrontos necessários e estagnar o desenvolvimento do casal.`,
    tips: () => [
      'Não confundam harmonia com profundidade — perguntem o que ainda não foi dito.',
      'Introduzam desafios externos (viagem, estudo, projeto) para não acomodar.',
      'Celebrem a fluidez sem usá-la como desculpa para evitar honestidade difícil.',
    ],
  },
  quincunx: {
    dynamic: (a, b) =>
      `Quincúncio (150°) entre ${a} e ${b}: ângulo de ajuste permanente. Não há rivalidade óbvia nem fusão — há estranhamento que pede recalibragem contínua.`,
    chemistry: (a, b) =>
      `Fascínio pelo que não se entende. A atração pode nascer exatamente do que não encaixa no mapa mental do outro.`,
    communication: (a, b) =>
      `Mal-entendidos frequentes sem má intenção. ${a} e ${b} precisam perguntar: “o que você quis dizer com isso?”`,
    affection: (a, b) =>
      `Rotinas de cuidado precisam ser ensinadas em voz alta. O amor não “adivinha” nesse ângulo.`,
    challenge: (a, b) =>
      `Sensação crônica de “quase” — proximidade sem encaixe natural de hábitos, saúde, timing ou prioridades.`,
    tips: () => [
      'Façam listas literais de necessidades (sono, comida, silêncio, toque).',
      'Aceitem que o outro não é versão falha de vocês — é outro sistema.',
      'Revisitem acordos a cada mudança de fase; esse ângulo odeia pressupostos antigos.',
    ],
  },
  opposition: {
    dynamic: (a, b) =>
      `Oposição (180°) no eixo ${ZODIAC_DATA[a].axis}: ${a} e ${b} são polos que se atraem e se completam. Magnetismo de espelho — o outro carrega o que falta.`,
    chemistry: (a, b) =>
      `Química polar clássica: fascínio, projeção e desejo de integração. “Você é tudo que eu não sou” — até cansar ou amadurecer.`,
    communication: (a, b) =>
      `Diálogo rico quando há respeito à diferença; polarização quando cada um se agarra ao seu extremo do eixo.`,
    affection: (a, b) =>
      `Morar junto pode ser complementar e justo se dividirem papéis do eixo. Se não, vira cabo de guerra doméstico.`,
    challenge: (a, b) =>
      `Projeção: jogar no outro a metade que você rejeita em si. Oscilação entre idealizar e criticar.`,
    tips: (a, b) => [
      `Estudem o eixo ${ZODIAC_DATA[a].axis} juntos — o tema é compartilhado, não disputado.`,
      'Pratiquem “ambos/e” em vez de “ou/ou” nas decisões importantes.',
      `Quando irritar o polo de ${b}, perguntem: que qualidade de ${b} estou recusando em mim?`,
    ],
  },
};

function signIndex(name) {
  return SIGN_ORDER.indexOf(name);
}

/** Distância mínima em passos de signo (0–6). */
export function getSignStepDistance(a, b) {
  const i = signIndex(a);
  const j = signIndex(b);
  if (i < 0 || j < 0) return null;
  const raw = Math.abs(i - j);
  return Math.min(raw, 12 - raw);
}

export function getAspect(a, b) {
  const steps = getSignStepDistance(a, b);
  if (steps == null) return null;
  return { steps, ...ASPECTS[steps] };
}

export function affinityBucket(a, b) {
  const aspect = getAspect(a, b);
  if (!aspect) return null;
  if (aspect.id === 'trine' || aspect.id === 'sextile') return 'fluidez';
  if (aspect.id === 'opposition') return 'magnetismo';
  if (aspect.id === 'square' || aspect.id === 'quincunx') return 'atrito';
  if (aspect.id === 'conjunction') return 'fusão';
  return 'ajuste';
}

export function affinityMatrixFor(sign) {
  const buckets = {
    fluidez: [],
    magnetismo: [],
    atrito: [],
    fusão: [],
    ajuste: [],
  };
  for (const other of SIGN_ORDER) {
    const bucket = affinityBucket(sign, other);
    const aspect = getAspect(sign, other);
    buckets[bucket].push({ sign: other, aspect });
  }
  return buckets;
}

function scoreFromAspect(steps) {
  // Heurística transparente (não é oráculo absoluto)
  const map = { 0: 78, 1: 52, 2: 74, 3: 58, 4: 86, 5: 48, 6: 70 };
  return map[steps] ?? 60;
}

function elementBoost(elA, elB) {
  if (elA === elB) return 8;
  const feed = {
    Fogo: 'Ar',
    Ar: 'Fogo',
    Terra: 'Água',
    Água: 'Terra',
  };
  if (feed[elA] === elB) return 10;
  if ((elA === 'Fogo' && elB === 'Água') || (elA === 'Água' && elB === 'Fogo')) return -4;
  if ((elA === 'Terra' && elB === 'Ar') || (elA === 'Ar' && elB === 'Terra')) return -2;
  return 2;
}

export function analyzePair(signA, signB) {
  const a = ZODIAC_DATA[signA];
  const b = ZODIAC_DATA[signB];
  if (!a || !b) return null;

  const aspect = getAspect(signA, signB);
  const el = ELEMENT_MATRIX[a.element][b.element];
  const mod = MODALITY_MATRIX[a.modality][b.modality];
  const copy = ASPECT_COPY[aspect.id];

  const base = scoreFromAspect(aspect.steps);
  const affinity = Math.max(
    28,
    Math.min(96, base + elementBoost(a.element, b.element) + (a.modality === b.modality ? 3 : 0))
  );

  const chemistryScore = Math.max(
    25,
    Math.min(
      98,
      affinity +
        (aspect.id === 'opposition' || aspect.id === 'square' ? 6 : 0) +
        (aspect.id === 'trine' ? 4 : 0) -
        (aspect.id === 'quincunx' ? 6 : 0)
    )
  );
  const communicationScore = Math.max(
    25,
    Math.min(
      98,
      affinity +
        (a.element === 'Ar' || b.element === 'Ar' ? 8 : 0) +
        (aspect.id === 'sextile' || aspect.id === 'trine' ? 6 : 0) -
        (aspect.id === 'square' ? 8 : 0)
    )
  );
  const affectionScore = Math.max(
    25,
    Math.min(
      98,
      affinity +
        (a.element === 'Água' || b.element === 'Água' || a.element === 'Terra' || b.element === 'Terra' ? 5 : 0) +
        (aspect.id === 'conjunction' || aspect.id === 'trine' ? 5 : 0) -
        (aspect.id === 'semisextile' ? 4 : 0)
    )
  );

  return {
    signA,
    signB,
    aspect,
    affinity,
    scores: {
      chemistry: chemistryScore,
      communication: communicationScore,
      affection: affectionScore,
    },
    element: {
      a: a.element,
      b: b.element,
      ...el,
    },
    modality: {
      a: a.modality,
      b: b.modality,
      ...mod,
    },
    rulers: {
      a: { classical: a.rulers.classical.name, modern: a.rulers.modern.name },
      b: { classical: b.rulers.classical.name, modern: b.rulers.modern.name },
    },
    dimensions: {
      dynamic: copy.dynamic(signA, signB),
      chemistry: copy.chemistry(signA, signB),
      communication: copy.communication(signA, signB),
      affection: copy.affection(signA, signB),
      challenge: copy.challenge(signA, signB),
      tips: copy.tips(signA, signB),
    },
    precisionNote:
      'Análise pela distância no círculo do zodíaco (passos de 30°) entre os signos escolhidos, mais elemento e ritmo. Não inclui Ascendente, Lua nem planetas de um mapa natal completo — isso pediria data, hora e local certos.',
  };
}

export { ASPECTS };
