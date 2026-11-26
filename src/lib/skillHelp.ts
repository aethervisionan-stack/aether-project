import type { CompetenceScores } from "@/src/types/quiz";

/**
 * Short PT-BR gloss for the standardized IQ scale (mean 100, SD 15).
 * Shown next to Escala / μ 100 · σ 15 chips via SkillHelpTip.
 */
export const ESCALA_HELP =
  "Escala padronizada de QI: média 100 e desvio padrão 15. O percentil indica a % de pessoas com pontuação igual ou inferior à sua.";

/** Short PT-BR glosses for each sub-skill shown on results. */
export const COMPETENCE_HELP: Record<keyof CompetenceScores, string> = {
  spatial:
    "Capacidade de imaginar e girar formas no espaço mentalmente, sem mover o objeto de verdade.",
  boolean:
    "Aplicar regras lógicas do tipo E / OU / XOR sobre elementos visuais para chegar à resposta certa.",
  pattern:
    "Detectar a regra que se repete ou muda numa série de figuras e prever o próximo passo.",
  numerical:
    "Ler progressões e quantidades embutidas em figuras (contagens, escalas, ritmos numéricos).",
  logical:
    "Encadear premissas e tirar conclusões válidas — o que necessariamente segue do que foi dito.",
  numeric:
    "Completar sequências de números reconhecendo a operação ou o padrão entre os termos.",
  verbal:
    "Relacionar palavras por significado, analogia ou categoria semântica.",
  analytical:
    "Decompor um problema em partes, comparar alternativas e escolher a solução mais coerente.",
};

export function competenceHelp(key: keyof CompetenceScores): string {
  return COMPETENCE_HELP[key];
}
