/**
 * Banco objetivo CHC — 30 itens (6 índices × 5 bandas), conteúdo original PT-BR.
 */
import type {
  CognitiveIndexId,
  DifficultyBand,
  QuestionSkill,
  SubtestId,
  TextDistractorError,
  TextQuestion,
} from "@/src/types/quiz";

type PartialText = {
  id: number;
  difficulty: DifficultyBand;
  weight: number;
  irtB: number;
  skills: QuestionSkill[];
  index: CognitiveIndexId;
  subtest: SubtestId;
  stem: string;
  premises?: string[];
  correct: string;
  distractors: { text: string; error: TextDistractorError }[];
  seed: number;
  explanation: { pt: string; rules: string[] };
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
  return {
    options: pool.map((p) => p.text),
    correctIndex: pool.findIndex((p) => p.error === null),
    distractorErrors: pool.map((p) => p.error),
  };
}

function optionCount(band: DifficultyBand): number {
  return band >= 3 ? 6 : 4;
}

function pushT(qs: TextQuestion[], partial: PartialText) {
  const need = optionCount(partial.difficulty) - 1;
  const distractors = partial.distractors.slice(0, need);
  while (distractors.length < need) {
    distractors.push({
      text: `Opção descartável ${distractors.length + 1}`,
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
    index: partial.index,
    subtest: partial.subtest,
    stem: partial.stem,
    premises: partial.premises,
    explanation: partial.explanation,
    ...packed,
  });
}

/** Pesos / irtB aproximados por banda */
const BAND_W: Record<DifficultyBand, { w: number; b: number }> = {
  1: { w: 1.05, b: -1.45 },
  2: { w: 1.45, b: -0.35 },
  3: { w: 1.95, b: 0.55 },
  4: { w: 2.55, b: 1.35 },
  5: { w: 3.2, b: 2.15 },
};

export function buildChcTextQuestions(): TextQuestion[] {
  const qs: TextQuestion[] = [];
  let id = 1;

  const add = (
    band: DifficultyBand,
    index: CognitiveIndexId,
    subtest: SubtestId,
    skills: QuestionSkill[],
    stem: string,
    correct: string,
    distractors: { text: string; error: TextDistractorError }[],
    explanation: { pt: string; rules: string[] },
    premises?: string[],
    bJitter = 0,
  ) => {
    const { w, b } = BAND_W[band];
    pushT(qs, {
      id: id++,
      difficulty: band,
      weight: w,
      irtB: Math.round((b + bJitter) * 100) / 100,
      skills,
      index,
      subtest,
      stem,
      premises,
      correct,
      distractors,
      seed: 7000 + id * 17,
      explanation,
    });
  };

  /* ── Banda 1 ───────────────────────────────────────────── */
  add(
    1,
    "verbal",
    "vocabulario",
    ["verbal"],
    "Qual palavra melhor substitui “efêmero” sem mudar o sentido?",
    "Passageiro / de curta duração",
    [
      { text: "Eterno e imutável", error: "semantic_swap" },
      { text: "Pesado e volumoso", error: "false_analogy" },
      { text: "Obrigatório por lei", error: "scope_error" },
    ],
    {
      pt: "Efêmero descreve algo que dura pouco. “Passageiro / de curta duração” preserva o sentido; as outras distorcem o campo semântico.",
      rules: ["sinônimo", "campo semântico"],
    },
  );
  add(
    1,
    "fluido",
    "sequencias_logicas",
    ["numeric"],
    "Complete: 3, 6, 12, 24, ?",
    "48",
    [
      { text: "36", error: "wrong_operation" },
      { text: "30", error: "near_miss" },
      { text: "42", error: "arithmetic_slip" },
    ],
    {
      pt: "Cada termo dobra o anterior (×2). 24×2 = 48.",
      rules: ["progressão geométrica", "dobro"],
    },
    undefined,
    -0.1,
  );
  add(
    1,
    "espacial",
    "completamento_espacial",
    ["analytical"],
    "Num quadrado 2×2, as células são A B / C ?. Se A espelha B na horizontal e C espelha A na vertical, o que ?. deve espelhar?",
    "Espelho vertical de B (ou horizontal de C)",
    [
      { text: "Cópia idêntica de A", error: "incomplete_chain" },
      { text: "Espelho só de C, ignorando B", error: "scope_error" },
      { text: "Rotação 90° de A", error: "wrong_operation" },
    ],
    {
      pt: "A grade fecha com a composição dos dois espelhos: vertical de B coincide com horizontal de C.",
      rules: ["espelho", "consistência 2×2"],
    },
  );
  add(
    1,
    "memoria_trabalho",
    "span_digitos",
    ["logical"],
    "Memorize mentalmente: 4–9–2. Some o primeiro ao terceiro e subtraia o do meio. Qual o resultado?",
    "−3",
    [
      { text: "11", error: "wrong_operation" },
      { text: "5", error: "order_error" },
      { text: "3", error: "arithmetic_slip" },
    ],
    {
      pt: "4+2=6; 6−9=−3. Erros comuns: somar os três (11) ou inverter a ordem das operações.",
      rules: ["span", "atualização aritmética"],
    },
    ["Sequência: 4, 9, 2."],
  );
  add(
    1,
    "velocidade_processamento",
    "busca_simbolos",
    ["analytical"],
    "Na linha [△ ○ □ △ ○ □ △], quantas vezes o símbolo △ aparece?",
    "3",
    [
      { text: "2", error: "near_miss" },
      { text: "4", error: "arithmetic_slip" },
      { text: "7", error: "scope_error" },
    ],
    {
      pt: "Posições 1, 4 e 7 são △ → três ocorrências. Contar todos os símbolos (7) ignora o alvo.",
      rules: ["busca visual", "contagem seletiva"],
    },
  );
  add(
    1,
    "tempo_reacao",
    "decisao_rapida",
    ["logical"],
    "Regra rápida: se o número for par, diga “P”; se ímpar, “I”. Para 14, a resposta correta é:",
    "P",
    [
      { text: "I", error: "wrong_operation" },
      { text: "PI", error: "scope_error" },
      { text: "Não se aplica", error: "premise_ignore" },
    ],
    {
      pt: "14 é divisível por 2 → par → “P”. Misturar rótulos ou negar a regra são distratores típicos de impulso.",
      rules: ["classificação", "latência útil"],
    },
  );

  /* ── Banda 2 ───────────────────────────────────────────── */
  add(
    2,
    "verbal",
    "analogias_verbais",
    ["verbal"],
    "Livro está para leitura assim como partitura está para:",
    "Execução musical / interpretação",
    [
      { text: "Biblioteca", error: "false_analogy" },
      { text: "Papel sulfite", error: "semantic_swap" },
      { text: "Silêncio absoluto", error: "scope_error" },
    ],
    {
      pt: "A relação é suporte → atividade típica. Partitura orienta a execução musical, como o livro orienta a leitura.",
      rules: ["analogia", "relação funcional"],
    },
  );
  add(
    2,
    "fluido",
    "inducao_regras",
    ["logical"],
    "Em uma fila, cada pessoa veste uma cor distinta. Ana não está ao lado de Bruno. Bruno está imediatamente à esquerda de Carla. Quem pode estar entre Ana e Carla?",
    "Ninguém necessariamente — Ana pode estar longe; só Bruno→Carla é fixo",
    [
      { text: "Bruno, obrigatoriamente", error: "scope_error" },
      { text: "Só quem veste vermelho", error: "premise_ignore" },
      { text: "Ana, entre Bruno e Carla", error: "order_error" },
    ],
    {
      pt: "A única ligação forte é Bruno imediatamente à esquerda de Carla. Ana ≠ adjacente a Bruno, mas isso não coloca ninguém entre Ana e Carla de forma necessária.",
      rules: ["restrições", "não-forçar"],
    },
    undefined,
    0.05,
  );
  add(
    2,
    "espacial",
    "rotacao_mental",
    ["analytical"],
    "Um “L” de três quadrados gira 90° no sentido horário. Para onde aponta o braço curto depois do giro, se antes apontava para cima?",
    "Para a direita",
    [
      { text: "Para a esquerda", error: "wrong_operation" },
      { text: "Continua para cima", error: "incomplete_chain" },
      { text: "Para baixo", error: "order_error" },
    ],
    {
      pt: "Rotação horária de 90° leva “cima” → “direita”. Esquerda seria anti-horária; baixo seria 180°.",
      rules: ["rotação 90°", "orientação"],
    },
  );
  add(
    2,
    "memoria_trabalho",
    "atualizacao_mental",
    ["numeric"],
    "Comece com S=5. Aplique em ordem: +3, ×2, −4. Qual o valor final de S?",
    "12",
    [
      { text: "14", error: "order_error" },
      { text: "10", error: "wrong_operation" },
      { text: "18", error: "arithmetic_slip" },
    ],
    {
      pt: "5+3=8; 8×2=16; 16−4=12. Errar a ordem (ex.: ×2 cedo) gera 14 ou 18.",
      rules: ["atualização", "ordem de operações"],
    },
    ["Estado inicial S = 5."],
  );
  add(
    2,
    "velocidade_processamento",
    "pareamento_rapido",
    ["analytical"],
    "Os pares são iguais? Compare: “Ξ-7-Ξ” e “Ξ-7-E”.",
    "Diferentes",
    [
      { text: "Iguais", error: "near_miss" },
      { text: "Iguais se ignorarmos o último símbolo", error: "scope_error" },
      { text: "Impossível comparar", error: "premise_ignore" },
    ],
    {
      pt: "O terceiro símbolo diverge (Ξ vs E). São diferentes; “quase iguais” é o distrator clássico de pareamento apressado.",
      rules: ["matching", "discriminação fina"],
    },
  );
  add(
    2,
    "tempo_reacao",
    "julgamento_latencia",
    ["logical"],
    "Item cronometrado: a regra “maior número ímpar vence”. Em {8, 11, 14, 9}, quem vence?",
    "11",
    [
      { text: "14", error: "wrong_operation" },
      { text: "9", error: "near_miss" },
      { text: "8", error: "premise_ignore" },
    ],
    {
      pt: "Ímpares: 11 e 9; o maior é 11. Escolher 14 ignora a restrição “ímpar”; 9 é o menor ímpar.",
      rules: ["filtro", "máximo"],
    },
  );

  /* ── Banda 3 ───────────────────────────────────────────── */
  add(
    3,
    "verbal",
    "compreensao_verbal",
    ["verbal", "logical"],
    "“Nenhum piloto presente é amador. Alguns amadores são instrutores.” O que se segue?",
    "Nenhum instrutor amador está no conjunto dos pilotos presentes",
    [
      { text: "Todos os instrutores são pilotos", error: "scope_error" },
      { text: "Alguns pilotos são amadores", error: "quantifier_error" },
      { text: "Nenhum instrutor existe", error: "premise_ignore" },
      { text: "Todos os amadores são pilotos presentes", error: "order_error" },
      { text: "Alguns pilotos presentes são instrutores", error: "incomplete_chain" },
    ],
    {
      pt: "Pilotos presentes ∩ amadores = ∅. Logo qualquer amador (incl. instrutor amador) fica fora dos pilotos presentes.",
      rules: ["quantificadores", "interseção vazia"],
    },
  );
  add(
    3,
    "fluido",
    "sequencias_logicas",
    ["numeric", "logical"],
    "Sequência: 2, 3, 5, 8, 12, ?. Qual a regra e o próximo termo?",
    "Diferenças +1,+2,+3,+4 → próximo +5 → 17",
    [
      { text: "Soma dos dois anteriores → 20", error: "wrong_operation" },
      { text: "Primos → 13", error: "false_analogy" },
      { text: "Dobros → 24", error: "arithmetic_slip" },
      { text: "Diferenças constantes +4 → 16", error: "near_miss" },
      { text: "Alternância +1/−1 → 11", error: "incomplete_chain" },
    ],
    {
      pt: "As diferenças crescem 1,2,3,4; a seguinte é +5 → 12+5=17. Fibonacci dos vizinhos daria 20, mas não casa com 12.",
      rules: ["diferenças crescentes"],
    },
  );
  add(
    3,
    "espacial",
    "visualizacao",
    ["analytical"],
    "Um cubo tem faces opostas somando 7 (como dado clássico). Se 2 está embaixo e 3 à frente, qual face fica em cima?",
    "5",
    [
      { text: "4", error: "near_miss" },
      { text: "7", error: "premise_ignore" },
      { text: "3", error: "scope_error" },
      { text: "1", error: "wrong_operation" },
      { text: "6", error: "order_error" },
    ],
    {
      pt: "Oposto de 2 é 5 (2+5=7). Embaixo=2 ⇒ cima=5. Frente=3 não altera o eixo vertical.",
      rules: ["opostos", "orientação 3D"],
    },
  );
  add(
    3,
    "memoria_trabalho",
    "sequencia_reversa",
    ["logical", "numeric"],
    "Dada a série 7–1–8–3, escreva-a de trás para frente e some os dois do meio do resultado. Quanto dá?",
    "9",
    [
      { text: "8", error: "order_error" },
      { text: "10", error: "arithmetic_slip" },
      { text: "4", error: "wrong_operation" },
      { text: "11", error: "near_miss" },
      { text: "3", error: "incomplete_chain" },
    ],
    {
      pt: "Reversa: 3–8–1–7. Dois do meio: 8+1=9.",
      rules: ["reversão", "seleção"],
    },
    ["Série original: 7, 1, 8, 3."],
  );
  add(
    3,
    "velocidade_processamento",
    "codificacao",
    ["analytical"],
    "Legenda: A→●, B→■, C→▲. Codifique BAC.",
    "■ ● ▲",
    [
      { text: "● ■ ▲", error: "order_error" },
      { text: "■ ▲ ●", error: "near_miss" },
      { text: "▲ ■ ●", error: "wrong_operation" },
      { text: "■ ■ ▲", error: "semantic_swap" },
      { text: "● ● ▲", error: "incomplete_chain" },
    ],
    {
      pt: "B→■, A→●, C→▲ ⇒ ■ ● ▲. Trocar a ordem das letras é o erro mais comum sob pressa.",
      rules: ["código", "mapeamento 1:1"],
    },
  );
  add(
    3,
    "tempo_reacao",
    "resposta_deliberada",
    ["logical"],
    "Escolha a única opção que viola a regra “se chove, a rua molha” quando observada:",
    "Chove e a rua está seca",
    [
      { text: "Não chove e a rua está seca", error: "scope_error" },
      { text: "Não chove e a rua está molhada", error: "quantifier_error" },
      { text: "Chove e a rua está molhada", error: "premise_ignore" },
      { text: "A rua molha só se chove", error: "wrong_operation" },
      { text: "Sempre que a rua molha, chove", error: "false_analogy" },
    ],
    {
      pt: "O condicional P→Q só é falso com P verdadeiro e Q falso: chove ∧ rua seca.",
      rules: ["condicional", "falsificador"],
    },
  );

  /* ── Banda 4 ───────────────────────────────────────────── */
  add(
    4,
    "verbal",
    "analogias_verbais",
    ["verbal", "analytical"],
    "Escassez está para abundância assim como opaco está para:",
    "Translúcido / transparente",
    [
      { text: "Sombrio", error: "semantic_swap" },
      { text: "Denso", error: "false_analogy" },
      { text: "Opacidade", error: "scope_error" },
      { text: "Reflexo", error: "near_miss" },
      { text: "Sólido", error: "wrong_operation" },
    ],
    {
      pt: "A relação é antônima. O antônimo de opaco no eixo óptico é translúcido/transparente.",
      rules: ["antônimo", "eixo semântico"],
    },
  );
  add(
    4,
    "fluido",
    "inducao_regras",
    ["logical", "numeric"],
    "Máquina: entra n, sai n² − n. Entrou 5 e depois o resultado voltou à máquina. Qual a saída final?",
    "380",
    [
      { text: "20", error: "incomplete_chain" },
      { text: "400", error: "arithmetic_slip" },
      { text: "25", error: "wrong_operation" },
      { text: "100", error: "near_miss" },
      { text: "420", error: "order_error" },
    ],
    {
      pt: "1ª passagem: 25−5=20. 2ª: 400−20=380. Parar em 20 ignora a reentrada.",
      rules: ["composição", "função"],
    },
  );
  add(
    4,
    "espacial",
    "rotacao_mental",
    ["analytical"],
    "Uma seta aponta NE. Após duas rotações de 135° no sentido anti-horário, para onde aponta?",
    "Sudeste",
    [
      { text: "Noroeste", error: "wrong_operation" },
      { text: "Oeste", error: "near_miss" },
      { text: "Sul", error: "order_error" },
      { text: "Norte", error: "incomplete_chain" },
      { text: "Leste", error: "arithmetic_slip" },
    ],
    {
      pt: "135°+135°=270° anti-horário ≡ 90° horário. De NE, 90° horário aponta para Sudeste (NE→E→SE).",
      rules: ["rosa dos ventos", "composição angular"],
    },
  );
  add(
    4,
    "memoria_trabalho",
    "atualizacao_mental",
    ["numeric", "logical"],
    "Fila mental: [2, 5, 9]. Remova o do meio, insira 4 no início e some os que restarem. Total?",
    "15",
    [
      { text: "16", error: "order_error" },
      { text: "11", error: "incomplete_chain" },
      { text: "20", error: "wrong_operation" },
      { text: "14", error: "near_miss" },
      { text: "9", error: "arithmetic_slip" },
    ],
    {
      pt: "Remove 5 → [2,9]; insere 4 → [4,2,9]; soma 4+2+9=15.",
      rules: ["fila", "inserção"],
    },
  );
  add(
    4,
    "velocidade_processamento",
    "busca_simbolos",
    ["analytical"],
    "Grade 3×3 (linha a linha): A B A / B C B / A B A. Quantas células iguais à do centro existem na borda (sem contar o centro)?",
    "0",
    [
      { text: "4", error: "wrong_operation" },
      { text: "2", error: "near_miss" },
      { text: "8", error: "scope_error" },
      { text: "1", error: "arithmetic_slip" },
      { text: "3", error: "incomplete_chain" },
    ],
    {
      pt: "Centro é C; na borda só há A e B. Nenhuma célula de borda é C → 0.",
      rules: ["varredura", "exclusão do centro"],
    },
  );
  add(
    4,
    "tempo_reacao",
    "decisao_rapida",
    ["logical", "analytical"],
    "Regra em cascata: se x>10 escolha “Alto”; senão se x é múltiplo de 3 escolha “Trio”; senão “Base”. Para x=9:",
    "Trio",
    [
      { text: "Alto", error: "scope_error" },
      { text: "Base", error: "wrong_operation" },
      { text: "Alto e Trio", error: "quantifier_error" },
      { text: "Indefinido", error: "premise_ignore" },
      { text: "Base, porque 9<10 e depois se ignora o múltiplo", error: "incomplete_chain" },
    ],
    {
      pt: "9≤10, então não é Alto; 9 é múltiplo de 3 → Trio. Parar em Base ignora a segunda cláusula.",
      rules: ["cascata", "prioridade"],
    },
  );

  /* ── Banda 5 ───────────────────────────────────────────── */
  add(
    5,
    "verbal",
    "compreensao_verbal",
    ["verbal", "logical", "analytical"],
    "“Só entram pesquisadores com crachá válido. Alguns visitantes têm crachá válido.” Qual conclusão é segura?",
    "Ter crachá válido não basta para provar que a pessoa é pesquisadora",
    [
      { text: "Todo visitante entra", error: "scope_error" },
      { text: "Nenhum visitante entra", error: "quantifier_error" },
      { text: "Todo crachá válido pertence a pesquisador", error: "false_analogy" },
      { text: "Pesquisadores sem crachá entram", error: "premise_ignore" },
      { text: "Visitantes com crachá são pesquisadores", error: "incomplete_chain" },
    ],
    {
      pt: "A regra exige pesquisador ∧ crachá. Visitante com crachá não satisfaz “pesquisador”; crachá não implica categoria.",
      rules: ["condição necessária", "não suficiência"],
    },
  );
  add(
    5,
    "fluido",
    "sequencias_logicas",
    ["numeric", "logical"],
    "a₁=1, a₂=2, aₙ = aₙ₋₁ + 2·aₙ₋₂. Qual é a₅?",
    "16",
    [
      { text: "10", error: "incomplete_chain" },
      { text: "14", error: "near_miss" },
      { text: "18", error: "arithmetic_slip" },
      { text: "20", error: "wrong_operation" },
      { text: "12", error: "order_error" },
    ],
    {
      pt: "a₃=2+2·1=4; a₄=4+2·2=8; a₅=8+2·4=16.",
      rules: ["recorrência linear"],
    },
  );

  add(
    5,
    "espacial",
    "visualizacao",
    ["analytical"],
    "Um papel transparente tem um triângulo no canto superior esquerdo. Você vira o papel 180° no plano da mesa. Onde fica o triângulo?",
    "Canto inferior direito",
    [
      { text: "Canto superior direito", error: "incomplete_chain" },
      { text: "Canto inferior esquerdo", error: "wrong_operation" },
      { text: "Centro", error: "scope_error" },
      { text: "Continua no superior esquerdo", error: "premise_ignore" },
      { text: "Canto superior esquerdo espelhado", error: "near_miss" },
    ],
    {
      pt: "Rotação 180° no plano troca cima↔baixo e esquerda↔direita → superior esquerdo vira inferior direito.",
      rules: ["rotação plana 180°"],
    },
  );
  add(
    5,
    "memoria_trabalho",
    "span_digitos",
    ["numeric", "logical"],
    "Retenha 6–2–9–4–1. Multiplique o 2º pelo 4º, depois subtraia o 5º. Resultado?",
    "7",
    [
      { text: "8", error: "arithmetic_slip" },
      { text: "3", error: "order_error" },
      { text: "24", error: "incomplete_chain" },
      { text: "5", error: "near_miss" },
      { text: "11", error: "wrong_operation" },
    ],
    {
      pt: "2º=2, 4º=4 → 2×4=8; 5º=1 → 8−1=7.",
      rules: ["span longo", "seleção indexada"],
    },
    ["Série: 6, 2, 9, 4, 1."],
  );
  add(
    5,
    "velocidade_processamento",
    "pareamento_rapido",
    ["analytical"],
    "Quantos dos pares abaixo são idênticos? (R7Q, R7Q) · (M2M, M2N) · (ZZ1, ZZ1) · (P8P, P8Q)",
    "2",
    [
      { text: "1", error: "near_miss" },
      { text: "3", error: "arithmetic_slip" },
      { text: "4", error: "scope_error" },
      { text: "0", error: "wrong_operation" },
      { text: "2 se contarmos M2M≈M2N", error: "false_analogy" },
    ],
    {
      pt: "Idênticos: (R7Q,R7Q) e (ZZ1,ZZ1). Os outros diferem numa letra → total 2.",
      rules: ["pareamento em lote"],
    },
  );
  add(
    5,
    "tempo_reacao",
    "julgamento_latencia",
    ["logical", "analytical"],
    "Sob pressão: escolha o único número que é ao mesmo tempo primo e maior que 20 na lista {15, 21, 23, 27, 33}.",
    "23",
    [
      { text: "21", error: "wrong_operation" },
      { text: "27", error: "arithmetic_slip" },
      { text: "15", error: "scope_error" },
      { text: "33", error: "near_miss" },
      { text: "Nenhum", error: "premise_ignore" },
    ],
    {
      pt: "23 é primo e >20. 21=3×7, 27=3³, 15 e 33 compostos. Impulso costuma marcar 21 por “parece primo”.",
      rules: ["primalidade", "filtro composto"],
    },
  );

  return qs;
}
