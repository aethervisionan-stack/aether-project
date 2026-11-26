import type {
  DifficultyBand,
  TextDistractorError,
  TextQuestion,
} from "@/src/types/quiz";

type PartialText = Omit<
  TextQuestion,
  "kind" | "options" | "correctIndex" | "distractorErrors"
> & {
  correct: string;
  distractors: { text: string; error: TextDistractorError }[];
  /** Deterministic shuffle seed */
  seed: number;
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function packTextOptions(
  correct: string,
  distractors: { text: string; error: TextDistractorError }[],
  seed: number,
): {
  options: string[];
  correctIndex: number;
  distractorErrors: (TextDistractorError | null)[];
} {
  const pool = [
    { text: correct, error: null as TextDistractorError | null },
    ...distractors.map((d) => ({ text: d.text, error: d.error })),
  ];
  const rand = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const options = pool.map((p) => p.text);
  const distractorErrors = pool.map((p) => p.error);
  const correctIndex = pool.findIndex((p) => p.error === null);
  return { options, correctIndex, distractorErrors };
}

function optionCount(band: DifficultyBand): number {
  return band >= 3 ? 6 : 4;
}

function pushT(qs: TextQuestion[], partial: PartialText) {
  const need = optionCount(partial.difficulty) - 1;
  const distractors = partial.distractors.slice(0, need);
  while (distractors.length < need) {
    distractors.push({
      text: `Alternativa inválida ${distractors.length + 1}`,
      error: "near_miss",
    });
  }
  const packed = packTextOptions(partial.correct, distractors, partial.seed);
  qs.push({
    kind: "text",
    id: partial.id,
    difficulty: partial.difficulty,
    weight: partial.weight,
    irtB: partial.irtB,
    skills: partial.skills,
    stem: partial.stem,
    premises: partial.premises,
    explanation: partial.explanation,
    ...packed,
  });
}

function buildTextQuestions(): TextQuestion[] {
  const qs: TextQuestion[] = [];

  /* ═══════════════ BAND 1 ═══════════════ */

  pushT(qs, {
    id: 1,
    difficulty: 1,
    weight: 1,
    irtB: -1.6,
    skills: ["logical"],
    stem: "Se todos os A são B, e alguns B são C, qual conclusão é necessariamente verdadeira?",
    premises: ["Todos os A são B.", "Alguns B são C."],
    correct: "Nenhuma das conclusões ‘todos A são C’ ou ‘alguns A são C’ é necessária.",
    distractors: [
      { text: "Todos os A são C.", error: "scope_error" },
      { text: "Alguns A são C.", error: "incomplete_chain" },
      { text: "Nenhum A é C.", error: "quantifier_error" },
    ],
    seed: 101,
    explanation: {
      pt: "De ‘todos A→B’ e ‘alguns B→C’ não se segue nada sobre A e C: os B que são C podem estar fora do conjunto A.",
      rules: ["silogismo", "quantificadores", "não transitividade parcial"],
    },
  });

  pushT(qs, {
    id: 2,
    difficulty: 1,
    weight: 1,
    irtB: -1.4,
    skills: ["numeric"],
    stem: "Qual é o próximo número da sequência: 2, 6, 12, 20, 30, ?",
    correct: "42",
    distractors: [
      { text: "40", error: "near_miss" },
      { text: "36", error: "wrong_operation" },
      { text: "44", error: "arithmetic_slip" },
    ],
    seed: 102,
    explanation: {
      pt: "Diferenças: +4, +6, +8, +10 → próxima +12 → 30+12=42. Equivale a n(n+1).",
      rules: ["diferenças crescentes", "n(n+1)"],
    },
  });

  pushT(qs, {
    id: 3,
    difficulty: 1,
    weight: 1,
    irtB: -1.3,
    skills: ["verbal"],
    stem: "Livro está para biblioteca assim como quadro está para:",
    correct: "galeria",
    distractors: [
      { text: "pintor", error: "semantic_swap" },
      { text: "moldura", error: "false_analogy" },
      { text: "tinta", error: "false_analogy" },
    ],
    seed: 103,
    explanation: {
      pt: "Relação de objeto→lugar de exposição/coleção: livro∶biblioteca :: quadro∶galeria.",
      rules: ["analogia", "objeto–contenedor cultural"],
    },
  });

  pushT(qs, {
    id: 4,
    difficulty: 1,
    weight: 1.1,
    irtB: -1.1,
    skills: ["analytical"],
    stem: "Três caixas: uma só com maçãs, uma só com peras, uma mista. Os rótulos estão todos errados. A caixa rotulada ‘Maçãs e Peras’ contém só maçãs. O que há na caixa rotulada ‘Maçãs’?",
    correct: "Só peras",
    distractors: [
      { text: "Só maçãs", error: "premise_ignore" },
      { text: "Maçãs e peras", error: "incomplete_chain" },
      { text: "Não se pode determinar", error: "scope_error" },
    ],
    seed: 104,
    explanation: {
      pt: "Todos os rótulos mentem. ‘Maçãs e Peras’ tem só maçãs. Sobram só peras e a mista: ‘Maçãs’ não pode ter maçãs → só peras; ‘Peras’ fica mista.",
      rules: ["rótulos falsos", "eliminação"],
    },
  });

  pushT(qs, {
    id: 5,
    difficulty: 1,
    weight: 1,
    irtB: -1.2,
    skills: ["logical"],
    stem: "Se P→Q é verdadeiro e Q é falso, o que se pode afirmar sobre P?",
    correct: "P é falso",
    distractors: [
      { text: "P é verdadeiro", error: "wrong_operation" },
      { text: "P pode ser verdadeiro ou falso", error: "scope_error" },
      { text: "Q torna P indeterminado", error: "premise_ignore" },
    ],
    seed: 105,
    explanation: {
      pt: "Modus tollens: de P→Q e ¬Q segue ¬P.",
      rules: ["modus tollens", "implicação"],
    },
  });

  pushT(qs, {
    id: 6,
    difficulty: 1,
    weight: 1,
    irtB: -1.0,
    skills: ["numeric"],
    stem: "Em uma progressão aritmética, a₃=11 e a₇=23. Qual é a₁₅?",
    correct: "47",
    distractors: [
      { text: "41", error: "near_miss" },
      { text: "45", error: "arithmetic_slip" },
      { text: "49", error: "wrong_operation" },
    ],
    seed: 106,
    explanation: {
      pt: "a₇−a₃=4r=12 → r=3. a₁₅=a₇+8r=23+24=47.",
      rules: ["PA", "razão constante"],
    },
  });

  /* ═══════════════ BAND 2 ═══════════════ */

  pushT(qs, {
    id: 7,
    difficulty: 2,
    weight: 1.2,
    irtB: -0.6,
    skills: ["logical"],
    stem: "Premissas: (1) Se chove, a rua fica molhada. (2) A rua está molhada. Conclusão válida?",
    correct: "Nenhuma: a rua molhada não implica que choveu (afirmação do consequente).",
    distractors: [
      { text: "Choveu necessariamente.", error: "wrong_operation" },
      { text: "Não choveu.", error: "quantifier_error" },
      { text: "Se não chove, a rua não molha.", error: "false_analogy" },
    ],
    seed: 201,
    explanation: {
      pt: "Afirmar o consequente é falácia: Q não implica P quando só se tem P→Q.",
      rules: ["falácia", "afirmação do consequente"],
    },
  });

  pushT(qs, {
    id: 8,
    difficulty: 2,
    weight: 1.2,
    irtB: -0.5,
    skills: ["numeric"],
    stem: "Sequência: 3, 4, 6, 10, 18, ?. Qual o próximo?",
    correct: "34",
    distractors: [
      { text: "32", error: "near_miss" },
      { text: "30", error: "wrong_operation" },
      { text: "36", error: "arithmetic_slip" },
    ],
    seed: 202,
    explanation: {
      pt: "Cada termo ≈ 2×anterior −2: 2·3−2=4, 2·4−2=6, 2·6−2=10, 2·10−2=18, 2·18−2=34.",
      rules: ["recorrência", "2aₙ−2"],
    },
  });

  pushT(qs, {
    id: 9,
    difficulty: 2,
    weight: 1.2,
    irtB: -0.4,
    skills: ["verbal"],
    stem: "Escolha o par que melhor completa a relação: efêmero∶duradouro :: escasso∶?",
    correct: "abundante",
    distractors: [
      { text: "raro", error: "semantic_swap" },
      { text: "breve", error: "false_analogy" },
      { text: "preciso", error: "semantic_swap" },
    ],
    seed: 203,
    explanation: {
      pt: "Antônimos: efêmero↔duradouro; escasso↔abundante.",
      rules: ["antonímia", "analogia semântica"],
    },
  });

  pushT(qs, {
    id: 10,
    difficulty: 2,
    weight: 1.3,
    irtB: -0.3,
    skills: ["analytical"],
    stem: "Cinco pessoas A–E em fila. A não está nas pontas. B está imediatamente à esquerda de C. D está entre A e E. E está na ponta direita. Qual a ordem da esquerda para a direita?",
    correct: "B C A D E",
    distractors: [
      { text: "B A C D E", error: "order_error" },
      { text: "A B C D E", error: "premise_ignore" },
      { text: "B C D A E", error: "incomplete_chain" },
    ],
    seed: 204,
    explanation: {
      pt: "E na ponta direita → _ _ _ _ E. D entre A e E → …A D E. A não nas pontas → posição 3: _ _ A D E. BC bloco à esquerda → B C A D E.",
      rules: ["ordenação", "restrições"],
    },
  });

  pushT(qs, {
    id: 11,
    difficulty: 2,
    weight: 1.2,
    irtB: -0.2,
    skills: ["logical"],
    stem: "‘Nenhum M é N’ é logicamente equivalente a:",
    correct: "Nenhum N é M",
    distractors: [
      { text: "Todos os M são N", error: "quantifier_error" },
      { text: "Alguns M não são N", error: "scope_error" },
      { text: "Todos os N são M", error: "wrong_operation" },
    ],
    seed: 205,
    explanation: {
      pt: "A conversão de E (‘nenhum’) é válida: Nenhum M é N ≡ Nenhum N é M.",
      rules: ["conversão E", "quantificadores"],
    },
  });

  pushT(qs, {
    id: 12,
    difficulty: 2,
    weight: 1.3,
    irtB: -0.1,
    skills: ["numeric"],
    stem: "2, 3, 3, 5, 10, 13, 39, 43, ?. Próximo termo?",
    correct: "172",
    distractors: [
      { text: "129", error: "wrong_operation" },
      { text: "86", error: "near_miss" },
      { text: "215", error: "arithmetic_slip" },
    ],
    seed: 206,
    explanation: {
      pt: "Padrão alternado +1, ×1; +2, ×2; +3, ×3; +4, ×4…: 2+1=3, 3×1=3, 3+2=5, 5×2=10, 10+3=13, 13×3=39, 39+4=43, 43×4=172.",
      rules: ["padrão alternado", "incremento"],
    },
  });

  /* ═══════════════ BAND 3 ═══════════════ */

  pushT(qs, {
    id: 13,
    difficulty: 3,
    weight: 1.5,
    irtB: 0.3,
    skills: ["logical"],
    stem: "Em um mundo possível: todo jurista é lógico; alguns lógicos não são matemáticos; nenhum poeta é jurista. Qual afirmação é necessariamente verdadeira?",
    premises: [
      "Todo jurista é lógico.",
      "Alguns lógicos não são matemáticos.",
      "Nenhum poeta é jurista.",
    ],
    correct: "Nenhum poeta precisa ser lógico; a interseção poeta–lógico fica indeterminada.",
    distractors: [
      {
        text: "Nenhum poeta é lógico.",
        error: "incomplete_chain",
      },
      {
        text: "Alguns poetas não são matemáticos.",
        error: "scope_error",
      },
      {
        text: "Todo lógico é jurista.",
        error: "quantifier_error",
      },
      {
        text: "Nenhum matemático é jurista.",
        error: "premise_ignore",
      },
      {
        text: "Alguns juristas não são matemáticos.",
        error: "incomplete_chain",
      },
    ],
    seed: 301,
    explanation: {
      pt: "Poetas estão fora de juristas, mas podem ou não ser lógicos (juristas ⊂ lógicos). As demais opções extrapolam além das premissas.",
      rules: ["diagramas de Venn", "necessidade vs possibilidade"],
    },
  });

  pushT(qs, {
    id: 14,
    difficulty: 3,
    weight: 1.5,
    irtB: 0.4,
    skills: ["numeric"],
    stem: "Sequência: 7, 10, 16, 28, 52, ?. Qual o próximo?",
    correct: "100",
    distractors: [
      { text: "94", error: "near_miss" },
      { text: "88", error: "wrong_operation" },
      { text: "104", error: "arithmetic_slip" },
      { text: "76", error: "wrong_operation" },
      { text: "98", error: "near_miss" },
    ],
    seed: 302,
    explanation: {
      pt: "aₙ₊₁ = 2·aₙ − 4: 2·7−4=10, 2·10−4=16, 2·16−4=28, 2·28−4=52, 2·52−4=100.",
      rules: ["recorrência linear", "2a−4"],
    },
  });

  pushT(qs, {
    id: 15,
    difficulty: 3,
    weight: 1.5,
    irtB: 0.5,
    skills: ["verbal"],
    stem: "Qual palavra NÃO pertence ao mesmo eixo semântico preciso das demais?",
    correct: "eloquente",
    distractors: [
      { text: "lacônico", error: "semantic_swap" },
      { text: "conciso", error: "near_miss" },
      { text: "sucinto", error: "near_miss" },
      { text: "breviloquente", error: "near_miss" },
      { text: "telegráfico", error: "false_analogy" },
    ],
    seed: 303,
    explanation: {
      pt: "Lacônico/conciso/sucinto/breviloquente/telegráfico apontam economia verbal; eloquente aponta expressividade abundante — antônimo relativo.",
      rules: ["campo semântico", "intruso"],
    },
  });

  pushT(qs, {
    id: 16,
    difficulty: 3,
    weight: 1.6,
    irtB: 0.55,
    skills: ["analytical"],
    stem: "Um relógio atrasa 2 minutos por hora verdadeira. Foi acertado às 12:00 verdadeiras. Que horas verdadeiras serão quando esse relógio marcar 15:00?",
    correct: "≈15:06",
    distractors: [
      { text: "15:04", error: "arithmetic_slip" },
      { text: "14:54", error: "wrong_operation" },
      { text: "15:10", error: "wrong_operation" },
      { text: "15:00 (mesmo instante)", error: "premise_ignore" },
      { text: "15:12", error: "near_miss" },
    ],
    seed: 304,
    explanation: {
      pt: "Em 58 min de relógio passam 60 min reais. Para avançar 180 min no relógio: t_real = 180 × (60/58) = 5400/29 ≈ 186,21 min ≈ 3h 6,21 min → ≈15:06.",
      rules: ["relógio atrasado", "proporção 58∶60"],
    },
  });

  pushT(qs, {
    id: 17,
    difficulty: 3,
    weight: 1.5,
    irtB: 0.6,
    skills: ["logical"],
    stem: "Considere: ‘Somente se houver quórum a reunião começa.’ A reunião começou. O que se segue?",
    correct: "Havia quórum",
    distractors: [
      { text: "Pode não haver quórum", error: "quantifier_error" },
      { text: "Haver quórum é insuficiente", error: "scope_error" },
      { text: "Nada se segue", error: "premise_ignore" },
      { text: "A reunião não podia começar", error: "wrong_operation" },
      { text: "Quórum implica início, mas não o contrário", error: "order_error" },
    ],
    seed: 305,
    explanation: {
      pt: "‘Somente se Q, P’ ≡ P→Q. Com P (começou) segue Q (quórum) por modus ponens sobre P→Q.",
      rules: ["somente se", "P→Q", "modus ponens"],
    },
  });

  pushT(qs, {
    id: 18,
    difficulty: 3,
    weight: 1.6,
    irtB: 0.65,
    skills: ["numeric"],
    stem: "1, 2, 6, 42, 1806, ?. Qual o próximo?",
    correct: "3263442",
    distractors: [
      { text: "3263440", error: "near_miss" },
      { text: "3250878", error: "arithmetic_slip" },
      { text: "1806²", error: "wrong_operation" },
      { text: "2173442", error: "arithmetic_slip" },
      { text: "3623442", error: "near_miss" },
    ],
    seed: 306,
    explanation: {
      pt: "Padrão aₙ₊₁ = aₙ(aₙ+1): 1·2=2, 2·3=6, 6·7=42, 42·43=1806, 1806·1807=3263442.",
      rules: ["a(a+1)", "crescimento super-exponencial"],
    },
  });

  /* ═══════════════ BAND 4 ═══════════════ */

  pushT(qs, {
    id: 19,
    difficulty: 4,
    weight: 1.8,
    irtB: 1.2,
    skills: ["logical"],
    stem: "Três proposições: (A) Exatamente uma destas três é falsa. (B) Exatamente duas destas três são falsas. (C) Todas as três são falsas. Qual é verdadeira?",
    correct: "Somente B é verdadeira",
    distractors: [
      { text: "Somente A é verdadeira", error: "incomplete_chain" },
      { text: "Somente C é verdadeira", error: "quantifier_error" },
      { text: "A e B verdadeiras", error: "scope_error" },
      { text: "Nenhuma pode ser verdadeira", error: "premise_ignore" },
      { text: "C e A verdadeiras", error: "wrong_operation" },
    ],
    seed: 401,
    explanation: {
      pt: "C não pode ser V (auto-refutação). Se A fosse V, haveria exatamente 1 falsa → B e C falsas (2 falsas), contradiz A. Se B é V: exatamente 2 falsas → A e C falsas — consistente.",
      rules: ["autorreferência", "exclusão de casos"],
    },
  });

  pushT(qs, {
    id: 20,
    difficulty: 4,
    weight: 1.8,
    irtB: 1.3,
    skills: ["numeric"],
    stem: "Em base 7, o número 345₆ (escrito em base 6) equivale a qual valor em base 7?",
    correct: "254₇",
    distractors: [
      { text: "345₇", error: "premise_ignore" },
      { text: "240₇", error: "near_miss" },
      { text: "305₇", error: "arithmetic_slip" },
      { text: "125₇", error: "wrong_operation" },
      { text: "260₇", error: "arithmetic_slip" },
    ],
    seed: 402,
    explanation: {
      pt: "345₆ = 3·36+4·6+5=137₁₀. Em base 7: 2·49+5·7+4 → 254₇.",
      rules: ["conversão de bases", "polinômio posicional"],
    },
  });

  pushT(qs, {
    id: 21,
    difficulty: 4,
    weight: 1.8,
    irtB: 1.35,
    skills: ["verbal"],
    stem: "Complete com a relação mais rigorosa: jurisprudência∶lei :: exegese∶?",
    correct: "texto",
    distractors: [
      { text: "juiz", error: "semantic_swap" },
      { text: "doutrina", error: "false_analogy" },
      { text: "hermenêutica", error: "near_miss" },
      { text: "norma", error: "semantic_swap" },
      { text: "código", error: "false_analogy" },
    ],
    seed: 403,
    explanation: {
      pt: "Jurisprudência interpreta/aplica a lei; exegese interpreta o texto. Objeto da prática interpretativa.",
      rules: ["analogia precisa", "objeto da interpretação"],
    },
  });

  pushT(qs, {
    id: 22,
    difficulty: 4,
    weight: 1.9,
    irtB: 1.4,
    skills: ["analytical"],
    stem: "100 prisioneiros, chapéus vermelhos ou azuis aleatórios. Veem os da frente. Podem dizer só ‘vermelho’ ou ‘azul’. Estratégia ótima garante salvar quantos no pior caso?",
    correct: "99",
    distractors: [
      { text: "50", error: "wrong_operation" },
      { text: "100", error: "near_miss" },
      { text: "98", error: "arithmetic_slip" },
      { text: "1", error: "scope_error" },
      { text: "75", error: "false_analogy" },
    ],
    seed: 404,
    explanation: {
      pt: "O do fundo anuncia a paridade (XOR) dos chapéus que vê; arrisca 50%. Os demais usam a informação acumulada e salvam-se com certeza → 99 garantidos.",
      rules: ["codificação de paridade", "informação"],
    },
  });

  pushT(qs, {
    id: 23,
    difficulty: 4,
    weight: 1.8,
    irtB: 1.45,
    skills: ["logical"],
    stem: "Se ∀x (P(x) → Q(x)) e ∃x ¬Q(x), qual conclusão é válida?",
    correct: "∃x ¬P(x)",
    distractors: [
      { text: "∀x ¬P(x)", error: "quantifier_error" },
      { text: "∃x P(x)", error: "wrong_operation" },
      { text: "∀x Q(x)", error: "premise_ignore" },
      { text: "∃x (P(x) ∧ ¬Q(x))", error: "scope_error" },
      { text: "¬∃x P(x)", error: "quantifier_error" },
    ],
    seed: 405,
    explanation: {
      pt: "Há um a com ¬Q(a). Por contrapositiva de P→Q, ¬P(a). Logo ∃x ¬P(x). Não se segue universalidade nem existência de P.",
      rules: ["quantificadores", "contrapositiva"],
    },
  });

  pushT(qs, {
    id: 24,
    difficulty: 4,
    weight: 1.9,
    irtB: 1.5,
    skills: ["numeric"],
    stem: "Quantos zeros à direita tem 100! em base 10?",
    correct: "24",
    distractors: [
      { text: "20", error: "near_miss" },
      { text: "22", error: "arithmetic_slip" },
      { text: "25", error: "near_miss" },
      { text: "30", error: "wrong_operation" },
      { text: "18", error: "incomplete_chain" },
    ],
    seed: 406,
    explanation: {
      pt: "Zeros = min(fatores 2,5) = ⌊100/5⌋+⌊20/5⌋+⌊4/5⌋=20+4+0=24.",
      rules: ["fatores 5", "de Polignac"],
    },
  });

  /* ═══════════════ BAND 5 ═══════════════ */

  pushT(qs, {
    id: 25,
    difficulty: 5,
    weight: 2.2,
    irtB: 2.0,
    skills: ["logical"],
    stem: "Em lógica proposicional, qual fórmula é uma tautologia?",
    correct: "((P→Q)∧(Q→R))→(P→R)",
    distractors: [
      { text: "(P∨Q)→(P∧Q)", error: "wrong_operation" },
      { text: "¬(P→Q)↔(¬P→¬Q)", error: "false_analogy" },
      { text: "(P→Q)↔(Q→P)", error: "order_error" },
      { text: "(P∧¬P)∨(Q∧¬Q)", error: "quantifier_error" },
      { text: "P ↔ ¬P", error: "near_miss" },
    ],
    seed: 501,
    explanation: {
      pt: "Transitividade da implicação é tautologia. (P∨Q)→(P∧Q) falha; conversão de → falha; ¬(P→Q)≡P∧¬Q ≠ ¬P→¬Q; (P∧¬P)∨(Q∧¬Q) e P↔¬P são sempre falsas.",
      rules: ["tautologia", "transitividade"],
    },
  });

  pushT(qs, {
    id: 26,
    difficulty: 5,
    weight: 2.2,
    irtB: 2.1,
    skills: ["numeric"],
    stem: "Último dígito de 7^7^7 (torre de três 7’s, associação à direita)?",
    correct: "3",
    distractors: [
      { text: "7", error: "near_miss" },
      { text: "9", error: "wrong_operation" },
      { text: "1", error: "arithmetic_slip" },
      { text: "5", error: "false_analogy" },
      { text: "2", error: "incomplete_chain" },
    ],
    seed: 502,
    explanation: {
      pt: "Ciclo de 7^n em base 10: 7,9,3,1 (período 4). Expoente 7^7 ≡ 3 (mod 4) pois 7≡−1 e ímpar → 7^k ≡3 (mod 4) para k≥1. Logo último dígito = 3.",
      rules: ["ciclo modular", "torre de expoentes"],
    },
  });

  pushT(qs, {
    id: 27,
    difficulty: 5,
    weight: 2.1,
    irtB: 2.15,
    skills: ["verbal"],
    stem: "‘Perspícuo’ está para ‘obscuro’ assim como ‘prolixo’ está para:",
    correct: "lacônico",
    distractors: [
      { text: "verboso", error: "semantic_swap" },
      { text: "perspicaz", error: "false_analogy" },
      { text: "opaco", error: "near_miss" },
      { text: "difuso", error: "semantic_swap" },
      { text: "elíptico", error: "near_miss" },
    ],
    seed: 503,
    explanation: {
      pt: "Antonímia: perspícuo↔obscuro; prolixo↔lacônico (extensão discursiva).",
      rules: ["antonímia rigorosa"],
    },
  });

  pushT(qs, {
    id: 28,
    difficulty: 5,
    weight: 2.3,
    irtB: 2.2,
    skills: ["analytical"],
    stem: "Em um torneio eliminatório simples com 100 jogadores, quantas partidas são necessárias para determinar o campeão (sem byes desnecessários além do mínimo)?",
    correct: "99",
    distractors: [
      { text: "100", error: "near_miss" },
      { text: "50", error: "wrong_operation" },
      { text: "98", error: "arithmetic_slip" },
      { text: "7", error: "false_analogy" },
      { text: "64", error: "scope_error" },
    ],
    seed: 504,
    explanation: {
      pt: "Cada partida elimina 1 jogador; precisa eliminar 99 → 99 partidas.",
      rules: ["invariante de eliminação"],
    },
  });

  pushT(qs, {
    id: 29,
    difficulty: 5,
    weight: 2.3,
    irtB: 2.3,
    skills: ["logical"],
    stem: "Qual é a relação correta entre ∀x∃y P(x,y) e ∃y∀x P(x,y)?",
    correct:
      "∃y∀x P implica ∀x∃y P, mas o contrário não vale em geral",
    distractors: [
      {
        text: "As duas fórmulas são logicamente equivalentes",
        error: "quantifier_error",
      },
      {
        text: "∀x∃y P implica ∃y∀x P, mas o contrário não vale",
        error: "order_error",
      },
      {
        text: "Nenhuma implica a outra",
        error: "incomplete_chain",
      },
      {
        text: "São contraditórias: no máximo uma pode ser verdadeira",
        error: "scope_error",
      },
      {
        text: "∀x∃y P é sempre falsa se o domínio for infinito",
        error: "premise_ignore",
      },
    ],
    seed: 505,
    explanation: {
      pt: "Se existe um único y que serve para todo x (∃y∀x), então para cada x existe algum y (∀x∃y). O inverso falha: y pode depender de x.",
      rules: ["ordem de quantificadores", "dependência funcional"],
    },
  });

  pushT(qs, {
    id: 30,
    difficulty: 5,
    weight: 2.4,
    irtB: 2.4,
    skills: ["numeric", "analytical"],
    stem: "Soma 1/(1·2) + 1/(2·3) + … + 1/(n·(n+1)) = ?",
    correct: "n/(n+1)",
    distractors: [
      { text: "1/n", error: "near_miss" },
      { text: "(n+1)/n", error: "wrong_operation" },
      { text: "n(n+1)/2", error: "false_analogy" },
      { text: "1 − 1/n", error: "arithmetic_slip" },
      { text: "2/(n+1)", error: "incomplete_chain" },
    ],
    seed: 506,
    explanation: {
      pt: "Frações parciais: 1/(k(k+1))=1/k−1/(k+1). Soma telescópica = 1 − 1/(n+1) = n/(n+1).",
      rules: ["telescópica", "frações parciais"],
    },
  });

  return qs;
}

let _cache: TextQuestion[] | null = null;

export function getTextQuestions(): TextQuestion[] {
  if (!_cache) _cache = buildTextQuestions();
  return _cache;
}

export function getTextTutorialExample(): {
  stem: string;
  premises: string[];
  options: string[];
  correctIndex: number;
  explanation: string;
} {
  const correct = "42";
  const packed = packTextOptions(
    correct,
    [
      { text: "40", error: "near_miss" },
      { text: "36", error: "wrong_operation" },
      { text: "44", error: "arithmetic_slip" },
    ],
    9001,
  );
  return {
    stem: "Exemplo: 2, 6, 12, 20, 30, ?",
    premises: ["Diferenças sucessivas aumentam de 2 em 2."],
    options: packed.options,
    correctIndex: packed.correctIndex,
    explanation:
      "Diferenças +4,+6,+8,+10 → próxima +12 → 42. Sem cronômetro.",
  };
}

export function validateTextQuestionBank(
  qs = getTextQuestions(),
): string[] {
  const errors: string[] = [];
  if (qs.length !== 30) errors.push(`Expected 30 text items, got ${qs.length}`);
  const ids = new Set<number>();
  for (const q of qs) {
    if (ids.has(q.id)) errors.push(`Duplicate id ${q.id}`);
    ids.add(q.id);
    const expect = q.difficulty >= 3 ? 6 : 4;
    if (q.options.length !== expect) {
      errors.push(`T${q.id}: expected ${expect} options, got ${q.options.length}`);
    }
    if (
      q.correctIndex < 0 ||
      q.correctIndex >= q.options.length ||
      q.distractorErrors[q.correctIndex] !== null
    ) {
      errors.push(`T${q.id}: invalid correctIndex/distractor mapping`);
    }
    if (new Set(q.options).size !== q.options.length) {
      errors.push(`T${q.id}: duplicate option text`);
    }
    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex) continue;
      if (!q.distractorErrors[i]) {
        errors.push(`T${q.id}: option ${i} missing distractor error`);
      }
    }
  }
  return errors;
}
