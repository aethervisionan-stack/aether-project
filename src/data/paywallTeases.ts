import type { ArchetypeId } from "./archetypes";

/** Provocative PT-BR teases for paywall preview — never name the archetype. */
export const PAYWALL_TEASES: Record<ArchetypeId, string> = {
  inocente:
    "Há uma fé quieta por trás dessa carta — e também um ponto cego que só o dossiê ousa nomear.",
  explorador:
    "Essa carta cheira a estrada sem mapa. O diagnóstico revela o preço da liberdade que você cobra de si.",
  sabio:
    "A carta brilha com perguntas demais. O espelho completo mostra onde a clareza vira armadura.",
  heroi:
    "Há um brasão de combate neste retrato. O dossiê aponta a batalha que você escolheu… e a que evita.",
  rebelde:
    "Chamas sob o verniz. Só o diagnóstico completo diz o que você derruba — e o que ainda te prende.",
  mago:
    "Símbolos se movem nesta carta. O relatório revela a transformação que você inicia… e a que teme concluir.",
  pessoa_comum:
    "Simplicidade aparente. O dossiê mostra o poder silencioso — e o limiar que você hesita cruzar.",
  amante:
    "Há calor e risco neste retrato. O diagnóstico nomeia o vínculo que te eleva e o que te dissolve.",
  bobo_da_corte:
    "Sorriso na superfície, lâmina na sombra. O espelho completo ri por último — e aponta o custo da máscara.",
  cuidador:
    "A carta carrega o peso do outro. O dossiê revela até onde você se doa… e onde se esquece.",
  criador:
    "Há um mundo a nascer nesta imagem. O diagnóstico mostra a obra — e o perfeccionismo que a adia.",
  governante:
    "Ordem e trono pairam nesta carta. O relatório completo revela o reino que você ergue… e o que controla demais.",
};

export function paywallTeaseFor(id: ArchetypeId): string {
  return (
    PAYWALL_TEASES[id] ??
    "Sua carta já surgiu das brumas. O nome e o dossiê completo aguardam atrás do véu."
  );
}
