import type {
  CellContent,
  CognitiveIndexId,
  DistractorError,
  DistractorSpec,
  FillKind,
  Glyph,
  MatrixQuestion,
  RuleCategory,
  ShapeKind,
  SubtestId,
} from "@/src/types/quiz";

/** Derive CHC index/subtest from legacy visual rule categories */
function tagFromCategories(
  cats: RuleCategory[],
  id: number,
): { index: CognitiveIndexId; subtest: SubtestId } {
  const set = new Set(cats);
  if (set.has("spatial") && !set.has("boolean") && !set.has("pattern")) {
    const spatialSubs: SubtestId[] = [
      "rotacao_mental",
      "visualizacao",
      "completamento_espacial",
    ];
    return { index: "espacial", subtest: spatialSubs[id % 3] };
  }
  if (set.has("spatial")) {
    return {
      index: "espacial",
      subtest: id % 2 === 0 ? "rotacao_mental" : "visualizacao",
    };
  }
  if (set.has("numerical") && id % 5 === 0) {
    return { index: "velocidade_processamento", subtest: "codificacao" };
  }
  if (set.has("pattern")) {
    return { index: "fluido", subtest: "matrizes_abstratas" };
  }
  if (set.has("boolean")) {
    return { index: "fluido", subtest: "inducao_regras" };
  }
  if (set.has("numerical")) {
    return { index: "fluido", subtest: "sequencias_logicas" };
  }
  return { index: "fluido", subtest: "matrizes_abstratas" };
}

/* ─── Cell builders ───────────────────────────────────────────────── */

function g(
  shape: ShapeKind,
  opts: Partial<Omit<Glyph, "shape">> = {},
): Glyph {
  return { shape, fill: "empty", scale: 1, ...opts };
}

function cell(...glyphs: Glyph[]): CellContent {
  return { glyphs };
}

function counted(
  shape: ShapeKind,
  count: number,
  fill: FillKind = "empty",
  rotation = 0,
): CellContent {
  const glyphs: Glyph[] = [];
  if (count <= 0) return { glyphs: [] };
  if (count === 1) {
    return cell(g(shape, { fill, rotation, scale: 0.72 }));
  }
  if (count === 2) {
    return {
      glyphs: [
        g(shape, { fill, rotation, scale: 0.42, ox: -0.32, oy: 0 }),
        g(shape, { fill, rotation, scale: 0.42, ox: 0.32, oy: 0 }),
      ],
    };
  }
  if (count === 3) {
    return {
      glyphs: [
        g(shape, { fill, rotation, scale: 0.36, ox: 0, oy: -0.3 }),
        g(shape, { fill, rotation, scale: 0.36, ox: -0.3, oy: 0.22 }),
        g(shape, { fill, rotation, scale: 0.36, ox: 0.3, oy: 0.22 }),
      ],
    };
  }
  if (count === 4) {
    const o = 0.28;
    return {
      glyphs: [
        g(shape, { fill, rotation, scale: 0.32, ox: -o, oy: -o }),
        g(shape, { fill, rotation, scale: 0.32, ox: o, oy: -o }),
        g(shape, { fill, rotation, scale: 0.32, ox: -o, oy: o }),
        g(shape, { fill, rotation, scale: 0.32, ox: o, oy: o }),
      ],
    };
  }
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    glyphs.push(
      g(shape, {
        fill,
        rotation,
        scale: 0.26,
        ox: Math.cos(angle) * 0.38,
        oy: Math.sin(angle) * 0.38,
      }),
    );
  }
  return { glyphs };
}

function rotated(
  shape: ShapeKind,
  deg: number,
  fill: FillKind = "empty",
): CellContent {
  return cell(g(shape, { fill, rotation: deg, scale: 0.7 }));
}

function stacked(...items: Glyph[]): CellContent {
  return { glyphs: items };
}

function cloneCell(c: CellContent): CellContent {
  return {
    glyphs: c.glyphs.map((x) => ({ ...x })),
    arrangement: c.arrangement,
    count: c.count,
  };
}

function cellSignature(c: CellContent): string {
  return c.glyphs
    .map(
      (x) =>
        `${x.shape}:${x.fill ?? "empty"}:${x.rotation ?? 0}:${(x.scale ?? 1).toFixed(3)}:${(x.ox ?? 0).toFixed(3)}:${(x.oy ?? 0).toFixed(3)}`,
    )
    .join("|");
}

function distractor(
  cellContent: CellContent,
  error: DistractorError,
): DistractorSpec {
  return { cell: cellContent, error };
}

/**
 * Pack correct + diagnostic distractors into 6 or 8 shuffled options.
 * Every wrong option carries a labeled logical error — never random filler.
 */
function packOptions(
  correct: CellContent,
  distractors: DistractorSpec[],
  seed: number,
  optionCount: 6 | 8 = 6,
): {
  options: CellContent[];
  correctIndex: number;
  distractorErrors: (DistractorError | null)[];
} {
  const need = optionCount - 1;
  const specs = distractors.slice(0, need);
  while (specs.length < need) {
    specs.push(
      distractor(
        cell(g("cross", { scale: 0.35 + specs.length * 0.02 })),
        "extra_element",
      ),
    );
  }

  const poolCells = [cloneCell(correct), ...specs.map((d) => cloneCell(d.cell))];
  const poolErrors: (DistractorError | null)[] = [
    null,
    ...specs.map((d) => d.error),
  ];

  let s = seed | 0;
  for (let i = optionCount - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [poolCells[i], poolCells[j]] = [poolCells[j], poolCells[i]];
    [poolErrors[i], poolErrors[j]] = [poolErrors[j], poolErrors[i]];
  }

  // Prefer the slot that still carries the null error label (the true correct)
  let correctIndex = poolErrors.findIndex((e) => e === null);
  if (correctIndex < 0) {
    const target = cellSignature(correct);
    correctIndex = Math.max(
      0,
      poolCells.findIndex((c) => cellSignature(c) === target),
    );
    poolErrors[correctIndex] = null;
  }

  // Ensure unique signatures — never mutate the correct slot
  const seen = new Set<string>();
  seen.add(cellSignature(poolCells[correctIndex]));
  for (let i = 0; i < poolCells.length; i++) {
    if (i === correctIndex) continue;
    let sig = cellSignature(poolCells[i]);
    if (seen.has(sig)) {
      poolCells[i] = cell(
        g("dot", {
          fill: "solid",
          scale: 0.22,
          ox: 0.08 * ((i % 4) - 1.5),
          oy: 0.08 * (Math.floor(i / 4) - 0.5),
        }),
        g("cross", { scale: 0.28 + i * 0.01 }),
      );
      poolErrors[i] = poolErrors[i] ?? "extra_element";
      sig = cellSignature(poolCells[i]);
      let n = 0;
      while (seen.has(sig) && n < 5) {
        poolCells[i] = cell(
          g("dot", {
            fill: "solid",
            scale: 0.2 + n * 0.02,
            ox: 0.1 * i + n * 0.03,
            oy: -0.1 * i - n * 0.02,
          }),
        );
        sig = cellSignature(poolCells[i]);
        n += 1;
      }
    }
    seen.add(sig);
  }

  return {
    options: poolCells,
    correctIndex,
    distractorErrors: poolErrors,
  };
}

function matrix9(cells: (CellContent | null)[]): (CellContent | null)[] {
  const out = cells.slice(0, 9);
  while (out.length < 9) out.push(cell());
  out[8] = null;
  return out;
}

function pushQ(
  qs: MatrixQuestion[],
  partial: Omit<
    MatrixQuestion,
    | "kind"
    | "options"
    | "correctIndex"
    | "distractorErrors"
    | "index"
    | "subtest"
  > & {
    correct: CellContent;
    distractors: DistractorSpec[];
    seed: number;
    optionCount?: 6 | 8;
    index?: CognitiveIndexId;
    subtest?: SubtestId;
  },
) {
  const optionCount =
    partial.optionCount ?? (partial.difficulty >= 3 ? 8 : 6);
  const { options, correctIndex, distractorErrors } = packOptions(
    partial.correct,
    partial.distractors,
    partial.seed,
    optionCount,
  );
  const tagged =
    partial.index && partial.subtest
      ? { index: partial.index, subtest: partial.subtest }
      : tagFromCategories(partial.categories, partial.id);
  qs.push({
    kind: "matrix",
    id: partial.id,
    difficulty: partial.difficulty,
    weight: partial.weight,
    irtB: partial.irtB,
    categories: partial.categories,
    index: tagged.index,
    subtest: tagged.subtest,
    cells: partial.cells,
    options,
    correctIndex,
    distractorErrors,
    explanation: partial.explanation,
  });
}

function corners(mask: number): CellContent {
  const pos = [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ] as const;
  const glyphs: Glyph[] = [];
  for (let i = 0; i < 4; i++) {
    if (mask & (1 << i)) {
      glyphs.push(
        g("dot", {
          fill: "solid",
          scale: 0.28,
          ox: pos[i][0],
          oy: pos[i][1],
        }),
      );
    }
  }
  return { glyphs };
}

type Stroke = "h" | "v" | "d1" | "d2";

function stroke(parts: Stroke[]): CellContent {
  const glyphs: Glyph[] = [];
  for (const p of parts) {
    if (p === "h") glyphs.push(g("line", { rotation: 0, scale: 0.85 }));
    if (p === "v") glyphs.push(g("line", { rotation: 90, scale: 0.85 }));
    if (p === "d1") glyphs.push(g("line", { rotation: 45, scale: 0.85 }));
    if (p === "d2") glyphs.push(g("line", { rotation: 135, scale: 0.85 }));
  }
  return { glyphs };
}

function xorStrokes(a: Stroke[], b: Stroke[]): Stroke[] {
  const set = new Set(a);
  for (const x of b) {
    if (set.has(x)) set.delete(x);
    else set.add(x);
  }
  return [...set];
}

/* ─── Question bank (30 progressive, 5 bands × 6) ─────────────────── */

function buildQuestions(): MatrixQuestion[] {
  const qs: MatrixQuestion[] = [];

  /* ═══════════════ BAND 1 — Básico (QI ~70–100) ═══════════════ */

  // Q1 — count +1
  {
    const correct = counted("circle", 3);
    pushQ(qs, {
      id: 1,
      difficulty: 1,
      weight: 1,
      irtB: -1.8,
      categories: ["numerical"],
      cells: matrix9([
        counted("circle", 1),
        counted("circle", 2),
        counted("circle", 3),
        counted("circle", 1),
        counted("circle", 2),
        counted("circle", 3),
        counted("circle", 1),
        counted("circle", 2),
        null,
      ]),
      correct,
      distractors: [
        distractor(counted("circle", 2), "wrong_count"),
        distractor(counted("circle", 4), "wrong_count"),
        distractor(counted("square", 3), "shape_swap"),
        distractor(counted("circle", 1), "wrong_count"),
        distractor(counted("triangle", 3), "shape_swap"),
      ],
      seed: 201,
      explanation: {
        pt: "Em cada linha, a contagem sobe +1 (1 → 2 → 3).",
        rules: ["Progressão aritmética"],
      },
    });
  }

  // Q2 — shape cycle
  {
    const correct = cell(g("triangle", { scale: 0.7 }));
    pushQ(qs, {
      id: 2,
      difficulty: 1,
      weight: 1,
      irtB: -1.6,
      categories: ["pattern"],
      cells: matrix9([
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.7 })),
        cell(g("triangle", { scale: 0.7 })),
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.7 })),
        cell(g("triangle", { scale: 0.7 })),
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.7 })),
        null,
      ]),
      correct,
      distractors: [
        distractor(cell(g("circle", { scale: 0.7 })), "horizontal_only"),
        distractor(cell(g("square", { scale: 0.7 })), "wrong_count"),
        distractor(cell(g("hexagon", { scale: 0.7 })), "shape_swap"),
        distractor(
          cell(g("triangle", { fill: "solid", scale: 0.7 })),
          "polarity_flip",
        ),
        distractor(cell(g("diamond", { scale: 0.7 })), "shape_swap"),
      ],
      seed: 202,
      explanation: {
        pt: "Cada linha repete círculo → quadrado → triângulo.",
        rules: ["Alternância de formas"],
      },
    });
  }

  // Q3 — fill progression
  {
    const correct = cell(g("square", { fill: "solid", scale: 0.7 }));
    pushQ(qs, {
      id: 3,
      difficulty: 1,
      weight: 1.1,
      irtB: -1.4,
      categories: ["pattern"],
      cells: matrix9([
        cell(g("square", { fill: "empty", scale: 0.7 })),
        cell(g("square", { fill: "hatched", scale: 0.7 })),
        cell(g("square", { fill: "solid", scale: 0.7 })),
        cell(g("square", { fill: "empty", scale: 0.7 })),
        cell(g("square", { fill: "hatched", scale: 0.7 })),
        cell(g("square", { fill: "solid", scale: 0.7 })),
        cell(g("square", { fill: "empty", scale: 0.7 })),
        cell(g("square", { fill: "hatched", scale: 0.7 })),
        null,
      ]),
      correct,
      distractors: [
        distractor(
          cell(g("square", { fill: "empty", scale: 0.7 })),
          "polarity_flip",
        ),
        distractor(
          cell(g("square", { fill: "hatched", scale: 0.7 })),
          "incomplete_rotation",
        ),
        distractor(
          cell(g("circle", { fill: "solid", scale: 0.7 })),
          "shape_swap",
        ),
        distractor(
          cell(g("square", { fill: "dotted", scale: 0.7 })),
          "fill_only",
        ),
        distractor(
          cell(g("triangle", { fill: "solid", scale: 0.7 })),
          "shape_swap",
        ),
      ],
      seed: 203,
      explanation: {
        pt: "Preenchimento avança: vazio → hachurado → sólido.",
        rules: ["Progressão de preenchimento"],
      },
    });
  }

  // Q4 — 90° rotation
  {
    const correct = rotated("triangle", 180);
    pushQ(qs, {
      id: 4,
      difficulty: 1,
      weight: 1.15,
      irtB: -1.2,
      categories: ["spatial"],
      cells: matrix9([
        rotated("triangle", 0),
        rotated("triangle", 90),
        rotated("triangle", 180),
        rotated("triangle", 0),
        rotated("triangle", 90),
        rotated("triangle", 180),
        rotated("triangle", 0),
        rotated("triangle", 90),
        null,
      ]),
      correct,
      distractors: [
        distractor(rotated("triangle", 0), "incomplete_rotation"),
        distractor(rotated("triangle", 90), "incomplete_rotation"),
        distractor(rotated("triangle", 270), "incomplete_rotation"),
        distractor(rotated("triangle", 45), "incomplete_rotation"),
        distractor(rotated("square", 180), "shape_swap"),
      ],
      seed: 204,
      explanation: {
        pt: "O triângulo gira +90° por coluna (0° → 90° → 180°).",
        rules: ["Rotação 90°"],
      },
    });
  }

  // Q5 — count decreases
  {
    const correct = counted("dot", 2, "solid");
    pushQ(qs, {
      id: 5,
      difficulty: 1,
      weight: 1.2,
      irtB: -1.1,
      categories: ["numerical"],
      cells: matrix9([
        counted("dot", 4, "solid"),
        counted("dot", 3, "solid"),
        counted("dot", 2, "solid"),
        counted("dot", 4, "solid"),
        counted("dot", 3, "solid"),
        counted("dot", 2, "solid"),
        counted("dot", 4, "solid"),
        counted("dot", 3, "solid"),
        null,
      ]),
      correct,
      distractors: [
        distractor(counted("dot", 1, "solid"), "wrong_count"),
        distractor(counted("dot", 3, "solid"), "wrong_count"),
        distractor(counted("dot", 4, "solid"), "wrong_count"),
        distractor(counted("circle", 2, "solid"), "shape_swap"),
        distractor(counted("dot", 2, "empty"), "polarity_flip"),
      ],
      seed: 205,
      explanation: {
        pt: "Contagem decresce −1 por coluna (4 → 3 → 2).",
        rules: ["Progressão decrescente"],
      },
    });
  }

  // Q6 — size shrink
  {
    const mk = (scale: number) =>
      cell(g("hexagon", { scale, fill: "empty" }));
    const correct = mk(0.4);
    pushQ(qs, {
      id: 6,
      difficulty: 1,
      weight: 1.2,
      irtB: -1.0,
      categories: ["spatial"],
      cells: matrix9([
        mk(0.75),
        mk(0.55),
        mk(0.4),
        mk(0.75),
        mk(0.55),
        mk(0.4),
        mk(0.75),
        mk(0.55),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(0.75), "wrong_scale"),
        distractor(mk(0.55), "wrong_scale"),
        distractor(mk(0.3), "wrong_scale"),
        distractor(
          cell(g("hexagon", { scale: 0.4, fill: "solid" })),
          "polarity_flip",
        ),
        distractor(
          cell(g("circle", { scale: 0.4 })),
          "shape_swap",
        ),
      ],
      seed: 206,
      explanation: {
        pt: "A escala diminui a cada coluna (grande → médio → pequeno).",
        rules: ["Escala progressiva"],
      },
    });
  }

  /* ═══════════════ BAND 2 — Elementar ═══════════════ */

  // Q7 — shape + fill together
  {
    const shapes: ShapeKind[] = ["circle", "square", "triangle"];
    const fills: FillKind[] = ["empty", "hatched", "solid"];
    const mk = (si: number, fi: number) =>
      cell(g(shapes[si], { fill: fills[fi], scale: 0.68 }));
    const correct = mk(2, 2);
    pushQ(qs, {
      id: 7,
      difficulty: 2,
      weight: 1.4,
      irtB: -0.7,
      categories: ["pattern"],
      cells: matrix9([
        mk(0, 0),
        mk(1, 1),
        mk(2, 2),
        mk(0, 0),
        mk(1, 1),
        mk(2, 2),
        mk(0, 0),
        mk(1, 1),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(2, 0), "fill_only"),
        distractor(mk(2, 1), "incomplete_rotation"),
        distractor(mk(0, 2), "shape_swap"),
        distractor(mk(1, 2), "shape_swap"),
        distractor(mk(1, 1), "missing_rule"),
      ],
      seed: 207,
      explanation: {
        pt: "Forma e preenchimento avançam juntos.",
        rules: ["Forma + preenchimento"],
      },
    });
  }

  // Q8 — 45° diamond rotation
  {
    const correct = rotated("diamond", 90);
    pushQ(qs, {
      id: 8,
      difficulty: 2,
      weight: 1.45,
      irtB: -0.55,
      categories: ["spatial"],
      cells: matrix9([
        rotated("diamond", 0),
        rotated("diamond", 45),
        rotated("diamond", 90),
        rotated("diamond", 0),
        rotated("diamond", 45),
        rotated("diamond", 90),
        rotated("diamond", 0),
        rotated("diamond", 45),
        null,
      ]),
      correct,
      distractors: [
        distractor(rotated("diamond", 0), "incomplete_rotation"),
        distractor(rotated("diamond", 45), "incomplete_rotation"),
        distractor(rotated("diamond", 135), "incomplete_rotation"),
        distractor(rotated("square", 90), "shape_swap"),
        distractor(rotated("diamond", 180), "mirror_instead_of_rotate"),
      ],
      seed: 208,
      explanation: {
        pt: "Losango gira +45° por coluna.",
        rules: ["Rotação 45°"],
      },
    });
  }

  // Q9 — OR union of shapes
  {
    const both = stacked(
      g("circle", { scale: 0.7 }),
      g("square", { scale: 0.45 }),
    );
    pushQ(qs, {
      id: 9,
      difficulty: 2,
      weight: 1.5,
      irtB: -0.4,
      categories: ["boolean"],
      cells: matrix9([
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.55 })),
        both,
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.55 })),
        both,
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.55 })),
        null,
      ]),
      correct: both,
      distractors: [
        distractor(cell(g("circle", { scale: 0.7 })), "and_instead_of_xor"),
        distractor(cell(g("square", { scale: 0.7 })), "missing_rule"),
        distractor(cell(g("triangle", { scale: 0.7 })), "shape_swap"),
        distractor(
          stacked(g("circle", { scale: 0.7 }), g("triangle", { scale: 0.45 })),
          "shape_swap",
        ),
        distractor(cell(g("hexagon", { scale: 0.7 })), "extra_element"),
      ],
      seed: 209,
      explanation: {
        pt: "Terceira coluna = união (OR) das duas primeiras.",
        rules: ["OR / união"],
      },
    });
  }

  // Q10 — count by row, shape by column
  {
    const mk = (shape: ShapeKind, n: number) => counted(shape, n);
    const correct = mk("hexagon", 3);
    pushQ(qs, {
      id: 10,
      difficulty: 2,
      weight: 1.55,
      irtB: -0.25,
      categories: ["numerical", "pattern"],
      cells: matrix9([
        mk("circle", 1),
        mk("square", 1),
        mk("hexagon", 1),
        mk("circle", 2),
        mk("square", 2),
        mk("hexagon", 2),
        mk("circle", 3),
        mk("square", 3),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk("hexagon", 2), "wrong_count"),
        distractor(mk("hexagon", 4), "wrong_count"),
        distractor(mk("triangle", 3), "shape_swap"),
        distractor(mk("circle", 3), "horizontal_only"),
        distractor(mk("square", 3), "vertical_only"),
      ],
      seed: 210,
      explanation: {
        pt: "Coluna fixa a forma; linha aumenta a contagem.",
        rules: ["Forma por coluna", "Contagem por linha"],
      },
    });
  }

  // Q11 — checkerboard 180° flip
  {
    const upright = stacked(
      g("triangle", { scale: 0.5, oy: -0.15, fill: "solid" }),
      g("line", { scale: 0.8, oy: 0.35 }),
    );
    const flipped = stacked(
      g("triangle", {
        scale: 0.5,
        oy: 0.15,
        fill: "solid",
        rotation: 180,
      }),
      g("line", { scale: 0.8, oy: -0.35 }),
    );
    pushQ(qs, {
      id: 11,
      difficulty: 2,
      weight: 1.6,
      irtB: -0.1,
      categories: ["spatial"],
      cells: matrix9([
        upright,
        flipped,
        upright,
        flipped,
        upright,
        flipped,
        upright,
        flipped,
        null,
      ]),
      correct: flipped,
      distractors: [
        distractor(upright, "incomplete_rotation"),
        distractor(
          stacked(
            g("triangle", { scale: 0.5, oy: -0.15, fill: "empty" }),
            g("line", { scale: 0.8, oy: 0.35 }),
          ),
          "polarity_flip",
        ),
        distractor(rotated("triangle", 180, "solid"), "missing_rule"),
        distractor(
          cell(g("triangle", { scale: 0.7, fill: "solid", rotation: 90 })),
          "incomplete_rotation",
        ),
        distractor(
          stacked(
            g("triangle", {
              scale: 0.5,
              oy: 0.15,
              fill: "hatched",
              rotation: 180,
            }),
            g("line", { scale: 0.8, oy: -0.35 }),
          ),
          "fill_only",
        ),
      ],
      seed: 211,
      explanation: {
        pt: "Padrão xadrez: figura ↔ rotação 180°.",
        rules: ["Rotação 180° alternada"],
      },
    });
  }

  // Q12 — AND intersection
  {
    const circSq = stacked(
      g("circle", { scale: 0.7 }),
      g("square", { scale: 0.4 }),
    );
    const circTri = stacked(
      g("circle", { scale: 0.7 }),
      g("triangle", { scale: 0.4 }),
    );
    const onlyCirc = cell(g("circle", { scale: 0.7 }));
    pushQ(qs, {
      id: 12,
      difficulty: 2,
      weight: 1.7,
      irtB: 0.0,
      categories: ["boolean"],
      cells: matrix9([
        circSq,
        circTri,
        onlyCirc,
        circSq,
        circTri,
        onlyCirc,
        circSq,
        circTri,
        null,
      ]),
      correct: onlyCirc,
      distractors: [
        distractor(circSq, "or_instead_of_xor"),
        distractor(circTri, "extra_element"),
        distractor(cell(g("square", { scale: 0.55 })), "shape_swap"),
        distractor(cell(g("triangle", { scale: 0.55 })), "shape_swap"),
        distractor(
          stacked(g("square", { scale: 0.5 }), g("triangle", { scale: 0.4 })),
          "or_instead_of_xor",
        ),
      ],
      seed: 212,
      explanation: {
        pt: "AND: permanece só o elemento comum (círculo).",
        rules: ["Interseção AND"],
      },
    });
  }

  /* ═══════════════ BAND 3 — Intermediário (8 opções) ═══════════════ */

  // Q13 — rotate + fill dual
  {
    const mk = (rot: number, fill: FillKind) =>
      cell(g("triangle", { rotation: rot, fill, scale: 0.65 }));
    const correct = mk(180, "solid");
    pushQ(qs, {
      id: 13,
      difficulty: 3,
      weight: 1.9,
      irtB: 0.25,
      categories: ["spatial", "pattern"],
      cells: matrix9([
        mk(0, "empty"),
        mk(90, "hatched"),
        mk(180, "solid"),
        mk(0, "empty"),
        mk(90, "hatched"),
        mk(180, "solid"),
        mk(0, "empty"),
        mk(90, "hatched"),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(180, "empty"), "fill_only"),
        distractor(mk(180, "hatched"), "incomplete_rotation"),
        distractor(mk(90, "solid"), "incomplete_rotation"),
        distractor(mk(270, "solid"), "incomplete_rotation"),
        distractor(mk(0, "solid"), "missing_rule"),
        distractor(mk(180, "dotted"), "polarity_flip"),
        distractor(
          cell(g("square", { rotation: 180, fill: "solid", scale: 0.65 })),
          "shape_swap",
        ),
      ],
      seed: 213,
      explanation: {
        pt: "Duas regras: +90° e vazio → hachurado → sólido.",
        rules: ["Rotação 90°", "Preenchimento"],
      },
    });
  }

  // Q14 — XOR classic
  {
    const a = stacked(g("circle", { scale: 0.7 }), g("cross", { scale: 0.55 }));
    const b = stacked(g("circle", { scale: 0.7 }), g("square", { scale: 0.4 }));
    const correct = stacked(
      g("cross", { scale: 0.55 }),
      g("square", { scale: 0.4 }),
    );
    pushQ(qs, {
      id: 14,
      difficulty: 3,
      weight: 2.0,
      irtB: 0.4,
      categories: ["boolean"],
      cells: matrix9([a, b, correct, a, b, correct, a, b, null]),
      correct,
      distractors: [
        distractor(a, "missing_rule"),
        distractor(b, "missing_rule"),
        distractor(cell(g("circle", { scale: 0.7 })), "and_instead_of_xor"),
        distractor(
          stacked(
            g("circle", { scale: 0.7 }),
            g("cross", { scale: 0.55 }),
            g("square", { scale: 0.35 }),
          ),
          "or_instead_of_xor",
        ),
        distractor(cell(g("cross", { scale: 0.6 })), "partial_union"),
        distractor(cell(g("square", { scale: 0.55 })), "partial_union"),
        distractor(
          stacked(g("circle", { scale: 0.5 }), g("cross", { scale: 0.4 })),
          "polarity_flip",
        ),
      ],
      seed: 214,
      explanation: {
        pt: "XOR: o círculo comum cancela; restam cruz e quadrado.",
        rules: ["XOR de elementos"],
      },
    });
  }

  // Q15 — row sum = 6
  {
    const correct = counted("circle", 1);
    pushQ(qs, {
      id: 15,
      difficulty: 3,
      weight: 2.05,
      irtB: 0.5,
      categories: ["numerical"],
      cells: matrix9([
        counted("circle", 1),
        counted("circle", 2),
        counted("circle", 3),
        counted("circle", 2),
        counted("circle", 3),
        counted("circle", 1),
        counted("circle", 3),
        counted("circle", 2),
        null,
      ]),
      correct,
      distractors: [
        distractor(counted("circle", 2), "wrong_count"),
        distractor(counted("circle", 3), "wrong_count"),
        distractor(counted("circle", 4), "wrong_count"),
        distractor(counted("square", 1), "shape_swap"),
        distractor(counted("circle", 0), "wrong_count"),
        distractor(counted("circle", 5), "wrong_count"),
        distractor(counted("dot", 1, "solid"), "shape_swap"),
      ],
      seed: 215,
      explanation: {
        pt: "Soma por linha = 6 (3+2+?).",
        rules: ["Soma constante"],
      },
    });
  }

  // Q16 — rotate + shrink
  {
    const mk = (rot: number, scale: number) =>
      cell(g("hexagon", { rotation: rot, scale, fill: "empty" }));
    const correct = mk(90, 0.45);
    pushQ(qs, {
      id: 16,
      difficulty: 3,
      weight: 2.15,
      irtB: 0.6,
      categories: ["spatial"],
      cells: matrix9([
        mk(0, 0.7),
        mk(45, 0.55),
        mk(90, 0.45),
        mk(0, 0.7),
        mk(45, 0.55),
        mk(90, 0.45),
        mk(0, 0.7),
        mk(45, 0.55),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(90, 0.7), "wrong_scale"),
        distractor(mk(45, 0.45), "incomplete_rotation"),
        distractor(mk(0, 0.45), "incomplete_rotation"),
        distractor(mk(135, 0.45), "incomplete_rotation"),
        distractor(mk(90, 0.55), "wrong_scale"),
        distractor(
          cell(g("hexagon", { rotation: 90, scale: 0.45, fill: "solid" })),
          "polarity_flip",
        ),
        distractor(
          cell(g("circle", { scale: 0.45 })),
          "shape_swap",
        ),
      ],
      seed: 216,
      explanation: {
        pt: "Gira +45° e reduz escala por coluna.",
        rules: ["Rotação 45°", "Escala"],
      },
    });
  }

  // Q17 — shape cycle + XOR fill
  {
    const mk = (shape: ShapeKind, fill: FillKind) =>
      cell(g(shape, { fill, scale: 0.65 }));
    const correct = mk("triangle", "solid");
    pushQ(qs, {
      id: 17,
      difficulty: 3,
      weight: 2.25,
      irtB: 0.7,
      categories: ["pattern", "boolean"],
      cells: matrix9([
        mk("circle", "empty"),
        mk("square", "hatched"),
        mk("triangle", "solid"),
        mk("square", "empty"),
        mk("triangle", "hatched"),
        mk("circle", "solid"),
        mk("triangle", "empty"),
        mk("circle", "hatched"),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk("triangle", "empty"), "fill_only"),
        distractor(mk("triangle", "hatched"), "fill_only"),
        distractor(mk("circle", "solid"), "horizontal_only"),
        distractor(mk("square", "solid"), "shape_swap"),
        distractor(mk("hexagon", "solid"), "shape_swap"),
        distractor(mk("triangle", "dotted"), "polarity_flip"),
        distractor(mk("diamond", "solid"), "shape_swap"),
      ],
      seed: 217,
      explanation: {
        pt: "Formas ciclam por linha (início deslocado). Preenchimento avança vazio → hachurado → sólido.",
        rules: ["Ciclo de formas", "Progressão de preenchimento"],
      },
    });
  }

  // Q18 — nested squares + rotation by row
  {
    const mk = (n: number, rot: number) => {
      const glyphs: Glyph[] = [];
      for (let i = 0; i < n; i++) {
        glyphs.push(
          g("square", {
            scale: 0.7 - i * 0.18,
            rotation: rot,
            fill: "empty",
          }),
        );
      }
      return { glyphs };
    };
    const correct = mk(3, 45);
    pushQ(qs, {
      id: 18,
      difficulty: 3,
      weight: 2.35,
      irtB: 0.85,
      categories: ["numerical", "spatial"],
      cells: matrix9([
        mk(1, 0),
        mk(2, 0),
        mk(3, 0),
        mk(1, 22),
        mk(2, 22),
        mk(3, 22),
        mk(1, 45),
        mk(2, 45),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(3, 0), "vertical_only"),
        distractor(mk(2, 45), "wrong_count"),
        distractor(mk(3, 90), "incomplete_rotation"),
        distractor(mk(4, 45), "wrong_count"),
        distractor(mk(3, 30), "incomplete_rotation"),
        distractor(mk(3, 22), "horizontal_only"),
        distractor(mk(1, 45), "wrong_count"),
      ],
      seed: 218,
      explanation: {
        pt: "Colunas: aninhamento 1→2→3. Linhas: rotação 0°→22°→45°.",
        rules: ["Contagem aninhada", "Rotação por linha"],
      },
    });
  }

  /* ═══════════════ BAND 4 — Alta Complexidade (multi-rule) ═══════════════ */

  // Q19 — OR of corner dots (row3: 0b1001 ∨ 0b0010 = 0b1011)
  {
    const correct = corners(0b1011);
    pushQ(qs, {
      id: 19,
      difficulty: 4,
      weight: 2.7,
      irtB: 1.05,
      categories: ["boolean", "numerical"],
      cells: matrix9([
        corners(0b0011),
        corners(0b0101),
        corners(0b0111),
        corners(0b1100),
        corners(0b1010),
        corners(0b1110),
        corners(0b1001),
        corners(0b0010),
        null,
      ]),
      correct,
      distractors: [
        distractor(corners(0b0011), "missing_rule"),
        distractor(corners(0b0101), "missing_rule"),
        distractor(corners(0b1111), "extra_element"),
        distractor(corners(0b0110), "and_instead_of_xor"),
        distractor(corners(0b0001), "partial_union"),
        distractor(corners(0b1001), "horizontal_only"),
        distractor(corners(0b0010), "vertical_only"),
      ],
      seed: 219,
      explanation: {
        pt: "Terceira célula = união (OR) das posições dos pontos. Linha 3: 1001 ∨ 0010 = 1011.",
        rules: ["OR espacial", "Máscara de cantos"],
      },
    });
  }

  // Q20 — shape by row, rot by col, fill by diagonal
  {
    const shapes: ShapeKind[] = ["circle", "square", "triangle"];
    const mk = (r: number, c: number) => {
      const fill: FillKind =
        (r + c) % 3 === 0 ? "empty" : (r + c) % 3 === 1 ? "hatched" : "solid";
      return cell(
        g(shapes[r], { fill, rotation: c * 45, scale: 0.62 }),
      );
    };
    const correct = mk(2, 2);
    pushQ(qs, {
      id: 20,
      difficulty: 4,
      weight: 2.9,
      irtB: 1.2,
      categories: ["spatial", "pattern"],
      cells: matrix9([
        mk(0, 0),
        mk(0, 1),
        mk(0, 2),
        mk(1, 0),
        mk(1, 1),
        mk(1, 2),
        mk(2, 0),
        mk(2, 1),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(2, 1), "incomplete_rotation"),
        distractor(mk(1, 2), "horizontal_only"),
        distractor(
          cell(g("triangle", { fill: "solid", rotation: 90, scale: 0.62 })),
          "missing_rule",
        ),
        distractor(
          cell(g("triangle", { fill: "empty", rotation: 90, scale: 0.62 })),
          "polarity_flip",
        ),
        distractor(
          cell(g("hexagon", { fill: "hatched", rotation: 90, scale: 0.62 })),
          "shape_swap",
        ),
        distractor(
          cell(g("triangle", { fill: "dotted", rotation: 90, scale: 0.62 })),
          "fill_only",
        ),
        distractor(
          cell(g("triangle", { fill: "hatched", rotation: 45, scale: 0.62 })),
          "incomplete_rotation",
        ),
      ],
      seed: 220,
      explanation: {
        pt: "Linha→forma; coluna→rotação 0/45/90; r+c→preenchimento.",
        rules: ["Forma por linha", "Rotação por coluna", "Fill diagonal"],
      },
    });
  }

  // Q21 — XOR corners (row3: 1110 ⊕ 1001 = 0111)
  {
    pushQ(qs, {
      id: 21,
      difficulty: 4,
      weight: 3.0,
      irtB: 1.35,
      categories: ["boolean"],
      cells: matrix9([
        corners(0b1100),
        corners(0b1010),
        corners(0b0110),
        corners(0b1001),
        corners(0b0101),
        corners(0b1100),
        corners(0b1110),
        corners(0b1001),
        null,
      ]),
      correct: corners(0b0111),
      distractors: [
        distractor(corners(0b1110), "or_instead_of_xor"),
        distractor(corners(0b1000), "and_instead_of_xor"),
        distractor(corners(0b0011), "wrong_count"),
        distractor(corners(0b1111), "or_instead_of_xor"),
        distractor(corners(0b0101), "horizontal_only"),
        distractor(corners(0b0110), "vertical_only"),
        distractor(corners(0b1001), "missing_rule"),
      ],
      seed: 221,
      explanation: {
        pt: "XOR de posições: 1110 ⊕ 1001 = 0111.",
        rules: ["XOR espacial"],
      },
    });
  }

  // Q22 — triple rule: shape + count + rot + fill
  {
    const mk = (
      shape: ShapeKind,
      n: number,
      rot: number,
      fill: FillKind,
    ): CellContent => {
      if (n === 1) return cell(g(shape, { fill, rotation: rot, scale: 0.65 }));
      return counted(shape, n, fill, rot);
    };
    const correct = mk("hexagon", 3, 90, "solid");
    pushQ(qs, {
      id: 22,
      difficulty: 4,
      weight: 3.2,
      irtB: 1.45,
      categories: ["numerical", "spatial", "pattern"],
      cells: matrix9([
        mk("circle", 1, 0, "empty"),
        mk("square", 2, 45, "hatched"),
        mk("hexagon", 3, 90, "solid"),
        mk("circle", 1, 0, "empty"),
        mk("square", 2, 45, "hatched"),
        mk("hexagon", 3, 90, "solid"),
        mk("circle", 1, 0, "empty"),
        mk("square", 2, 45, "hatched"),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk("hexagon", 3, 90, "hatched"), "fill_only"),
        distractor(mk("hexagon", 2, 90, "solid"), "wrong_count"),
        distractor(mk("hexagon", 3, 45, "solid"), "incomplete_rotation"),
        distractor(mk("triangle", 3, 90, "solid"), "shape_swap"),
        distractor(mk("hexagon", 3, 0, "solid"), "incomplete_rotation"),
        distractor(mk("hexagon", 3, 90, "empty"), "polarity_flip"),
        distractor(mk("square", 3, 90, "solid"), "horizontal_only"),
      ],
      seed: 222,
      explanation: {
        pt: "Quatro regras alinhadas: forma C→Q→H, contagem 1→2→3, rotação 0→45→90, fill vazio→hachurado→sólido.",
        rules: ["Forma", "Contagem", "Rotação", "Preenchimento"],
      },
    });
  }

  // Q23 — element distribution / union
  {
    const A = cell(
      g("circle", { scale: 0.35, ox: -0.25, oy: -0.25, fill: "solid" }),
    );
    const B = cell(
      g("square", { scale: 0.35, ox: 0.25, oy: -0.25, fill: "hatched" }),
    );
    const C = cell(
      g("triangle", { scale: 0.35, ox: 0, oy: 0.25, fill: "empty" }),
    );
    const AB = stacked(
      g("circle", { scale: 0.3, ox: -0.28, oy: -0.2, fill: "solid" }),
      g("square", { scale: 0.3, ox: 0.28, oy: -0.2, fill: "hatched" }),
    );
    const AC = stacked(
      g("circle", { scale: 0.3, ox: -0.28, oy: -0.15, fill: "solid" }),
      g("triangle", { scale: 0.3, ox: 0.1, oy: 0.25, fill: "empty" }),
    );
    const BC = stacked(
      g("square", { scale: 0.3, ox: 0.25, oy: -0.2, fill: "hatched" }),
      g("triangle", { scale: 0.3, ox: -0.1, oy: 0.25, fill: "empty" }),
    );
    const ABC = stacked(
      g("circle", { scale: 0.28, ox: -0.3, oy: -0.25, fill: "solid" }),
      g("square", { scale: 0.28, ox: 0.3, oy: -0.25, fill: "hatched" }),
      g("triangle", { scale: 0.28, ox: 0, oy: 0.28, fill: "empty" }),
    );
    pushQ(qs, {
      id: 23,
      difficulty: 4,
      weight: 3.35,
      irtB: 1.55,
      categories: ["boolean", "pattern"],
      cells: matrix9([A, B, AB, C, A, AC, AB, BC, null]),
      correct: ABC,
      distractors: [
        distractor(AB, "partial_union"),
        distractor(AC, "partial_union"),
        distractor(BC, "partial_union"),
        distractor(A, "missing_rule"),
        distractor(C, "missing_rule"),
        distractor(
          stacked(
            g("circle", { scale: 0.28, ox: -0.3, oy: -0.25, fill: "solid" }),
            g("square", { scale: 0.28, ox: 0.3, oy: -0.25, fill: "hatched" }),
          ),
          "partial_union",
        ),
        distractor(
          stacked(
            g("circle", { scale: 0.28, ox: -0.3, oy: -0.25, fill: "empty" }),
            g("square", { scale: 0.28, ox: 0.3, oy: -0.25, fill: "hatched" }),
            g("triangle", { scale: 0.28, ox: 0, oy: 0.28, fill: "empty" }),
          ),
          "polarity_flip",
        ),
      ],
      seed: 223,
      explanation: {
        pt: "Coluna 3 une elementos das duas primeiras; ? = AB ∪ BC = A+B+C.",
        rules: ["Distribuição", "União de elementos"],
      },
    });
  }

  // Q24 — row+col: rot offset + fill (multi-rule)
  {
    const mk = (rot: number, fill: FillKind) =>
      cell(g("diamond", { rotation: rot, fill, scale: 0.65 }));
    const correct = mk(180, "solid");
    pushQ(qs, {
      id: 24,
      difficulty: 4,
      weight: 3.5,
      irtB: 1.65,
      categories: ["spatial", "pattern"],
      cells: matrix9([
        mk(0, "empty"),
        mk(45, "hatched"),
        mk(90, "solid"),
        mk(45, "empty"),
        mk(90, "hatched"),
        mk(135, "solid"),
        mk(90, "empty"),
        mk(135, "hatched"),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(180, "empty"), "fill_only"),
        distractor(mk(180, "hatched"), "incomplete_rotation"),
        distractor(mk(135, "solid"), "horizontal_only"),
        distractor(mk(225, "solid"), "incomplete_rotation"),
        distractor(mk(90, "solid"), "vertical_only"),
        distractor(mk(180, "dotted"), "polarity_flip"),
        distractor(mk(45, "solid"), "missing_rule"),
      ],
      seed: 224,
      explanation: {
        pt: "Por linha: +45° e fill progressivo; cada linha começa +45° à frente.",
        rules: ["Rotação + offset por linha", "Preenchimento"],
      },
    });
  }

  /* ═══════════════ BAND 5 — Extremo (high ceiling) ═══════════════ */

  // Q25 — stroke XOR
  {
    const r1a: Stroke[] = ["h", "v"];
    const r1b: Stroke[] = ["h", "d1"];
    const r2a: Stroke[] = ["d1", "d2"];
    const r2b: Stroke[] = ["v", "d2"];
    const r3a: Stroke[] = ["h", "d2"];
    const r3b: Stroke[] = ["h", "v", "d2"];
    const correct = stroke(xorStrokes(r3a, r3b)); // ["v"]
    pushQ(qs, {
      id: 25,
      difficulty: 5,
      weight: 3.9,
      irtB: 1.9,
      categories: ["boolean", "spatial"],
      cells: matrix9([
        stroke(r1a),
        stroke(r1b),
        stroke(xorStrokes(r1a, r1b)),
        stroke(r2a),
        stroke(r2b),
        stroke(xorStrokes(r2a, r2b)),
        stroke(r3a),
        stroke(r3b),
        null,
      ]),
      correct,
      distractors: [
        distractor(stroke(["h"]), "horizontal_only"),
        distractor(stroke(["v", "d2"]), "or_instead_of_xor"),
        distractor(stroke(["h", "v"]), "or_instead_of_xor"),
        distractor(stroke(["d1"]), "missing_rule"),
        distractor(stroke(["h", "v", "d2"]), "or_instead_of_xor"),
        distractor(stroke(["d2"]), "partial_union"),
        distractor(stroke(["v", "h", "d1"]), "extra_element"),
      ],
      seed: 225,
      explanation: {
        pt: "XOR de traços: comuns cancelam. Resta só a vertical.",
        rules: ["XOR de segmentos"],
      },
    });
  }

  // Q26 — four combined rules + satellites
  {
    const mk = (
      shape: ShapeKind,
      rot: number,
      fill: FillKind,
      dots: number,
    ): CellContent => {
      const glyphs: Glyph[] = [
        g(shape, { rotation: rot, fill, scale: 0.55 }),
      ];
      for (let i = 0; i < dots; i++) {
        const angle = (i / Math.max(dots, 1)) * Math.PI * 2 - Math.PI / 2;
        glyphs.push(
          g("dot", {
            fill: "solid",
            scale: 0.14,
            ox: Math.cos(angle) * 0.42,
            oy: Math.sin(angle) * 0.42,
          }),
        );
      }
      return { glyphs };
    };
    const shapes: ShapeKind[] = ["circle", "square", "triangle"];
    const fills: FillKind[] = ["empty", "hatched", "solid"];
    const at = (r: number, c: number) =>
      mk(shapes[(r + c) % 3], c * 90, fills[r], c + 1);
    const correct = at(2, 2);
    pushQ(qs, {
      id: 26,
      difficulty: 5,
      weight: 4.2,
      irtB: 2.05,
      categories: ["spatial", "pattern", "numerical"],
      cells: matrix9([
        at(0, 0),
        at(0, 1),
        at(0, 2),
        at(1, 0),
        at(1, 1),
        at(1, 2),
        at(2, 0),
        at(2, 1),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk("triangle", 180, "solid", 3), "shape_swap"),
        distractor(mk("square", 90, "solid", 3), "incomplete_rotation"),
        distractor(mk("circle", 180, "solid", 3), "horizontal_only"),
        distractor(mk("square", 180, "hatched", 3), "fill_only"),
        distractor(mk("square", 180, "solid", 2), "wrong_count"),
        distractor(mk("square", 180, "empty", 3), "polarity_flip"),
        distractor(mk("square", 180, "solid", 4), "extra_element"),
      ],
      seed: 226,
      explanation: {
        pt: "Forma (r+c) mod 3; rotação 0/90/180 por coluna; fill por linha; satélites = c+1.",
        rules: ["Forma modular", "Rotação", "Fill", "Contagem satélite"],
      },
    });
  }

  // Q27 — XOR + rotation combo (row XOR of strokes, col rotates result)
  {
    const base = (parts: Stroke[], rot: number): CellContent => {
      const glyphs: Glyph[] = [];
      for (const p of parts) {
        let ang = 0;
        if (p === "h") ang = 0;
        if (p === "v") ang = 90;
        if (p === "d1") ang = 45;
        if (p === "d2") ang = 135;
        glyphs.push(g("line", { rotation: ang + rot, scale: 0.8 }));
      }
      return { glyphs };
    };
    // Col3 = XOR(col1,col2) then rotated by row*45
    const rowXor = (
      a: Stroke[],
      b: Stroke[],
      rot: number,
    ): CellContent => base(xorStrokes(a, b), rot);
    const correct = rowXor(["h", "d1"], ["v", "d1"], 90); // h,v @ +90
    pushQ(qs, {
      id: 27,
      difficulty: 5,
      weight: 4.4,
      irtB: 2.2,
      categories: ["boolean", "spatial"],
      cells: matrix9([
        base(["h", "v"], 0),
        base(["h", "d1"], 0),
        rowXor(["h", "v"], ["h", "d1"], 0),
        base(["v", "d2"], 45),
        base(["h", "d2"], 45),
        rowXor(["v", "d2"], ["h", "d2"], 45),
        base(["h", "d1"], 90),
        base(["v", "d1"], 90),
        null,
      ]),
      correct,
      distractors: [
        distractor(rowXor(["h", "d1"], ["v", "d1"], 0), "incomplete_rotation"),
        distractor(rowXor(["h", "d1"], ["v", "d1"], 45), "incomplete_rotation"),
        distractor(base(["h", "v", "d1"], 90), "or_instead_of_xor"),
        distractor(base(["d1"], 90), "and_instead_of_xor"),
        distractor(base(["h", "d1"], 90), "horizontal_only"),
        distractor(base(["v", "d1"], 90), "vertical_only"),
        distractor(rowXor(["h", "d1"], ["v", "d1"], 135), "incomplete_rotation"),
      ],
      seed: 227,
      explanation: {
        pt: "XOR dos traços das duas primeiras colunas, depois rotação +0/+45/+90° por linha.",
        rules: ["XOR de traços", "Rotação por linha"],
      },
    });
  }

  // Q28 — fill/border inversion + rotation + count
  // at(2,2): n=3, rot=180, fill=solid (c even), border=true ((r+c) even)
  {
    const mk = (
      n: number,
      rot: number,
      fill: FillKind,
      border: boolean,
    ): CellContent => {
      const glyphs: Glyph[] = [];
      if (border) {
        glyphs.push(
          g("square", { scale: 0.85, fill: "empty", strokeWidth: 2.2 }),
        );
      }
      const inner = counted("circle", n, fill, rot);
      return { glyphs: [...glyphs, ...inner.glyphs] };
    };
    const at = (r: number, c: number) => {
      const fill: FillKind = c % 2 === 0 ? "solid" : "empty";
      return mk(r + 1, c * 90, fill, (r + c) % 2 === 0);
    };
    const correct = at(2, 2);
    pushQ(qs, {
      id: 28,
      difficulty: 5,
      weight: 4.6,
      irtB: 2.35,
      categories: ["spatial", "pattern", "numerical"],
      cells: matrix9([
        at(0, 0),
        at(0, 1),
        at(0, 2),
        at(1, 0),
        at(1, 1),
        at(1, 2),
        at(2, 0),
        at(2, 1),
        null,
      ]),
      correct,
      distractors: [
        distractor(mk(3, 180, "empty", true), "polarity_flip"),
        distractor(mk(3, 90, "solid", true), "incomplete_rotation"),
        distractor(mk(2, 180, "solid", true), "wrong_count"),
        distractor(mk(3, 180, "solid", false), "missing_rule"),
        distractor(mk(3, 0, "solid", true), "vertical_only"),
        distractor(mk(3, 180, "hatched", true), "fill_only"),
        distractor(mk(4, 180, "solid", true), "wrong_count"),
      ],
      seed: 228,
      explanation: {
        pt: "Contagem = linha+1; rotação 0/90/180; fill alterna sólido/vazio; borda presente quando (r+c) par.",
        rules: ["Contagem", "Rotação", "Inversão de fill", "Borda xadrez"],
      },
    });
  }

  // Q29 — dual axis: row transform XOR of fills, col = rotate+count
  {
    const shapes: ShapeKind[] = ["diamond", "triangle", "hexagon"];
    const mk = (
      shape: ShapeKind,
      rot: number,
      fill: FillKind,
      n: number,
    ): CellContent => {
      if (n <= 1) return cell(g(shape, { rotation: rot, fill, scale: 0.6 }));
      return counted(shape, n, fill, rot);
    };
    // col determines shape index and rotation; row determines count; fill = (r XOR c) style
    const at = (r: number, c: number) => {
      const fill: FillKind =
        (r ^ c) === 0 ? "solid" : (r ^ c) === 1 ? "hatched" : "empty";
      return mk(shapes[c], c * 60, fill, r + 1);
    };
    const correct = at(2, 2);
    pushQ(qs, {
      id: 29,
      difficulty: 5,
      weight: 4.8,
      irtB: 2.5,
      categories: ["boolean", "spatial", "numerical"],
      cells: matrix9([
        at(0, 0),
        at(0, 1),
        at(0, 2),
        at(1, 0),
        at(1, 1),
        at(1, 2),
        at(2, 0),
        at(2, 1),
        null,
      ]),
      correct,
      distractors: [
        distractor(at(2, 1), "incomplete_rotation"),
        // wrong_count: same shape/rot/fill as correct, count 4 (not at(1,2) which is empty/2)
        distractor(mk("hexagon", 120, "solid", 4), "wrong_count"),
        distractor(mk("hexagon", 120, "hatched", 3), "fill_only"),
        distractor(mk("hexagon", 120, "empty", 2), "wrong_count"),
        distractor(mk("triangle", 120, "solid", 3), "shape_swap"),
        distractor(mk("hexagon", 60, "solid", 3), "incomplete_rotation"),
        distractor(mk("hexagon", 120, "dotted", 3), "polarity_flip"),
      ],
      seed: 229,
      explanation: {
        pt: "Coluna→forma+rotação; linha→contagem; fill por XOR de índices de linha/coluna.",
        rules: ["Forma por coluna", "Contagem por linha", "XOR de fill"],
      },
    });
  }

  // Q30 — genius: XOR corners + border inversion + 90° spin of whole mask
  {
    // Represent mask, then rotate bits clockwise 90° for col progression,
    // and XOR with row seed; border fill flips when bit count odd
    const rotateMaskCW = (m: number): number => {
      // bits: 0=TL 1=TR 2=BL 3=BR → CW: TL→TR, TR→BR, BR→BL, BL→TL
      const tl = (m >> 0) & 1;
      const tr = (m >> 1) & 1;
      const bl = (m >> 2) & 1;
      const br = (m >> 3) & 1;
      return (bl << 0) | (tl << 1) | (br << 2) | (tr << 3);
    };
    const cellFrom = (mask: number, invert: boolean): CellContent => {
      const base = corners(mask);
      if (!invert) return base;
      // invert: add hollow square border + flip meaning — show missing corners as rings
      const invMask = (~mask) & 0b1111;
      return stacked(
        g("square", { scale: 0.88, fill: "empty", strokeWidth: 2 }),
        ...corners(invMask).glyphs,
      );
    };
    const at = (r: number, c: number) => {
      let m = [0b1000, 0b1100, 0b1110][r];
      for (let i = 0; i < c; i++) m = rotateMaskCW(m);
      const invert = (r + c) % 2 === 1;
      return cellFrom(m, invert);
    };
    const correct = at(2, 2);
    pushQ(qs, {
      id: 30,
      difficulty: 5,
      weight: 5.0,
      irtB: 2.65,
      categories: ["boolean", "spatial", "pattern"],
      cells: matrix9([
        at(0, 0),
        at(0, 1),
        at(0, 2),
        at(1, 0),
        at(1, 1),
        at(1, 2),
        at(2, 0),
        at(2, 1),
        null,
      ]),
      correct,
      distractors: [
        distractor(at(2, 1), "incomplete_rotation"),
        distractor(at(1, 2), "horizontal_only"),
        distractor(cellFrom(0b1110, false), "missing_rule"),
        distractor(cellFrom(0b0111, true), "polarity_flip"),
        // correct is rotate²(0b1110)=0b0111 without invert — avoid duplicating it
        distractor(cellFrom(rotateMaskCW(0b1110), false), "incomplete_rotation"),
        distractor(cellFrom(0b1010, true), "and_instead_of_xor"),
        distractor(at(0, 2), "vertical_only"),
      ],
      seed: 230,
      explanation: {
        pt: "Máscara de cantos gira 90° CW por coluna a partir da semente da linha; polaridade (borda+inversão) alterna em xadrez (r+c ímpar).",
        rules: ["Rotação de máscara", "XOR/inversão de borda", "Semente por linha"],
      },
    });
  }

  return qs;
}

let _cache: MatrixQuestion[] | null = null;

export function getMatrixQuestions(): MatrixQuestion[] {
  if (!_cache) _cache = buildQuestions();
  return _cache;
}

/** Validate bank integrity (unique correct, option counts, cell[8]=null) */
export function validateQuestionBank(qs = getMatrixQuestions()): string[] {
  const errors: string[] = [];
  if (qs.length !== 30) errors.push(`Expected 30 items, got ${qs.length}`);
  const ids = new Set<number>();
  for (const q of qs) {
    if (ids.has(q.id)) errors.push(`Duplicate id ${q.id}`);
    ids.add(q.id);
    if (q.cells[8] !== null) errors.push(`Q${q.id}: cell[8] not null`);
    const expect = q.difficulty >= 3 ? 8 : 6;
    if (q.options.length !== expect) {
      errors.push(`Q${q.id}: expected ${expect} options, got ${q.options.length}`);
    }
    if (
      q.correctIndex < 0 ||
      q.correctIndex >= q.options.length ||
      q.distractorErrors[q.correctIndex] !== null
    ) {
      errors.push(`Q${q.id}: invalid correctIndex/distractor mapping`);
    }
    const sigs = q.options.map(cellSignature);
    if (new Set(sigs).size !== sigs.length) {
      errors.push(`Q${q.id}: duplicate option signatures`);
    }
    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex) continue;
      if (!q.distractorErrors[i]) {
        errors.push(`Q${q.id}: option ${i} missing distractor error`);
      }
    }
  }
  return errors;
}

/** Mini example for onboarding (not scored) */
export function getTutorialExample(): {
  cells: (CellContent | null)[];
  options: CellContent[];
  correctIndex: number;
  explanation: string;
} {
  const correct = counted("circle", 3);
  const { options, correctIndex } = packOptions(
    correct,
    [
      distractor(counted("circle", 2), "wrong_count"),
      distractor(counted("circle", 4), "wrong_count"),
      distractor(counted("square", 3), "shape_swap"),
      distractor(counted("circle", 1), "wrong_count"),
      distractor(counted("triangle", 3), "shape_swap"),
    ],
    1,
    6,
  );
  return {
    cells: matrix9([
      counted("circle", 1),
      counted("circle", 2),
      counted("circle", 3),
      counted("circle", 1),
      counted("circle", 2),
      counted("circle", 3),
      counted("circle", 1),
      counted("circle", 2),
      null,
    ]),
    options,
    correctIndex,
    explanation:
      "Exemplo: a contagem sobe 1 → 2 → 3. A célula ? deve ter 3 círculos.",
  };
}
