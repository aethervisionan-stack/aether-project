import type { ArchetypeId } from "./archetypes";

/**
 * Banco 12 arquétipos × 3 situações = 36 cartas medievais.
 * Numeração 01–36 na ordem do mapa-fonte (não na ARCHETYPE_ORDER do quiz).
 * Provocações de prévia nunca nomeiam o arquétipo.
 * Não altera InfinitePay / fluxo de desbloqueio — módulo aditivo.
 */

export type SituacaoIndex = 1 | 2 | 3;

export type Carta36Id =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24"
  | "25"
  | "26"
  | "27"
  | "28"
  | "29"
  | "30"
  | "31"
  | "32"
  | "33"
  | "34"
  | "35"
  | "36";

export type Carta36 = {
  /** Identificador zero-padded "01"…"36" */
  id: Carta36Id;
  /** Número inteiro 1–36 */
  numero: number;
  /** ID interno alinhado a ArchetypeId do quiz */
  archetypeId: ArchetypeId;
  /** Título canônico do arquétipo (uso interno / pós-desbloqueio) */
  archetypeTitle: string;
  situacao: SituacaoIndex;
  /** Rótulo curto da situação (do mapa) */
  situacaoLabel: string;
  /** Nome medieval marcante da carta */
  tituloMedieval: string;
  /** Leitura da cena em linguagem direta */
  leituraCena: string;
  /** Ponto forte revelado na cena */
  pontoForte: string;
  /** Teaser de prévia — nunca revela o nome do arquétipo */
  provocacaoPreDesbloqueio: string;
  /** Direção de arte resumida */
  direcaoVisual: string;
  /** Prompt detalhado para geração de imagem medieval */
  promptImagem: string;
};

const C = (
  partial: Carta36,
): Carta36 => partial;

export const CARTAS_36: readonly Carta36[] = [
  // ─── 1. O Inocente (01–03) ─────────────────────────────────────────
  C({
    id: "01",
    numero: 1,
    archetypeId: "inocente",
    archetypeTitle: "O Inocente",
    situacao: 1,
    situacaoLabel: "No meio de uma treta boba",
    tituloMedieval: "A Pergunta que Desarma a Sala",
    leituraCena:
      "Todo mundo armado na defensiva, jogando indireta. No meio do barulho, alguém solta uma pergunta simples e limpa — sem maldade, sem ironia — e o clima pesado desmonta na hora.",
    pontoForte:
      "Leveza que desarma: esperança genuína e a coragem de falar limpo quando o ambiente só sabe atacar.",
    provocacaoPreDesbloqueio:
      "No meio da indireta, uma pergunta limpa quebra a armadura da sala. Sua carta guarda quem faz isso — e o preço de acreditar demais no clima.",
    direcaoVisual:
      "Interior de taverna medieval tensa; figura central de roupa clara, mãos abertas, rostos armados ao redor suavizando.",
    promptImagem:
      "Medieval oil painting, dim tavern interior with oak beams and candle smoke. A young figure in cream linen and soft wool cloak stands at the center of a tense circle of armored and cloaked patrons mid-argument. The central figure raises open empty hands and asks a simple question; faces around begin to soften. Warm amber candlelight, cool blue shadows in corners, no modern objects, no text, cinematic medieval atmosphere, detailed fabric and wood grain.",
  }),
  C({
    id: "02",
    numero: 2,
    archetypeId: "inocente",
    archetypeTitle: "O Inocente",
    situacao: 2,
    situacaoLabel: "Depois de uma queda feia",
    tituloMedieval: "O Erguer Depois da Queda",
    leituraCena:
      "O grupo tá desacreditado, achando que não tem mais jeito. Alguém levanta com a cabeça erguida, acreditando de verdade que dá pra recomeçar do zero — e essa fé puxa os outros.",
    pontoForte:
      "Capacidade de recomeçar com o coração aberto quando o ambiente já desistiu.",
    provocacaoPreDesbloqueio:
      "Depois da queda, quase ninguém levanta de verdade. Sua carta mostra quem ainda acredita — e o ponto cego que essa fé esconde.",
    direcaoVisual:
      "Campo de batalha ao amanhecer; figura se ergue entre destroços, luz dourada no horizonte, companheiros ajoelhados ao fundo.",
    promptImagem:
      "Epic medieval dawn after battle, muddy field with broken shields and banners. A solitary figure in light travel cloak rises from one knee, face lifted toward a golden horizon, hopeful but not naive. Exhausted companions kneel in the mist behind. Soft gold sunrise cutting through blue fog, painterly realism, no logos, no text, cinematic wide shot.",
  }),
  C({
    id: "03",
    numero: 3,
    archetypeId: "inocente",
    archetypeTitle: "O Inocente",
    situacao: 3,
    situacaoLabel: "Num ambiente cheio de desconfiança",
    tituloMedieval: "A Postura Sem Segunda Intenção",
    leituraCena:
      "Ninguém quer ceder um milímetro com medo de ser passado pra trás. A postura transparente e sem segundas intenções de alguém faz o ambiente baixar a guarda.",
    pontoForte:
      "Transparência que gera confiança: harmonia sem precisar manipular o jogo.",
    provocacaoPreDesbloqueio:
      "Onde ninguém cede um milímetro, uma postura limpa baixa a guarda da sala. Sua carta carrega essa luz — e o risco de quem confia demais.",
    direcaoVisual:
      "Sala do conselho com velas; figura de mãos à vista sobre a mesa, outros com braços cruzados que aos poucos relaxam.",
    promptImagem:
      "Medieval council chamber, stone walls, long oak table lit by candles. A figure in soft ivory and sky-blue garments sits with both hands open and visible on the table, calm open expression. Other nobles with crossed arms and wary eyes slowly relax. Atmosphere of thawing distrust, Rembrandt lighting, rich textiles, no modern elements, no text.",
  }),

  // ─── 2. O Cara Comum / Órfão (04–06) ───────────────────────────────
  C({
    id: "04",
    numero: 4,
    archetypeId: "pessoa_comum",
    archetypeTitle: "O Órfão",
    situacao: 1,
    situacaoLabel: "Quando alguém chega se achando demais",
    tituloMedieval: "A Frase Óbvia que Desinfla o Ego",
    leituraCena:
      "Num grupo onde todo mundo tenta impressionar ou falar difícil, alguém fala o óbvio com simplicidade e faz todo mundo rir e relaxar.",
    pontoForte:
      "Autenticidade sem pose: empatia real que corta o teatro e devolve o chão ao grupo.",
    provocacaoPreDesbloqueio:
      "Enquanto outros inflavam a voz, alguém falou o óbvio e a sala riu de alívio. Sua carta guarda esse poder quieto — e o limiar que você hesita cruzar.",
    direcaoVisual:
      "Grande salão com nobres em pose; figura simples no meio, sorriso franco, tensão estourando em riso.",
    promptImagem:
      "Medieval great hall banquet, nobles in ornate velvet striking poses and speaking grandly. A plainly dressed traveler in earthy wool stands among them, speaking a simple honest line; several nobles break into relieved laughter. Warm hearth light, muted browns and soft golds, grounded composition, no text, no modern items, oil-painting style.",
  }),
  C({
    id: "05",
    numero: 5,
    archetypeId: "pessoa_comum",
    archetypeTitle: "O Órfão",
    situacao: 2,
    situacaoLabel: "Na hora de quebrar o gelo com gente nova",
    tituloMedieval: "O Papo de Igual pra Igual",
    leituraCena:
      "Num lugar onde ninguém se entende, alguém puxa papo de igual pra igual, sem pose, e conecta o grupo inteiro em poucos minutos.",
    pontoForte:
      "Facilidade de criar vínculo e confiança com qualquer pessoa, sem hierarquia forçada.",
    provocacaoPreDesbloqueio:
      "Num canto onde ninguém se falava, alguém puxou papo de igual e o grupo inteiro se ligou. Sua carta parece quieta — o espelho aponta o preço de pertencer sem se nomear.",
    direcaoVisual:
      "Pátio de mercado medieval; figura no centro de um círculo espontâneo de estranhos conversando.",
    promptImagem:
      "Busy medieval market courtyard at late afternoon. A friendly figure in simple brown cloak sits on a crate, speaking warmly; strangers of different ranks gather into a spontaneous circle, smiling and connecting. Soft dust motes, warm low sun, authentic period clothing, documentary-painterly realism, no text.",
  }),
  C({
    id: "06",
    numero: 6,
    archetypeId: "pessoa_comum",
    archetypeTitle: "O Órfão",
    situacao: 3,
    situacaoLabel: "Quando o plano bonito falha na prática",
    tituloMedieval: "O Jeito Simples que Resolve",
    leituraCena:
      "A teoria linda não funciona na vida real. Quem tem pé no chão já sabe o jeito simples e direto de resolver o que tá na frente.",
    pontoForte:
      "Pragmatismo no dia a dia: resolver o concreto em vez de defender o discurso.",
    provocacaoPreDesbloqueio:
      "O plano bonito falhou. Alguém já sabia o jeito simples de consertar. Sua carta carrega esse chão — e pergunta o que você engole pra parecer gente boa.",
    direcaoVisual:
      "Acampamento; mapa elaborado abandonado, figura ajustando corda/roda com ferramenta simples enquanto outros discutem teoria.",
    promptImagem:
      "Medieval army camp at dusk. An elaborate parchment battle plan lies ignored on a table while a practical figure in work-worn clothes fixes a wagon wheel with simple tools. Scholars argue nearby; the fixer stays focused. Cool dusk blues and warm firelight, grounded realism, no text, no modern tools.",
  }),

  // ─── 3. O Herói (07–09) ────────────────────────────────────────────
  C({
    id: "07",
    numero: 7,
    archetypeId: "heroi",
    archetypeTitle: "O Herói",
    situacao: 1,
    situacaoLabel: "Quando todo mundo trava diante do problema",
    tituloMedieval: "O Passo à Frente na Bronca",
    leituraCena:
      "O clima pesa, ninguém quer assumir o risco. Alguém dá o passo à frente e encara a bronca de peito aberto.",
    pontoForte:
      "Coragem para enfrentar o que outros evitam — transformar intenção em ação.",
    provocacaoPreDesbloqueio:
      "Quando a sala trava, alguém dá o passo. Sua carta carrega um brasão de combate — e a batalha que você escolheu… e a que evita.",
    direcaoVisual:
      "Portão de cidade sob ameaça; figura avançando sozinha enquanto a multidão hesita atrás.",
    promptImagem:
      "Medieval city gate under threat, stormy sky. A determined warrior in practical armor steps forward alone from a hesitant crowd, chest open to the danger ahead. Dramatic rim light, dust and tension in the air, cinematic composition, no modern gear, no text, painterly medieval epic.",
  }),
  C({
    id: "08",
    numero: 8,
    archetypeId: "heroi",
    archetypeTitle: "O Herói",
    situacao: 2,
    situacaoLabel: "Sob pressão forte no limite do tempo",
    tituloMedieval: "Firmeza com a Corda no Pescoço",
    leituraCena:
      "Com a corda no pescoço e o relógio correndo, a pessoa mantém a firmeza e empurra a execução até o fim sem correr.",
    pontoForte:
      "Resistência sob pressão: disciplina que não se desfaz quando o tempo aperta.",
    provocacaoPreDesbloqueio:
      "Relógio no pescoço, e alguém não tremeu. Sua carta mostra firmeza até o fim — e pergunta se aguentar sempre é força ou medo de parar.",
    direcaoVisual:
      "Torre de vigia ao anoitecer; figura calma executando tarefa crítica enquanto tochas e mensageiros urgentes passam.",
    promptImagem:
      "Medieval watchtower at nightfall. A focused figure in battle-worn armor calmly completes a critical task (securing a signal fire / sealing a gate mechanism) while messengers rush past with urgent scrolls. Hourglass motif subtle in composition, controlled tension, cool night blues and torch orange, no text.",
  }),
  C({
    id: "09",
    numero: 9,
    archetypeId: "heroi",
    archetypeTitle: "O Herói",
    situacao: 3,
    situacaoLabel: "Quando aparece um obstáculo que ninguém quer encarar",
    tituloMedieval: "O Confronto que Ninguém Quis",
    leituraCena:
      "Onde os outros só reclamam ou recuam, alguém entra no confronto direto e resolve na raça e na coragem.",
    pontoForte:
      "Determinação que corta reclamação: ir ao obstáculo em vez de orbitar o medo.",
    provocacaoPreDesbloqueio:
      "Enquanto outros reclamavam, alguém entrou no confronto. Sua carta chega borrada de propósito — o dossiê nomeia a guerra certa e a covardia disfarçada de espera.",
    direcaoVisual:
      "Ponte estreita bloqueada; figura avançando de frente para a barreira enquanto aliados recuam.",
    promptImagem:
      "Narrow medieval stone bridge blocked by a hostile barrier or creature-shadow. A lone fighter advances head-on while companions step back complaining. Dynamic diagonal composition, grit and courage, dusk light, oil-painting epic style, no text, no anachronisms.",
  }),

  // ─── 4. O Cuidador (10–12) ─────────────────────────────────────────
  C({
    id: "10",
    numero: 10,
    archetypeId: "cuidador",
    archetypeTitle: "O Cuidador",
    situacao: 1,
    situacaoLabel: "Quando alguém desaba de cansaço",
    tituloMedieval: "Quem Chega Perto sem Sermão",
    leituraCena:
      "Em vez de dar sermão ou sumir, alguém chega perto, escuta de verdade e ajuda a resolver o que tá pesando naquele momento.",
    pontoForte:
      "Escuta atenta e generosidade prática: amparar sem humilhar.",
    provocacaoPreDesbloqueio:
      "Quando alguém desaba, a maioria some ou sermoneia. Sua carta chega perto — e revela até onde você se doa… e onde se esquece.",
    direcaoVisual:
      "Ala de enfermaria medieval; figura ajoelhada ao lado do exausto, mão no ombro, sem plateia.",
    promptImagem:
      "Quiet medieval infirmary with wooden beds and herbal shelves. A compassionate figure kneels beside an exhausted traveler, hand gently on their shoulder, listening intently — no sermon posture. Soft window light, muted greens and warm wood, intimate composition, no text.",
  }),
  C({
    id: "11",
    numero: 11,
    archetypeId: "cuidador",
    archetypeTitle: "O Cuidador",
    situacao: 2,
    situacaoLabel: "Num grupo rachado pelo estresse",
    tituloMedieval: "A Presença que Segura a União",
    leituraCena:
      "Quando a tensão deixa todo mundo impaciente e duro, a presença acolhedora de alguém acalma os ânimos e segura a união.",
    pontoForte:
      "Força afetiva que mantém pessoas unidas nos momentos difíceis.",
    provocacaoPreDesbloqueio:
      "Grupo rachado pelo estresse; uma presença segura os ânimos. Sua carta carrega o peso do outro — o dossiê pergunta quem cuida de quem cuida.",
    direcaoVisual:
      "Acampamento dividido em facções; figura no centro oferecendo pão/cobertor, tensões baixando.",
    promptImagem:
      "Stressed medieval camp split into arguing factions. A steady caregiver figure stands in the middle offering bread and a wool cloak, calming postures around them. Soft firelight, earth tones, emotional warmth without sentimentality, painterly realism, no text.",
  }),
  C({
    id: "12",
    numero: 12,
    archetypeId: "cuidador",
    archetypeTitle: "O Cuidador",
    situacao: 3,
    situacaoLabel: "Quando alguém esquece de si no meio do corre",
    tituloMedieval: "O Olho nos Detalhes de Quem Fica pra Trás",
    leituraCena:
      "Alguém nota quem tá ficando pra trás ou passando mal e cuida nos detalhes sem precisar ser pedido.",
    pontoForte:
      "Senso de responsabilidade afetiva: ver o invisível e agir antes do pedido.",
    provocacaoPreDesbloqueio:
      "No corre, alguém notou quem ficou pra trás — sem ser pedido. Sua carta guarda esse olhar. O espelho pergunta se você some de si enquanto salva o resto.",
    direcaoVisual:
      "Marcha de caravana; figura desviando do fluxo para ajudar quem cambaleia na trilha.",
    promptImagem:
      "Medieval caravan on a dusty road. Most travelers push forward; one attentive figure steps aside to support a stumbling companion with water and a steadying arm. Midday haze, muted palette with a warm focal light on the act of care, no text, cinematic still.",
  }),

  // ─── 5. O Explorador (13–15) ───────────────────────────────────────
  C({
    id: "13",
    numero: 13,
    archetypeId: "explorador",
    archetypeTitle: "O Explorador",
    situacao: 1,
    situacaoLabel: "Quando o ambiente fica fechado e repetitivo",
    tituloMedieval: "A Porta que Ninguém Via",
    leituraCena:
      "Todo mundo preso nas mesmas regras e rotinas sem saída. Alguém aponta uma porta diferente e abre um caminho novo.",
    pontoForte:
      "Coragem para sair da caixa quando o ambiente vira prisão — curiosidade viva.",
    provocacaoPreDesbloqueio:
      "Rotina virando cela; alguém aponta uma porta diferente. Sua carta cheira a estrada sem mapa — o diagnóstico revela o preço da liberdade que você cobra de si.",
    direcaoVisual:
      "Corredor de castelo repetitivo; figura puxando tapeçaria/revelando passagem lateral iluminada.",
    promptImagem:
      "Repetitive stone castle corridor with identical doors and tired guards. A lean traveler in weather-stained cloak pulls aside a tapestry revealing a glowing side passage to open landscape. Cool stone vs warm outdoor light contrast, sense of escape and discovery, no text.",
  }),
  C({
    id: "14",
    numero: 14,
    archetypeId: "explorador",
    archetypeTitle: "O Explorador",
    situacao: 2,
    situacaoLabel: "Diante do desconhecido que assusta os outros",
    tituloMedieval: "Quem Avança no Terreno Sem Mapa",
    leituraCena:
      "Onde a maioria trava por não saber o que vem depois, a pessoa avança com curiosidade e testa o terreno sem medo.",
    pontoForte:
      "Adaptabilidade e independência mental diante do desconhecido.",
    provocacaoPreDesbloqueio:
      "O desconhecido congela a maioria. Alguém testa o terreno com curiosidade. Sua carta não entrega o nome — só o cheiro de horizonte e o custo de nunca parar.",
    direcaoVisual:
      "Limiar de floresta/neblina; figura avançando com tocha baixa, grupo parado na borda clara.",
    promptImagem:
      "Edge of a misty medieval forest at dawn. Companions freeze at the sunlit clearing edge; one curious explorer steps into the fog with a low torch, testing the ground, eyes bright with interest not panic. Atmospheric fog layers, teal and gold palette, no text.",
  }),
  C({
    id: "15",
    numero: 15,
    archetypeId: "explorador",
    archetypeTitle: "O Explorador",
    situacao: 3,
    situacaoLabel: "Quando o plano antigo emperra",
    tituloMedieval: "Horizonte Fora da Caixa",
    leituraCena:
      "Insistir no mesmo lugar não leva a lugar nenhum. Quem busca novos horizontes já tá enxergando alternativa fora da caixa.",
    pontoForte:
      "Visão de rota alternativa: liberdade prática quando o plano antigo morreu.",
    provocacaoPreDesbloqueio:
      "O plano antigo emperrou. Alguém já via a rota fora da caixa. Sua carta aponta o horizonte — e o medo de criar raiz que o dossiê não esconde.",
    direcaoVisual:
      "Mapa antigo na mesa; figura virando o pergaminho para uma rota lateral enquanto outros insistam no caminho marcado.",
    promptImagem:
      "Medieval cartography table under lantern light. An old plan is stuck; an explorer turns the parchment to reveal an unmarked side route toward distant mountains visible through an open window. Others argue over the failed path. Warm lantern vs cool night outside, detailed maps and leather packs, no text.",
  }),

  // ─── 6. O Rebelde (16–18) ──────────────────────────────────────────
  C({
    id: "16",
    numero: 16,
    archetypeId: "rebelde",
    archetypeTitle: "O Rebelde",
    situacao: 1,
    situacaoLabel: "Quando uma regra absurda trava todo mundo",
    tituloMedieval: "Quem Questiona a Trava de Frente",
    leituraCena:
      "O grupo aceita calado algo que não faz sentido. Alguém questiona de frente e quebra a trava que impedia o avanço.",
    pontoForte:
      "Coragem de ruptura: abrir caminho onde a regra cega travava tudo.",
    provocacaoPreDesbloqueio:
      "Regra absurda, silêncio geral — até alguém questionar de frente. Chamas sob o verniz nesta carta. Só o dossiê diz o que você derruba… e o que ainda te prende.",
    direcaoVisual:
      "Pátio com edital selado; figura rasgando/apontando o decreto diante de guardas e povo mudo.",
    promptImagem:
      "Medieval courtyard with a sealed absurd decree posted on a wooden board. A defiant figure in dark practical leather points at or tears the decree while silent crowd and stiff guards watch. Sparks of torchlight, rose and charcoal palette, tension of rupture, no text overlays, cinematic oil style.",
  }),
  C({
    id: "17",
    numero: 17,
    archetypeId: "rebelde",
    archetypeTitle: "O Rebelde",
    situacao: 2,
    situacaoLabel: "Num ambiente acomodado e morno",
    tituloMedieval: "A Postura que Sacode o Lugar",
    leituraCena:
      "Todo mundo repetindo o que sempre foi feito por comodismo. A postura sem filtro de alguém sacode o lugar e provoca mudança real.",
    pontoForte:
      "Autenticidade sem filtro e visão crítica que força o ambiente a acordar.",
    provocacaoPreDesbloqueio:
      "Ambiente morno, todos repetindo o mesmo. Alguém sacode sem filtro. Sua carta não acalma — provoca. O espelho pergunta se sua ruptura constrói ou só queima.",
    direcaoVisual:
      "Salão sonolento; figura em pé no centro, gesto cortante, rostos acordando.",
    promptImagem:
      "Sleepy medieval guild hall where workers repeat the same dull motions. A sharp authentic figure stands center, speaking without filter; postures snap awake, tools pause mid-air. Dusty warm light broken by a shaft of cold daylight from an open door, no text.",
  }),
  C({
    id: "18",
    numero: 18,
    archetypeId: "rebelde",
    archetypeTitle: "O Rebelde",
    situacao: 3,
    situacaoLabel: "Quando impõem um limite injusto",
    tituloMedieval: "O Não que Abre Espaço pra Respirar",
    leituraCena:
      "Diante de pressão ou imposição cega, alguém diz \"não\" com firmeza e abre espaço pra todo mundo respirar.",
    pontoForte:
      "Limite justo como ato de liberdade coletiva — não como teatro.",
    provocacaoPreDesbloqueio:
      "Limite injusto. Alguém diz não — e a sala respira. Sua carta guarda essa chama. O relatório completo pergunta se você revoluciona… ou só foge do jugo trocando de jaula.",
    direcaoVisual:
      "Trono/mesa de poder; figura erguida dizendo não com a mão, outros atrás inspirando alívio.",
    promptImagem:
      "Medieval audience chamber. An authority figure imposes an unjust limit; a standing rebel raises a firm open palm saying no. Behind them, ordinary people exhale in relief. High contrast torchlight, charcoal and ember tones, dignified defiance, no text, no modern symbols.",
  }),

  // ─── 7. O Amante (19–21) ───────────────────────────────────────────
  C({
    id: "19",
    numero: 19,
    archetypeId: "amante",
    archetypeTitle: "O Amante",
    situacao: 1,
    situacaoLabel: "Num clima frio, mecânico ou distante",
    tituloMedieval: "Quem Coloca Alma na Sala Fria",
    leituraCena:
      "Onde tudo tá seco e automático, alguém coloca alma, atenção e presença real que muda a energia da sala.",
    pontoForte:
      "Sensibilidade aguçada e presença que transforma distância em calor.",
    provocacaoPreDesbloqueio:
      "Sala fria, tudo automático — até alguém colocar alma. Há calor e risco neste retrato. O diagnóstico nomeia o vínculo que te eleva e o que te dissolve.",
    direcaoVisual:
      "Salão de pedra fria; figura em tons quentes trazendo música/flor/toque de presença, rostos aquecendo.",
    promptImagem:
      "Cold stone medieval hall, mechanical distant courtiers. A magnetic figure in deep wine and rose fabrics brings warmth — playing a lute or offering a hand with full presence; faces around soften and awaken. Cool blue stone vs warm skin and fabric, sensual but elegant, no text.",
  }),
  C({
    id: "20",
    numero: 20,
    archetypeId: "amante",
    archetypeTitle: "O Amante",
    situacao: 2,
    situacaoLabel: "Quando algo precisa de capricho e entrega de verdade",
    tituloMedieval: "A Entrega que Se Sente na Pele",
    leituraCena:
      "Em vez de fazer de qualquer jeito, a pessoa trata o momento ou a criação com intensidade e faz todo mundo sentir a diferença.",
    pontoForte:
      "Paixão pelo que importa: capricho estético e emocional que eleva o resultado.",
    provocacaoPreDesbloqueio:
      "Dá pra fazer de qualquer jeito. Alguém fez com entrega — e a diferença se sente. Sua carta brilha com intensidade. O dossiê pergunta o que você ama… e o que te engole.",
    direcaoVisual:
      "Oficina/atelier medieval; figura perfeccionando detalhe de obra sob luz quente, outros observando emocionados.",
    promptImagem:
      "Medieval artisan chamber. A passionate figure refines a beautiful object (illuminated manuscript, carved jewel, or embroidered banner) with intense care; onlookers feel the difference. Rich crimson and gold accents, intimate warm lamp light, tactile detail, no text.",
  }),
  C({
    id: "21",
    numero: 21,
    archetypeId: "amante",
    archetypeTitle: "O Amante",
    situacao: 3,
    situacaoLabel: "Numa conversa travada por frieza",
    tituloMedieval: "A Sinceridade que Abre a Conexão",
    leituraCena:
      "Quando ninguém demonstra o que sente ou o que importa, a sinceridade e o calor de alguém abrem espaço pra conexão verdadeira.",
    pontoForte:
      "Capacidade de gerar intimidade real quando o ambiente só sabe se proteger.",
    provocacaoPreDesbloqueio:
      "Conversa travada na frieza; alguém nomeia o que importa. Sua carta não esfria. O espelho completo aponta o calor que salva — e a dependência que sufoca.",
    direcaoVisual:
      "Dois bancos junto à lareira; figura inclinada em sinceridade, interlocutor abrindo o peito.",
    promptImagem:
      "Quiet medieval fireside alcove. Two figures sit close; one speaks with sincere warmth, the other finally opens emotionally. Soft fire glow, deep shadows, intimate framing, rose and amber palette, tasteful emotional realism, no text.",
  }),

  // ─── 8. O Criador (22–24) ──────────────────────────────────────────
  C({
    id: "22",
    numero: 22,
    archetypeId: "criador",
    archetypeTitle: "O Criador",
    situacao: 1,
    situacaoLabel: "Diante de uma folha em branco ou falta de ideia",
    tituloMedieval: "A Ideia Tirada do Zero",
    leituraCena:
      "Onde ninguém sabe por onde começar, alguém tira uma ideia original do zero e dá forma ao que parecia vago.",
    pontoForte:
      "Inventividade prática: dar forma ao vago com identidade própria.",
    provocacaoPreDesbloqueio:
      "Folha em branco. Alguém tirou forma do zero. Há um mundo a nascer nesta imagem. O diagnóstico mostra a obra — e o perfeccionismo que a adia.",
    direcaoVisual:
      "Mesa com pergaminho em branco; figura esboçando a primeira linha enquanto outros olham o vazio.",
    promptImagem:
      "Medieval scriptorium or workshop. Blank parchment on a desk; a visionary creator begins the first bold strokes of an original design while others stare at empty pages. Soft daylight through arched window, ink, charcoal, and wood shavings, sky-blue and cream accents, no text readable.",
  }),
  C({
    id: "23",
    numero: 23,
    archetypeId: "criador",
    archetypeTitle: "O Criador",
    situacao: 2,
    situacaoLabel: "Quando o projeto tá sem identidade",
    tituloMedieval: "A Alma que Une as Peças Soltas",
    leituraCena:
      "Tem várias peças soltas, mas falta alma e direção. Alguém monta tudo com originalidade e dá cara própria ao resultado.",
    pontoForte:
      "Visão de futuro e senso estético que transforma fragmentos em obra com rosto.",
    provocacaoPreDesbloqueio:
      "Peças soltas, projeto sem cara. Alguém deu alma e direção. Sua carta monta o mosaico — o dossiê pergunta se a busca pela obra perfeita te impede de terminar.",
    direcaoVisual:
      "Fragmentos de bandeiras/escudos espalhados; figura compondo um brasão novo coerente.",
    promptImagem:
      "Medieval workshop table covered with mismatched banner scraps, seals, and metal pieces. A creator composes them into a coherent original emblem with clear identity. Focused expression, harmonious color emerging from chaos, cinematic craft lighting, no readable text.",
  }),
  C({
    id: "24",
    numero: 24,
    archetypeId: "criador",
    archetypeTitle: "O Criador",
    situacao: 3,
    situacaoLabel: "Quando falta recurso e sobra improviso",
    tituloMedieval: "Inventar o Jeito Impossível",
    leituraCena:
      "Sem a ferramenta ideal, a pessoa inventa um jeito novo de construir aquilo que parecia inviável.",
    pontoForte:
      "Criatividade sob restrição: improvisar sem perder a visão.",
    provocacaoPreDesbloqueio:
      "Falta ferramenta, sobra improviso. Alguém inventa o jeito. Sua carta constrói com o que tem. O espelho pergunta se a originalidade vira desculpa pra nunca entregar.",
    direcaoVisual:
      "Oficina improvisada; figura adaptando madeira/ferro quebrado em ferramenta nova funcional.",
    promptImagem:
      "Improvised medieval forge-workshop with missing proper tools. A resourceful creator repurposes broken wood and scrap iron into a clever new tool that works. Sparks, ingenuity, sky and copper tones, dynamic making-of moment, no text, no modern materials.",
  }),

  // ─── 9. O Bobo da Corte (25–27) ────────────────────────────────────
  C({
    id: "25",
    numero: 25,
    archetypeId: "bobo_da_corte",
    archetypeTitle: "O Bobo da Corte",
    situacao: 1,
    situacaoLabel: "Num clima pesado de tensão e cara feia",
    tituloMedieval: "A Sacada que Quebra o Gelo",
    leituraCena:
      "Todo mundo engessado e levando tudo a ferro e fogo. Uma sacada bem colocada quebra o gelo e alivia o ar na hora.",
    pontoForte:
      "Jogo de cintura e lucidez: desarmar clima pesado sem negar o problema.",
    provocacaoPreDesbloqueio:
      "Cara feia na sala; uma sacada bem colocada solta o ar. Sorriso na superfície, lâmina na sombra. O espelho completo ri por último — e aponta o custo da máscara.",
    direcaoVisual:
      "Corte tensa; figura de chapéu/cores vivas no centro, nobres sérios rachando em sorriso.",
    promptImagem:
      "Tense medieval royal court, stiff faces and heavy silence. A witty figure in motley-inspired but elegant colors delivers a perfectly timed remark; ice breaks, nobles start to smile. Candlelit hall, yellow and charcoal accents, magnetic presence, no text.",
  }),
  C({
    id: "26",
    numero: 26,
    archetypeId: "bobo_da_corte",
    archetypeTitle: "O Bobo da Corte",
    situacao: 2,
    situacaoLabel: "Quando alguém tá falando sério demais sobre bobagem",
    tituloMedieval: "A Tirada que Expõe o Exagero",
    leituraCena:
      "O ambiente tá inflado de ego ou drama desnecessário. Uma tirada esperta expõe o exagero sem perder a graça.",
    pontoForte:
      "Inteligência rápida que corta o teatro sem precisar ser cruel demais.",
    provocacaoPreDesbloqueio:
      "Ego inflado falando sério demais de bobagem. Uma tirada esperta furou o balão. Sua carta diverte — o dossiê pergunta se o humor é liberdade ou fuga.",
    direcaoVisual:
      "Púlpito/orador teatral; figura lateral com gesto irônico, plateia reconhecendo o exagero.",
    promptImagem:
      "Medieval hall where a pompous speaker overdramatizes a trivial matter. A sharp jester-like figure to the side delivers a witty aside; the audience recognizes the exaggeration and chuckles. Warm gold highlights, playful composition, tasteful comedy, no text.",
  }),
  C({
    id: "27",
    numero: 27,
    archetypeId: "bobo_da_corte",
    archetypeTitle: "O Bobo da Corte",
    situacao: 3,
    situacaoLabel: "Quando a conversa morre ou fica arrastada",
    tituloMedieval: "Quem Reacende a Atenção da Sala",
    leituraCena:
      "O clima cai e ninguém sabe o que dizer. O jogo de cintura e o humor rápido reacendem a atenção de todo mundo.",
    pontoForte:
      "Presença magnética: reacender energia social com leveza e timing.",
    provocacaoPreDesbloqueio:
      "Conversa morta. Alguém reacendeu a sala com timing. Sua carta brilha rápido. O relatório completo pergunta o que você evita quando faz todo mundo rir.",
    direcaoVisual:
      "Mesa longa silenciosa; figura no meio gesticulando, olhares voltando a se cruzar.",
    promptImagem:
      "Long medieval feast table fallen into awkward silence. A magnetic playful figure mid-gesture reignites attention; eyes reconnect across the table. Warm hearth light, lively motion blur on hands, yellow accents, cinematic still, no text.",
  }),

  // ─── 10. O Sábio (28–30) ───────────────────────────────────────────
  C({
    id: "28",
    numero: 28,
    archetypeId: "sabio",
    archetypeTitle: "O Sábio",
    situacao: 1,
    situacaoLabel: "No meio de achismo e confusão geral",
    tituloMedieval: "Quem Junta os Fatos com Calma",
    leituraCena:
      "Todo mundo falando sem base e chutando solução. Alguém junta os fatos com calma e mostra o que realmente tá acontecendo.",
    pontoForte:
      "Lucidez estratégica: enxergar o quadro inteiro por trás do barulho.",
    provocacaoPreDesbloqueio:
      "Achismo geral. Alguém juntou os fatos com calma. A carta brilha com perguntas demais. O espelho completo mostra onde a clareza vira armadura.",
    direcaoVisual:
      "Biblioteca/mapa de guerra; figura calma apontando evidências enquanto outros gritam teorias.",
    promptImagem:
      "Medieval war-room library in chaos of opinions. A calm scholarly figure in indigo robes lays out evidence on a table — maps, seals, notes — quietly showing what is actually happening. Cool indigo light, ordered focal point amid noise, Rembrandt shadows, no readable modern text.",
  }),
  C({
    id: "29",
    numero: 29,
    archetypeId: "sabio",
    archetypeTitle: "O Sábio",
    situacao: 2,
    situacaoLabel: "Antes de uma decisão arriscada",
    tituloMedieval: "O Detalhe que Ninguém Enxergou",
    leituraCena:
      "Enquanto o grupo vai no impulso, a leitura fria e lúcida de alguém aponta o detalhe que ninguém tinha enxergado.",
    pontoForte:
      "Frieza analítica na hora de avaliar riscos — pensamento crítico antes do salto.",
    provocacaoPreDesbloqueio:
      "Grupo no impulso; alguém viu o detalhe que mudava o risco. Sua carta não grita. O dossiê pergunta se a análise te protege… ou te paralisa.",
    direcaoVisual:
      "Conselho prestes a decidir; figura levantando um detalhe no pergaminho/selo, pausando a sala.",
    promptImagem:
      "Medieval council about to rush a risky decision. A lucid advisor lifts a small overlooked seal or clause on a parchment; the room freezes. Cool blue-gray palette with a single sharp highlight on the detail, intellectual tension, oil painting, no text overlays.",
  }),
  C({
    id: "30",
    numero: 30,
    archetypeId: "sabio",
    archetypeTitle: "O Sábio",
    situacao: 3,
    situacaoLabel: "Quando o problema parece um nó sem fim",
    tituloMedieval: "A Clareza que Desata o Nó",
    leituraCena:
      "Em vez de se desesperar com o barulho, a clareza de alguém organiza o cenário e mostra o caminho lógico.",
    pontoForte:
      "Capacidade de organizar o caos em caminho lógico sem drama.",
    provocacaoPreDesbloqueio:
      "Nó sem fim, barulho demais. Alguém organizou o cenário. Sua carta aponta o caminho lógico — e o preço de sentir pouco demais pra parecer lúcido.",
    direcaoVisual:
      "Fios/cordas emaranhados sobre mesa; figura desfazendo o nó com método, luz clara no centro.",
    promptImagem:
      "Medieval study table covered in tangled ropes, conflicting scrolls, and markers. A composed sage methodically untangles the knot, revealing a clear logical path drawn on a slate. Ordered light in the center, indigo and silver tones, quiet mastery, no modern objects, no text.",
  }),

  // ─── 11. O Mago (31–33) ────────────────────────────────────────────
  C({
    id: "31",
    numero: 31,
    archetypeId: "mago",
    archetypeTitle: "O Mago",
    situacao: 1,
    situacaoLabel: "Quando o jogo parece virado contra todo mundo",
    tituloMedieval: "A Brecha que Vira o Rumo",
    leituraCena:
      "O cenário tá ruim, mas alguém enxerga a brecha certa e muda o rumo da situação com uma virada inesperada.",
    pontoForte:
      "Senso de oportunidade e poder de síntese: virar o jogo em cenário complexo.",
    provocacaoPreDesbloqueio:
      "Jogo virado contra todos — alguém viu a brecha. Símbolos se movem nesta carta. O relatório revela a transformação que você inicia… e a que teme concluir.",
    direcaoVisual:
      "Tabuleiro/campo desfavorável; figura apontando uma fenda de luz/caminho lateral que muda a partida.",
    promptImagem:
      "Medieval strategy chamber with a losing battle map. A catalytic figure in violet-trimmed robes points to a hidden breach — a side path of light that flips the situation. Mystical but grounded atmosphere, violet and gold accents, transformative tension, no text, cinematic oil painting.",
  }),
  C({
    id: "32",
    numero: 32,
    archetypeId: "mago",
    archetypeTitle: "O Mago",
    situacao: 2,
    situacaoLabel: "Num momento de crise profunda",
    tituloMedieval: "Transformar Tensão em Marcha Nova",
    leituraCena:
      "Onde o problema parece definitivo, a pessoa transforma a tensão em oportunidade e faz o ambiente mudar de marcha.",
    pontoForte:
      "Visão de transformação: alquimia de crise em movimento novo.",
    provocacaoPreDesbloqueio:
      "Crise parecia definitiva. Alguém mudou a marcha do ambiente. Sua carta não consola — transforma. O dossiê pergunta se você catalisa… ou manipula o medo alheio.",
    direcaoVisual:
      "Tempestade no pátio; figura no centro convertendo pânico em formação ordenada com um gesto/palavra.",
    promptImagem:
      "Deep crisis in a medieval courtyard under storm. Panic among people; a transformative figure stands center, turning fear into coordinated new motion with a decisive gesture. Lightning and violet undertones, alchemical mood without cartoon magic, no text.",
  }),
  C({
    id: "33",
    numero: 33,
    archetypeId: "mago",
    archetypeTitle: "O Mago",
    situacao: 3,
    situacaoLabel: "Quando ninguém consegue conectar as peças",
    tituloMedieval: "Quem Liga as Peças e Destrava",
    leituraCena:
      "Alguém lê o momento, junta os elementos certos e provoca uma mudança que destrava o que tava parado.",
    pontoForte:
      "Influência e síntese: conectar elementos dispersos até a virada acontecer.",
    provocacaoPreDesbloqueio:
      "Peças soltas, nada anda. Alguém ligou o que faltava e destrava. Sua carta é virada de chave. O espelho completo pergunta se a mudança é profunda… ou só espetáculo.",
    direcaoVisual:
      "Mesa com artefatos/pessoas desconexas; figura unindo-os com um gesto de síntese, energia coerente surgindo.",
    promptImagem:
      "Medieval table with disconnected artifacts, letters, and people talking past each other. A catalytic figure joins the right elements; a coherent pattern emerges like a turning key. Violet glow subtle and grounded, sense of unlock, painterly realism, no readable text.",
  }),

  // ─── 12. O Governante (34–36) ──────────────────────────────────────
  C({
    id: "34",
    numero: 34,
    archetypeId: "governante",
    archetypeTitle: "O Governante",
    situacao: 1,
    situacaoLabel: "Num ambiente bagunçado e sem comando",
    tituloMedieval: "Quem Assume o Leme e Ordena",
    leituraCena:
      "Cada um puxa pra um lado e nada anda. Alguém assume o leme com firmeza, organiza as prioridades e coloca ordem.",
    pontoForte:
      "Liderança firme e senso de direção: transformar dispersão em estrutura.",
    provocacaoPreDesbloqueio:
      "Bagunça sem comando. Alguém assumiu o leme. Ordem e trono pairam nesta carta. O relatório completo revela o reino que você ergue… e o que controla demais.",
    direcaoVisual:
      "Sala caótica; figura no centro apontando prioridades no mapa, fluxo começando a organizar-se.",
    promptImagem:
      "Chaotic medieval war hall, people pulling in different directions. A commanding figure in amber-trimmed cloak takes the helm at the center table, organizing priorities on a map; order begins to form. Authoritative calm, amber and charcoal palette, no text, cinematic oil style.",
  }),
  C({
    id: "35",
    numero: 35,
    archetypeId: "governante",
    archetypeTitle: "O Governante",
    situacao: 2,
    situacaoLabel: "Quando o projeto precisa de responsabilidade até o fim",
    tituloMedieval: "O Compromisso que Mantém a Estrutura",
    leituraCena:
      "Na hora em que todo mundo dispersa, a postura de comando e compromisso de alguém mantém a estrutura de pé.",
    pontoForte:
      "Responsabilidade sustentada: autoridade que não some no meio do projeto.",
    provocacaoPreDesbloqueio:
      "Todo mundo dispersa; alguém segura a estrutura até o fim. Sua carta não abandona o posto. O dossiê pergunta se liderança virou prisão de controle.",
    direcaoVisual:
      "Obra/castelo em construção ao entardecer; figura ainda no canteiro enquanto outros vão embora.",
    promptImagem:
      "Medieval castle construction site at dusk. Workers leave; one responsible leader remains at the scaffolding with plans, holding the structure together through commitment. Amber sunset, solid composition, dignity of duty, no text.",
  }),
  C({
    id: "36",
    numero: 36,
    archetypeId: "governante",
    archetypeTitle: "O Governante",
    situacao: 3,
    situacaoLabel: "Quando surge uma disputa de espaço e desordem",
    tituloMedieval: "A Autoridade Tranquila que Define o Rumo",
    leituraCena:
      "Em meio à bagunça, a autoridade tranquila e justa de alguém acalma o grupo e define o rumo.",
    pontoForte:
      "Capacidade de organizar e sustentar estruturas com autoridade justa, sem grito desnecessário.",
    provocacaoPreDesbloqueio:
      "Disputa de espaço, desordem. Alguém acalmou com autoridade tranquila e definiu o rumo. Sua carta ergue reino. O espelho pergunta se ordem serve ao grupo… ou só ao seu controle.",
    direcaoVisual:
      "Pátio em disputa; figura ereta e calma no centro, mãos firmes, facções baixando as vozes.",
    promptImagem:
      "Medieval courtyard dispute over territory flags. A calm authoritative ruler stands centered, fair and firm, quieting factions and pointing a clear direction. Balanced composition, amber crown-light without gaudiness, justice mood, no text, epic painterly realism.",
  }),
] as const;

export const CARTAS_36_BY_ID: Record<Carta36Id, Carta36> = CARTAS_36.reduce(
  (acc, carta) => {
    acc[carta.id] = carta;
    return acc;
  },
  {} as Record<Carta36Id, Carta36>,
);

/** Ordem do mapa-fonte (não confundir com ARCHETYPE_ORDER do quiz). */
export const MAPA_ARQUETIPO_ORDER: readonly ArchetypeId[] = [
  "inocente",
  "pessoa_comum",
  "heroi",
  "cuidador",
  "explorador",
  "rebelde",
  "amante",
  "criador",
  "bobo_da_corte",
  "sabio",
  "mago",
  "governante",
] as const;

export function cartaByNumero(numero: number): Carta36 | undefined {
  if (numero < 1 || numero > 36) return undefined;
  const id = String(numero).padStart(2, "0") as Carta36Id;
  return CARTAS_36_BY_ID[id];
}

export function cartaById(id: Carta36Id): Carta36 {
  return CARTAS_36_BY_ID[id];
}

export function cartasForArchetype(archetypeId: ArchetypeId): Carta36[] {
  return CARTAS_36.filter((c) => c.archetypeId === archetypeId);
}

export function cartaForSituacao(
  archetypeId: ArchetypeId,
  situacao: SituacaoIndex,
): Carta36 | undefined {
  return CARTAS_36.find(
    (c) => c.archetypeId === archetypeId && c.situacao === situacao,
  );
}

/** Provocação de prévia por carta — nunca nomeia o arquétipo. */
export function provocacaoCarta(id: Carta36Id): string {
  return CARTAS_36_BY_ID[id].provocacaoPreDesbloqueio;
}

/**
 * Teaser de prévia por arquétipo (situação 1 como default de marca).
 * Não rewire o paywall atual — helper aditivo para usos futuros.
 */
export function provocacaoPadraoDoArquétipo(
  archetypeId: ArchetypeId,
): string | undefined {
  return cartaForSituacao(archetypeId, 1)?.provocacaoPreDesbloqueio;
}

/** Hash estável (djb2) para escolher 1 das 3 cartas sem saltar no re-render. */
function stableSeedHash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Escolhe 1 das 3 cartas do arquétipo calculado para a prévia bloqueada.
 * Determinístico por seed (ex.: client sid + archetypeId) — nunca revela o nome.
 */
export function pickCartaPreviewForArchetype(
  archetypeId: ArchetypeId,
  seed?: string,
): Carta36 | undefined {
  const cartas = cartasForArchetype(archetypeId);
  if (cartas.length === 0) return undefined;
  const key = seed && seed.length > 0 ? seed : archetypeId;
  const idx = stableSeedHash(`${key}::${archetypeId}`) % cartas.length;
  return cartas[idx];
}

export const TOTAL_CARTAS_36 = 36;
export const SITUACOES_POR_ARQUETIPO = 3;
