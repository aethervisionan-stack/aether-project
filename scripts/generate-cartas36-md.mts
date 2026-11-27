import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  CARTAS_36,
  MAPA_ARQUETIPO_ORDER,
  TOTAL_CARTAS_36,
  SITUACOES_POR_ARQUETIPO,
} from "../src/data/cartas36.ts";
import { ARCHETYPES } from "../src/data/archetypes.ts";

const lines: string[] = [];
lines.push("# Cartas 36 — 12 Arquétipos × 3 Situações");
lines.push("");
lines.push(
  "**Fonte do mapa:** `internal/mapa-36-cartas-arquetipos.md` (pedido do usuário).",
);
lines.push("**Módulo de código:** `src/data/cartas36.ts`");
lines.push(
  "**Produto:** quiz medieval de arquétipos — prévia bloqueada **nunca** nomeia o arquétipo; InfinitePay / bloqueio do resultado **inalterados**.",
);
lines.push(
  "**UI:** módulo aditivo tipado; **sem rewire** do fluxo atual (12 arquétipos / paywall existente).",
);
lines.push("");
lines.push("## Distribuição 12 × 3");
lines.push("");
lines.push("| # | Arquétipo | Cartas | Situações |");
lines.push("|---|-----------|--------|-----------|");

let n = 1;
let idx = 1;
for (const id of MAPA_ARQUETIPO_ORDER) {
  const title = ARCHETYPES[id].title;
  const a = String(n).padStart(2, "0");
  const b = String(n + 2).padStart(2, "0");
  lines.push(
    `| ${idx} | ${title} (\`${id}\`) | ${a}–${b} | 1 · 2 · 3 |`,
  );
  n += 3;
  idx += 1;
}

lines.push("");
lines.push(
  `Total: **${TOTAL_CARTAS_36}** cartas · **${SITUACOES_POR_ARQUETIPO}** por arquétipo · ordem do mapa (não a \`ARCHETYPE_ORDER\` do quiz).`,
);
lines.push("");
lines.push("---");
lines.push("");

for (const carta of CARTAS_36) {
  lines.push(`## Carta ${carta.id} — ${carta.tituloMedieval}`);
  lines.push("");
  lines.push(`- **Identificador:** ${carta.id} (nº ${carta.numero})`);
  lines.push(
    `- **Arquétipo base:** ${carta.archetypeTitle} (\`${carta.archetypeId}\`) — referência interna / pós-desbloqueio`,
  );
  lines.push(
    `- **Situação:** ${carta.situacao}/3 — *${carta.situacaoLabel}*`,
  );
  lines.push(`- **Título / Nome medieval:** ${carta.tituloMedieval}`);
  lines.push("");
  lines.push("### Leitura da Cena");
  lines.push(carta.leituraCena);
  lines.push("");
  lines.push("### Ponto Forte");
  lines.push(carta.pontoForte);
  lines.push("");
  lines.push("### Provocação Pré-Desbloqueio");
  lines.push("*(nunca revela o nome do arquétipo)*");
  lines.push("");
  lines.push(`> ${carta.provocacaoPreDesbloqueio}`);
  lines.push("");
  lines.push("### Direção Visual");
  lines.push(carta.direcaoVisual);
  lines.push("");
  lines.push("### Prompt de Imagem");
  lines.push("");
  lines.push("```");
  lines.push(carta.promptImagem);
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
}

lines.push("## Integração técnica");
lines.push("");
lines.push(
  "- Import: `import { CARTAS_36, cartaById, cartasForArchetype, provocacaoCarta } from \"@/src/data/cartas36\"`",
);
lines.push(
  "- Helpers: `cartaByNumero`, `cartaForSituacao`, `provocacaoPadraoDoArquétipo`, `MAPA_ARQUETIPO_ORDER`",
);
lines.push(
  "- Paywall atual continua em `src/data/paywallTeases.ts` — este banco é paralelo e tipado.",
);
lines.push("- Não altera rotas, InfinitePay, nem telas de resultado.");
lines.push("");

const md = lines.join("\n");
const repoPath = "CARTAS_36_ARQUETIPOS.md";
writeFileSync(repoPath, md, "utf8");
const deskPath =
  "C:/Users/Next/Desktop/projeto quiz medieval/editado/CARTAS_36_ARQUETIPOS.md";
mkdirSync(dirname(deskPath), { recursive: true });
writeFileSync(deskPath, md, "utf8");
console.log(`Wrote ${repoPath} and ${deskPath} (${md.length} chars)`);
