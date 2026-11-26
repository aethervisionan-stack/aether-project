import type {
  CellContent,
  FillKind,
  Glyph,
  MatrixQuestion,
  ShapeKind,
} from "@/src/types/quiz";

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
  // 5+
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

function rotated(shape: ShapeKind, deg: number, fill: FillKind = "empty"): CellContent {
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
        `${x.shape}:${x.fill ?? "empty"}:${x.rotation ?? 0}:${x.scale ?? 1}:${x.ox ?? 0}:${x.oy ?? 0}`,
    )
    .join("|");
}

/** Deterministic shuffle; returns 6 options and the index of the correct one */
function packOptions(
  correct: CellContent,
  distractors: CellContent[],
  seed: number,
): { options: CellContent[]; correctIndex: number } {
  const pool = [cloneCell(correct), ...distractors.slice(0, 5).map(cloneCell)];
  while (pool.length < 6) pool.push(cell(g("cross", { scale: 0.4 })));

  let s = seed | 0;
  for (let i = 5; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const target = cellSignature(correct);
  const correctIndex = Math.max(
    0,
    pool.findIndex((c) => cellSignature(c) === target),
  );
  return { options: pool, correctIndex };
}

function matrix9(
  cells: (CellContent | null)[],
): (CellContent | null)[] {
  const out = cells.slice(0, 9);
  while (out.length < 9) out.push(cell());
  out[8] = null; // always the "?"
  return out;
}

/* ─── Question bank (25 progressive) ──────────────────────────────── */

function buildQuestions(): MatrixQuestion[] {
  const qs: MatrixQuestion[] = [];

  // Q1 — Very easy: count +1 across rows (circles)
  {
    const correct = counted("circle", 3);
    const { options, correctIndex } = packOptions(
      correct,
      [
        counted("circle", 2),
        counted("circle", 4),
        counted("square", 3),
        counted("circle", 1),
        counted("triangle", 3),
      ],
      101,
    );
    qs.push({
      id: 1,
      difficulty: 1,
      weight: 1,
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
      options,
      correctIndex,
      explanation: {
        pt: "Em cada linha, o número de círculos aumenta em +1 da esquerda para a direita (1 → 2 → 3).",
        rules: ["Progressão aritmética de contagem"],
      },
    });
  }

  // Q2 — Shape alternation row-wise
  {
    const correct = cell(g("triangle", { fill: "empty", scale: 0.7 }));
    const { options, correctIndex } = packOptions(
      correct,
      [
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.7 })),
        cell(g("hexagon", { scale: 0.7 })),
        cell(g("triangle", { fill: "solid", scale: 0.7 })),
        cell(g("diamond", { scale: 0.7 })),
      ],
      102,
    );
    qs.push({
      id: 2,
      difficulty: 1,
      weight: 1,
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
      options,
      correctIndex,
      explanation: {
        pt: "Cada linha repete o padrão círculo → quadrado → triângulo.",
        rules: ["Alternância de formas"],
      },
    });
  }

  // Q3 — Fill progression empty → hatched → solid
  {
    const correct = cell(g("square", { fill: "solid", scale: 0.7 }));
    const { options, correctIndex } = packOptions(
      correct,
      [
        cell(g("square", { fill: "empty", scale: 0.7 })),
        cell(g("square", { fill: "hatched", scale: 0.7 })),
        cell(g("circle", { fill: "solid", scale: 0.7 })),
        cell(g("square", { fill: "dotted", scale: 0.7 })),
        cell(g("triangle", { fill: "solid", scale: 0.7 })),
      ],
      103,
    );
    qs.push({
      id: 3,
      difficulty: 2,
      weight: 1.2,
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
      options,
      correctIndex,
      explanation: {
        pt: "O preenchimento avança: vazio → hachurado → sólido em cada linha.",
        rules: ["Progressão de preenchimento"],
      },
    });
  }

  // Q4 — 90° rotation of triangle across columns
  {
    const correct = rotated("triangle", 180);
    const { options, correctIndex } = packOptions(
      correct,
      [
        rotated("triangle", 0),
        rotated("triangle", 90),
        rotated("triangle", 270),
        rotated("triangle", 45),
        rotated("square", 180),
      ],
      104,
    );
    qs.push({
      id: 4,
      difficulty: 2,
      weight: 1.3,
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
      options,
      correctIndex,
      explanation: {
        pt: "Em cada linha o triângulo gira +90° a cada coluna (0° → 90° → 180°).",
        rules: ["Rotação angular 90°"],
      },
    });
  }

  // Q5 — Count decreases 4→3→2
  {
    const correct = counted("dot", 2, "solid");
    const { options, correctIndex } = packOptions(
      correct,
      [
        counted("dot", 1, "solid"),
        counted("dot", 3, "solid"),
        counted("dot", 4, "solid"),
        counted("circle", 2, "solid"),
        counted("dot", 2, "empty"),
      ],
      105,
    );
    qs.push({
      id: 5,
      difficulty: 2,
      weight: 1.3,
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
      options,
      correctIndex,
      explanation: {
        pt: "A contagem decresce em −1 por coluna (4 → 3 → 2).",
        rules: ["Progressão aritmética decrescente"],
      },
    });
  }

  // Q6 — Shape + fill combined
  {
    const shapes: ShapeKind[] = ["circle", "square", "triangle"];
    const fills: FillKind[] = ["empty", "hatched", "solid"];
    const mk = (si: number, fi: number) =>
      cell(g(shapes[si], { fill: fills[fi], scale: 0.68 }));
    const correct = mk(2, 2);
    const { options, correctIndex } = packOptions(
      correct,
      [mk(2, 0), mk(2, 1), mk(0, 2), mk(1, 2), mk(1, 1)],
      106,
    );
    qs.push({
      id: 6,
      difficulty: 3,
      weight: 1.5,
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
      options,
      correctIndex,
      explanation: {
        pt: "Forma e preenchimento avançam juntos: círculo vazio → quadrado hachurado → triângulo sólido.",
        rules: ["Alternância de forma + preenchimento"],
      },
    });
  }

  // Q7 — 45° rotation of line/diamond
  {
    const correct = rotated("diamond", 90);
    const { options, correctIndex } = packOptions(
      correct,
      [
        rotated("diamond", 0),
        rotated("diamond", 45),
        rotated("diamond", 135),
        rotated("square", 90),
        rotated("diamond", 180),
      ],
      107,
    );
    qs.push({
      id: 7,
      difficulty: 3,
      weight: 1.5,
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
      options,
      correctIndex,
      explanation: {
        pt: "O losango gira +45° a cada coluna (0° → 45° → 90°).",
        rules: ["Rotação angular 45°"],
      },
    });
  }

  // Q8 — Simple XOR: overlapping identical strokes cancel
  // Represent as: left glyph XOR right glyph → result
  // Row: circle | square | both (circle+square)
  // Actually for XOR of presence: if same shape in both → empty; if different → both
  // Simpler Raven-style: column3 = overlay of col1 and col2 with cancel on match
  {
    const both = stacked(
      g("circle", { scale: 0.7, fill: "empty" }),
      g("square", { scale: 0.45, fill: "empty" }),
    );
    const correct = both;
    const { options, correctIndex } = packOptions(
      correct,
      [
        cell(g("circle", { scale: 0.7 })),
        cell(g("square", { scale: 0.7 })),
        cell(g("triangle", { scale: 0.7 })),
        stacked(
          g("circle", { scale: 0.7 }),
          g("triangle", { scale: 0.45 }),
        ),
        cell(g("hexagon", { scale: 0.7 })),
      ],
      108,
    );
    qs.push({
      id: 8,
      difficulty: 3,
      weight: 1.6,
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
      options,
      correctIndex,
      explanation: {
        pt: "A terceira coluna une (OR) as duas primeiras: círculo + quadrado sobrepostos.",
        rules: ["Operação booleana OR / união"],
      },
    });
  }

  // Q9 — Count per row increases + shape changes by column
  {
    const mk = (shape: ShapeKind, n: number) => counted(shape, n, "empty");
    const correct = mk("hexagon", 3);
    const { options, correctIndex } = packOptions(
      correct,
      [
        mk("hexagon", 2),
        mk("hexagon", 4),
        mk("triangle", 3),
        mk("circle", 3),
        mk("square", 3),
      ],
      109,
    );
    qs.push({
      id: 9,
      difficulty: 4,
      weight: 1.8,
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
      options,
      correctIndex,
      explanation: {
        pt: "Colunas fixam a forma (círculo, quadrado, hexágono); linhas aumentam a contagem (1, 2, 3).",
        rules: ["Progressão numérica + alternância de forma"],
      },
    });
  }

  // Q10 — 180° flip of asymmetric arc/triangle pair
  {
    const upright = stacked(
      g("triangle", { scale: 0.5, oy: -0.15, fill: "solid" }),
      g("line", { scale: 0.8, oy: 0.35, rotation: 0 }),
    );
    const flipped = stacked(
      g("triangle", { scale: 0.5, oy: 0.15, fill: "solid", rotation: 180 }),
      g("line", { scale: 0.8, oy: -0.35, rotation: 0 }),
    );
    const correct = flipped;
    const { options, correctIndex } = packOptions(
      correct,
      [
        upright,
        stacked(
          g("triangle", { scale: 0.5, oy: -0.15, fill: "empty" }),
          g("line", { scale: 0.8, oy: 0.35 }),
        ),
        rotated("triangle", 180, "solid"),
        cell(g("triangle", { scale: 0.7, fill: "solid", rotation: 90 })),
        stacked(
          g("triangle", { scale: 0.5, oy: 0.15, fill: "hatched", rotation: 180 }),
          g("line", { scale: 0.8, oy: -0.35 }),
        ),
      ],
      110,
    );
    qs.push({
      id: 10,
      difficulty: 4,
      weight: 1.8,
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
      options,
      correctIndex,
      explanation: {
        pt: "As células alternam entre a figura e sua rotação de 180° (padrão xadrez).",
        rules: ["Rotação 180° / reflexão pontual"],
      },
    });
  }

  // Q11 — AND: only shared elements remain
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
    const correct = onlyCirc;
    const { options, correctIndex } = packOptions(
      correct,
      [
        circSq,
        circTri,
        cell(g("square", { scale: 0.55 })),
        cell(g("triangle", { scale: 0.55 })),
        stacked(g("square", { scale: 0.5 }), g("triangle", { scale: 0.4 })),
      ],
      111,
    );
    qs.push({
      id: 11,
      difficulty: 5,
      weight: 2,
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
      options,
      correctIndex,
      explanation: {
        pt: "A terceira coluna é a interseção (AND): permanece só o que as duas primeiras compartilham — o círculo.",
        rules: ["Operação booleana AND"],
      },
    });
  }

  // Q12 — Dual rule: rotate 90° AND fill advances
  {
    const mk = (rot: number, fill: FillKind) =>
      cell(g("triangle", { rotation: rot, fill, scale: 0.65 }));
    const correct = mk(180, "solid");
    const { options, correctIndex } = packOptions(
      correct,
      [
        mk(180, "empty"),
        mk(180, "hatched"),
        mk(90, "solid"),
        mk(270, "solid"),
        mk(0, "solid"),
      ],
      112,
    );
    qs.push({
      id: 12,
      difficulty: 5,
      weight: 2,
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
      options,
      correctIndex,
      explanation: {
        pt: "Duas regras: rotação +90° e preenchimento vazio → hachurado → sólido.",
        rules: ["Rotação 90°", "Progressão de preenchimento"],
      },
    });
  }

  // Q13 — XOR classic: shared cancel
  {
    const a = stacked(
      g("circle", { scale: 0.7 }),
      g("cross", { scale: 0.55 }),
    );
    const b = stacked(
      g("circle", { scale: 0.7 }),
      g("square", { scale: 0.4 }),
    );
    // XOR: cross + square (circle cancels)
    const correct = stacked(
      g("cross", { scale: 0.55 }),
      g("square", { scale: 0.4 }),
    );
    const { options, correctIndex } = packOptions(
      correct,
      [
        a,
        b,
        cell(g("circle", { scale: 0.7 })),
        stacked(g("circle", { scale: 0.7 }), g("cross", { scale: 0.55 }), g("square", { scale: 0.35 })),
        cell(g("cross", { scale: 0.6 })),
      ],
      113,
    );
    qs.push({
      id: 13,
      difficulty: 5,
      weight: 2.2,
      categories: ["boolean"],
      cells: matrix9([
        a,
        b,
        correct,
        a,
        b,
        correct,
        a,
        b,
        null,
      ]),
      options,
      correctIndex,
      explanation: {
        pt: "XOR: traços iguais nas duas primeiras células se cancelam. O círculo comum desaparece; restam cruz e quadrado.",
        rules: ["Operação booleana XOR"],
      },
    });
  }

  // Q14 — Count on diagonal logic / row sum constant
  {
    // Each row sums to 6
    const correct = counted("circle", 1);
    const { options, correctIndex } = packOptions(
      correct,
      [
        counted("circle", 2),
        counted("circle", 3),
        counted("circle", 4),
        counted("square", 1),
        counted("circle", 0),
      ],
      114,
    );
    qs.push({
      id: 14,
      difficulty: 6,
      weight: 2.3,
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
      options,
      correctIndex,
      explanation: {
        pt: "Em cada linha a soma das quantidades é 6 (1+2+3, 2+3+1, 3+2+1).",
        rules: ["Progressão / soma constante"],
      },
    });
  }

  // Q15 — Hexagon rotation 60°-ish via 45/90 steps + size
  {
    const mk = (rot: number, scale: number) =>
      cell(g("hexagon", { rotation: rot, scale, fill: "empty" }));
    const correct = mk(90, 0.45);
    const { options, correctIndex } = packOptions(
      correct,
      [
        mk(90, 0.7),
        mk(45, 0.45),
        mk(0, 0.45),
        mk(135, 0.45),
        mk(90, 0.55),
      ],
      115,
    );
    qs.push({
      id: 15,
      difficulty: 6,
      weight: 2.4,
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
      options,
      correctIndex,
      explanation: {
        pt: "O hexágono gira +45° e reduz de escala a cada coluna.",
        rules: ["Rotação 45°", "Escala progressiva"],
      },
    });
  }

  // Q16 — Shape cycle with XOR-ish cancel of fill
  {
    const mk = (shape: ShapeKind, fill: FillKind) =>
      cell(g(shape, { fill, scale: 0.65 }));
    // Rows: shapes cycle C-S-T; fill: empty XOR hatched = solid metaphor — actually:
    // Column rule: third fill is solid when first two differ
    const correct = mk("triangle", "solid");
    const { options, correctIndex } = packOptions(
      correct,
      [
        mk("triangle", "empty"),
        mk("triangle", "hatched"),
        mk("circle", "solid"),
        mk("square", "solid"),
        mk("hexagon", "solid"),
      ],
      116,
    );
    qs.push({
      id: 16,
      difficulty: 6,
      weight: 2.5,
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
      options,
      correctIndex,
      explanation: {
        pt: "Formas ciclam (C→Q→T). Preenchimentos diferentes nas duas primeiras colunas produzem sólido na terceira (regra tipo XOR de textura).",
        rules: ["Ciclo de formas", "XOR de preenchimento"],
      },
    });
  }

  // Q17 — Nested shapes count + rotation
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
    const { options, correctIndex } = packOptions(
      correct,
      [mk(3, 0), mk(2, 45), mk(3, 90), mk(4, 45), mk(3, 30)],
      117,
    );
    qs.push({
      id: 17,
      difficulty: 7,
      weight: 2.7,
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
      options,
      correctIndex,
      explanation: {
        pt: "Colunas aumentam o número de quadrados aninhados (1, 2, 3). Linhas aumentam a rotação (0° → 22° → 45°).",
        rules: ["Contagem aninhada", "Rotação progressiva"],
      },
    });
  }

  // Q18 — Boolean OR of positions (dots in corners)
  {
    const corners = (mask: number): CellContent => {
      // bits: TL TR BL BR
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
    };
    // Row: 0b0011 | 0b0101 = 0b0111
    const correct = corners(0b0111);
    const { options, correctIndex } = packOptions(
      correct,
      [
        corners(0b0011),
        corners(0b0101),
        corners(0b1111),
        corners(0b0110),
        corners(0b0001),
      ],
      118,
    );
    qs.push({
      id: 18,
      difficulty: 7,
      weight: 2.8,
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
      options,
      correctIndex,
      explanation: {
        pt: "A terceira célula é a união (OR) das posições dos pontos das duas primeiras.",
        rules: ["OR espacial de posições"],
      },
    });
  }

  // Q19 — Complex: shape by row, rotation by col, fill by diagonal
  {
    const shapes: ShapeKind[] = ["circle", "square", "triangle"];
    const mk = (r: number, c: number) => {
      const fill: FillKind =
        (r + c) % 3 === 0 ? "empty" : (r + c) % 3 === 1 ? "hatched" : "solid";
      return cell(
        g(shapes[r], {
          fill,
          rotation: c * 45,
          scale: 0.62,
        }),
      );
    };
    const correct = mk(2, 2);
    const { options, correctIndex } = packOptions(
      correct,
      [
        mk(2, 1),
        mk(1, 2),
        cell(g("triangle", { fill: "solid", rotation: 90, scale: 0.62 })),
        cell(g("triangle", { fill: "hatched", rotation: 90, scale: 0.62 })),
        cell(g("hexagon", { fill: "solid", rotation: 90, scale: 0.62 })),
      ],
      119,
    );
    qs.push({
      id: 19,
      difficulty: 7,
      weight: 3,
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
      options,
      correctIndex,
      explanation: {
        pt: "Linha define a forma; coluna define a rotação (0°/45°/90°); r+c define o preenchimento.",
        rules: ["Forma por linha", "Rotação por coluna", "Preenchimento por diagonal"],
      },
    });
  }

  // Q20 — XOR of corner dots (harder)
  {
    const corners = (mask: number): CellContent => {
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
    };
    // 0b1100 XOR 0b1010 = 0b0110
    const correct = corners(0b0110);
    const { options, correctIndex } = packOptions(
      correct,
      [
        corners(0b1110),
        corners(0b1000),
        corners(0b0011),
        corners(0b1111),
        corners(0b0101),
      ],
      120,
    );
    qs.push({
      id: 20,
      difficulty: 8,
      weight: 3.2,
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
      options,
      correctIndex,
      explanation: {
        pt: "Terceira célula = XOR das posições: pontos presentes em exatamente uma das duas primeiras células.",
        rules: ["XOR espacial"],
      },
    });
  }

  // Q21 — Triple rule Mensa-ish
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
    const { options, correctIndex } = packOptions(
      correct,
      [
        mk("hexagon", 3, 90, "hatched"),
        mk("hexagon", 2, 90, "solid"),
        mk("hexagon", 3, 45, "solid"),
        mk("triangle", 3, 90, "solid"),
        mk("hexagon", 3, 0, "solid"),
      ],
      121,
    );
    qs.push({
      id: 21,
      difficulty: 8,
      weight: 3.4,
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
      options,
      correctIndex,
      explanation: {
        pt: "Três regras alinhadas: forma (C→Q→H), contagem (1→2→3), rotação (0→45→90) e preenchimento (vazio→hachurado→sólido).",
        rules: ["Forma", "Contagem", "Rotação", "Preenchimento"],
      },
    });
  }

  // Q22 — Element union across columns
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
    const { options, correctIndex } = packOptions(
      ABC,
      [AB, AC, BC, A, C],
      122,
    );
    qs.push({
      id: 22,
      difficulty: 8,
      weight: 3.5,
      categories: ["boolean", "pattern"],
      cells: matrix9([A, B, AB, C, A, AC, AB, BC, null]),
      options,
      correctIndex,
      explanation: {
        pt: "A terceira coluna une os elementos das duas primeiras (AB = A∪B, AC = A∪C, ? = AB∪BC = A+B+C).",
        rules: ["Distribuição / união de elementos"],
      },
    });
  }

  // Q23 — Rotation + fill with row offset
  {
    const mk = (rot: number, fill: FillKind) =>
      cell(g("diamond", { rotation: rot, fill, scale: 0.65 }));
    const correctCell = mk(180, "solid");
    const { options, correctIndex } = packOptions(
      correctCell,
      [
        mk(180, "empty"),
        mk(180, "hatched"),
        mk(135, "solid"),
        mk(225, "solid"),
        mk(90, "solid"),
      ],
      123,
    );
    qs.push({
      id: 23,
      difficulty: 9,
      weight: 3.8,
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
      options,
      correctIndex,
      explanation: {
        pt: "Por linha: rotação +45° por coluna e preenchimento vazio → hachurado → sólido. Cada linha seguinte começa +45° à frente.",
        rules: ["Rotação 45°", "Preenchimento", "Deslocamento por linha"],
      },
    });
  }

  // Q24 — Hard XOR + count
  {
    const stroke = (
      parts: Array<"h" | "v" | "d1" | "d2">,
    ): CellContent => {
      const glyphs: Glyph[] = [];
      for (const p of parts) {
        if (p === "h") glyphs.push(g("line", { rotation: 0, scale: 0.85 }));
        if (p === "v") glyphs.push(g("line", { rotation: 90, scale: 0.85 }));
        if (p === "d1") glyphs.push(g("line", { rotation: 45, scale: 0.85 }));
        if (p === "d2") glyphs.push(g("line", { rotation: 135, scale: 0.85 }));
      }
      return { glyphs };
    };
    // XOR of stroke sets
    const xorParts = (
      a: Array<"h" | "v" | "d1" | "d2">,
      b: Array<"h" | "v" | "d1" | "d2">,
    ) => {
      const set = new Set(a);
      for (const x of b) {
        if (set.has(x)) set.delete(x);
        else set.add(x);
      }
      return stroke([...set]);
    };
    const r1a: Array<"h" | "v" | "d1" | "d2"> = ["h", "v"];
    const r1b: Array<"h" | "v" | "d1" | "d2"> = ["h", "d1"];
    const r1c = xorParts(r1a, r1b); // v, d1
    const r2a: Array<"h" | "v" | "d1" | "d2"> = ["d1", "d2"];
    const r2b: Array<"h" | "v" | "d1" | "d2"> = ["v", "d2"];
    const r2c = xorParts(r2a, r2b); // d1, v
    const r3a: Array<"h" | "v" | "d1" | "d2"> = ["h", "d2"];
    const r3b: Array<"h" | "v" | "d1" | "d2"> = ["h", "v", "d2"];
    const correct = xorParts(r3a, r3b); // v
    const { options, correctIndex } = packOptions(
      correct,
      [
        stroke(["h"]),
        stroke(["v", "d2"]),
        stroke(["h", "v"]),
        stroke(["d1"]),
        stroke(["h", "v", "d2"]),
      ],
      124,
    );
    qs.push({
      id: 24,
      difficulty: 9,
      weight: 4,
      categories: ["boolean", "spatial"],
      cells: matrix9([
        stroke(r1a),
        stroke(r1b),
        r1c,
        stroke(r2a),
        stroke(r2b),
        r2c,
        stroke(r3a),
        stroke(r3b),
        null,
      ]),
      options,
      correctIndex,
      explanation: {
        pt: "Cada traço presente nas duas primeiras células se cancela (XOR). Resta apenas a vertical.",
        rules: ["XOR de traços", "Rotação de segmentos"],
      },
    });
  }

  // Q25 — Genius: four combined rules
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
    // Row r, col c:
    // shape: (r+c) % 3 → circle, square, triangle
    // rot: c * 90
    // fill: r → empty, hatched, solid
    // dots: (c + 1)
    const shapes: ShapeKind[] = ["circle", "square", "triangle"];
    const fills: FillKind[] = ["empty", "hatched", "solid"];
    const at = (r: number, c: number) =>
      mk(shapes[(r + c) % 3], c * 90, fills[r], c + 1);
    const correct = at(2, 2);
    const { options, correctIndex } = packOptions(
      correct,
      [
        mk("triangle", 180, "solid", 3),
        mk("triangle", 90, "solid", 3),
        mk("circle", 180, "solid", 3),
        mk("triangle", 180, "hatched", 3),
        mk("triangle", 180, "solid", 2),
      ],
      125,
    );
    qs.push({
      id: 25,
      difficulty: 10,
      weight: 4.5,
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
      options,
      correctIndex,
      explanation: {
        pt: "Quatro regras: forma por (linha+coluna) mod 3; rotação 0°/90°/180° por coluna; preenchimento por linha; número de pontos satélite = coluna+1.",
        rules: [
          "Forma modular",
          "Rotação 90°",
          "Preenchimento por linha",
          "Contagem de satélites",
        ],
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
      counted("circle", 2),
      counted("circle", 4),
      counted("square", 3),
      counted("circle", 1),
      counted("triangle", 3),
    ],
    1,
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
