#!/usr/bin/env python3
"""Gera PLANO_30_VIDEOS_10_DIAS.md + 30 roteiros individuais (substitui conteúdo antigo)."""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EDITADO = Path(r"C:\Users\Next\Desktop\projeto quiz medieval\editado")
ROTEIROS = EDITADO / "roteiros-tiktok-10-dias"

# Cada item: slug, dia, slot, angulo, arquetipo_interno, tela, gancho, corpo, cta, visual, card
# Regra: tela/gancho/corpo/cta NUNCA nomeiam o arquétipo.

SCRIPTS: list[dict] = [
    # —— DIA 1 ——
    {
        "slug": "Dia01-Video1",
        "dia": 1,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Inocente (fé quieta + negação; tease paywall: fé quieta / ponto cego)",
        "card": "inocente.jpg",
        "tela": "Paz… ou fuga disfarçada?",
        "gancho": "Você chama de paz. Mas e se for só medo de ver o que já apodreceu?",
        "corpo": (
            "Tem gente que abaixa a voz na crise. Suaviza. Diz que vai dar certo. "
            "Enquanto o corpo já sente o cheiro do problema. "
            "A carta que aparece nesses casos carrega leveza de verdade… "
            "e uma sombra que nega o óbvio só pra não quebrar o clima. "
            "Você já perdeu algo por acreditar demais? "
            "O dossiê não te julga. Ele nomeia o padrão — luz, sombra e o limiar que você evita."
        ),
        "cta": "Link na bio. Responde os 16 dilemas com as suas palavras. Desbloqueia a leitura completa da sua carta.",
        "visual": "Carta `inocente.jpg` zoom lento; close de olhar; texto âmbar; fade no ‘vai dar certo’.",
    },
    {
        "slug": "Dia01-Video2",
        "dia": 1,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Órfão / pessoa_comum (pertencimento × anulação)",
        "card": "pessoa_comum.jpg",
        "tela": "O banco da taverna… vazio",
        "gancho": "Na taverna medieval, quem senta no banco do meio… some no meio da mesa.",
        "corpo": (
            "Simplicidade aparente. Empatia. Lealdade. "
            "Mas a sombra desse retrato é anular a própria voz pra não parecer arrogante. "
            "Você ri das piadas dos outros. Aceita a mesa que sobrou. "
            "E chama isso de ‘ser gente boa’. "
            "A carta mostra o poder silencioso… e o limiar que você hesita cruzar. "
            "Pertencer não pode custar o seu nome."
        ),
        "cta": "Quiz na bio. 16 dilemas. Sua carta selada — nome e dossiê só depois do véu.",
        "visual": "Carta `pessoa_comum.jpg`; névoa de taverna; zoom no banco vazio; tipografia sóbria.",
    },
    {
        "slug": "Dia01-Video3",
        "dia": 1,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Herói (brasão de combate; batalha escolhida × evitadas)",
        "card": "heroi.jpg",
        "tela": "Brasão… sem o nome",
        "gancho": "Tem um brasão de combate nesse retrato. Mas eu não vou te dizer o nome.",
        "corpo": (
            "Só o dossiê aponta a batalha que você escolheu… e a que evita. "
            "Disciplina. Foco. Justiça. "
            "E a sombra: exaustão por lutar demais — ou arrogância por nunca baixar o escudo. "
            "A carta chega borrada de propósito. "
            "Você responde. O ranking ordena. O véu segura o nome. "
            "Curioso o suficiente pra atravessar?"
        ),
        "cta": "Bio. Quiz gratuito. Diagnóstico completo por R$ 1,00 — luz, sombra, integração.",
        "visual": "Carta `heroi.jpg` parcial/blur; brasão em close; selo no canto; tease sem texto de nome.",
    },
    # —— DIA 2 ——
    {
        "slug": "Dia02-Video1",
        "dia": 2,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Cuidador (doar-se × esquecer de si)",
        "card": "cuidador.jpg",
        "tela": "Quem cuida… de você?",
        "gancho": "Você carrega todo mundo. E quando pergunta quem te carrega… o silêncio responde.",
        "corpo": (
            "A carta carrega o peso do outro. Generosidade. Paciência. "
            "O dossiê revela até onde você se doa… e onde se esquece. "
            "Síndrome de mártir não é virtude. É sombra com capa de virtude. "
            "Se isso te cutucou, não é ‘conteúdo’. É espelho. "
            "Luz e sombra no mesmo retrato — sem moralismo barato."
        ),
        "cta": "Link na bio. 16 dilemas. Desbloqueia o dossiê da sua carta.",
        "visual": "Carta `cuidador.jpg`; mãos/ombro em foco; texto esmeralda; corte seco no silêncio.",
    },
    {
        "slug": "Dia02-Video2",
        "dia": 2,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Explorador (estrada sem mapa; liberdade × raízes)",
        "card": "explorador.jpg",
        "tela": "Estrada sem mapa",
        "gancho": "Essa carta cheira a estrada sem mapa. Liberdade… ou fuga com capa de aventura?",
        "corpo": (
            "Autonomia. Curiosidade. Adaptabilidade. "
            "A sombra: dificuldade de criar raízes e compromisso que aperta o peito. "
            "No reino, quem vive na estrada conquista horizonte — e perde porto. "
            "O diagnóstico revela o preço da liberdade que você cobra de si. "
            "Qual lado da carta te acerta primeiro?"
        ),
        "cta": "Teste na bio. Carta selada. Nome e sombra só depois do desbloqueio.",
        "visual": "Carta `explorador.jpg`; trilha/névoa; zoom pan horizontal; tipografia teal.",
    },
    {
        "slug": "Dia02-Video3",
        "dia": 2,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Rebelde (chamas sob o verniz)",
        "card": "rebelde.jpg",
        "tela": "Chamas sob o verniz",
        "gancho": "Chamas sob o verniz. Só o diagnóstico completo diz o que você derruba — e o que ainda te prende.",
        "corpo": (
            "Autenticidade radical. Ruptura. "
            "Medo de ser impotente. Sombra de cinismo sem propósito. "
            "A carta não entrega o nome de graça. "
            "Ela provoca. Selada. Borrada. "
            "Você sente calor… e não sabe se é fogo de mudança ou de autossabotagem. "
            "O véu existe por um motivo."
        ),
        "cta": "Bio. Responde. Desbloqueia. Sem cadastro. Sem enrolação.",
        "visual": "Carta `rebelde.jpg` com vinheta de fogo; blur no centro; texto rosa-queimado.",
    },
    # —— DIA 3 ——
    {
        "slug": "Dia03-Video1",
        "dia": 3,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Amante (vínculo que eleva × dissolve)",
        "card": "amante.jpg",
        "tela": "Amor… ou dissolução?",
        "gancho": "Há calor e risco neste retrato. O vínculo te eleva… ou te dissolve?",
        "corpo": (
            "Intensidade. Entrega. Beleza. "
            "Medo de solidão. Sombra de dependência e ciúme. "
            "Você já confundiu paixão com prova de valor? "
            "O diagnóstico nomeia o vínculo que te eleva e o que te dissolve. "
            "Sem romantizar. Sem julgar. Só o padrão no espelho."
        ),
        "cta": "Link na bio. 16 dilemas situacionais. Sua carta completa atrás do véu.",
        "visual": "Carta `amante.jpg`; luz quente; zoom no peito/olhar; tipografia rosa.",
    },
    {
        "slug": "Dia03-Video2",
        "dia": 3,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Criador (obra × perfeccionismo que adia)",
        "card": "criador.jpg",
        "tela": "O ateliê trancado",
        "gancho": "Há um mundo a nascer nesta imagem. E um cadeado chamado ‘ainda não está pronto’.",
        "corpo": (
            "No castelo, o ateliê fica no andar alto. "
            "Imaginação. Originalidade. Senso estético. "
            "A sombra: perfeccionismo que adia a obra até ela virar fantasma. "
            "O diagnóstico mostra a criação — e o padrão que a tranca. "
            "Se você reconhece o cadeado, a carta já te viu."
        ),
        "cta": "Quiz na bio. Desbloqueia luz, sombra e 3 passos de integração.",
        "visual": "Carta `criador.jpg`; porta/ateliê; zoom no ‘selo’; tipografia sky.",
    },
    {
        "slug": "Dia03-Video3",
        "dia": 3,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Bobo da Corte (sorriso × lâmina na sombra)",
        "card": "bobo_da_corte.jpg",
        "tela": "Sorriso… lâmina",
        "gancho": "Sorriso na superfície. Lâmina na sombra. O espelho completo ri por último.",
        "corpo": (
            "Humor. Carisma. Leveza. "
            "Medo de tédio. Sombra de irresponsabilidade — ou fuga disfarçada de graça. "
            "A carta selada aponta o custo da máscara. "
            "Você usa o riso pra conectar… ou pra não ser visto? "
            "O dossiê não entrega o nome de graça. Entrega o padrão."
        ),
        "cta": "Bio. Faça o quiz. Carta selada → dossiê por R$ 1,00.",
        "visual": "Carta `bobo_da_corte.jpg`; máscara/meio-rosto; tipografia amarela; corte no sorriso.",
    },
    # —— DIA 4 ——
    {
        "slug": "Dia04-Video1",
        "dia": 4,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Sábio (clareza × armadura de análise)",
        "card": "sabio.jpg",
        "tela": "Clareza… ou armadura?",
        "gancho": "A carta brilha com perguntas demais. Onde a clareza vira armadura?",
        "corpo": (
            "Pensamento crítico. Objetividade. "
            "Medo de ser enganado. Sombra: paralisia por análise e frieza emocional. "
            "Você já atrasou uma decisão até ela decidir sozinha? "
            "O espelho completo mostra onde a inteligência protege… e onde isola. "
            "Sem spoiler de nome. Só o padrão."
        ),
        "cta": "Link na bio. 16 dilemas. Desbloqueia o relatório completo.",
        "visual": "Carta `sabio.jpg`; biblioteca/grimório; zoom lento; tipografia índigo.",
    },
    {
        "slug": "Dia04-Video2",
        "dia": 4,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Mago (símbolos; transformação iniciada × temida)",
        "card": "mago.jpg",
        "tela": "Símbolos se movem",
        "gancho": "Símbolos se movem nesta carta. A transformação que você inicia… e a que teme concluir.",
        "corpo": (
            "Visão sistêmica. Intuição estratégica. "
            "Medo de estagnação. Sombra de manipulação ou desconexão prática. "
            "No altar do reino, runas giram antes do nome aparecer. "
            "O relatório revela o catalisador — e o efeito colateral que você finge não ver. "
            "A carta já sabe. Você ainda está no limiar."
        ),
        "cta": "Teste na bio. Dominante, subarquétipo e sombra — depois do véu.",
        "visual": "Carta `mago.jpg`; partículas/runas; zoom espiral; tipografia violeta.",
    },
    {
        "slug": "Dia04-Video3",
        "dia": 4,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Governante (ordem e trono; reino × controle)",
        "card": "governante.jpg",
        "tela": "Trono… sem coroa",
        "gancho": "Ordem e trono pairam nesta carta. O reino que você ergue… e o que controla demais.",
        "corpo": (
            "Liderança. Responsabilidade. Estrutura. "
            "Medo de caos. Sombra de micromanagement e rigidez. "
            "A coroa não aparece no vídeo. De propósito. "
            "Só o selo. Só a provocação. "
            "Se você sente o peso do trono mesmo sem ver o nome… "
            "o dossiê está esperando atrás do pagamento de R$ 1,00."
        ),
        "cta": "Bio. Quiz. Carta selada. Diagnóstico completo sem cadastro.",
        "visual": "Carta `governante.jpg`; trono/selo; blur no topo; tipografia ouro antigo.",
    },
    # —— DIA 5 (eixos / produto) ——
    {
        "slug": "Dia05-Video1",
        "dia": 5,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Eixo 1 — Reação sob Pressão e Crise (Herói vibe visual)",
        "card": "heroi.jpg",
        "tela": "Sob pressão… quem age?",
        "gancho": "Quando a crise bate na porta do castelo… você ataca, congela ou suaviza?",
        "corpo": (
            "O quiz não pergunta teoria. Pergunta situação. "
            "Quatro eixos. Dezesseis dilemas. "
            "O primeiro eixo é reação sob pressão: o que você faz quando o chão treme. "
            "Sua resposta alimenta o ranking. "
            "Dominante. Subarquétipo. Sombra. "
            "Sem nome na tela. Só o padrão que você escolhe sob fogo."
        ),
        "cta": "Link na bio. Começa pelo eixo da crise. Desbloqueia o mapa completo.",
        "visual": "Carta `heroi.jpg`; flash de tempestade; texto laranja; corte rítmico.",
    },
    {
        "slug": "Dia05-Video2",
        "dia": 5,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Eixo 2 — Poder, Regras e Autonomia (Governante visual)",
        "card": "governante.jpg",
        "tela": "Lei do reino… ou fuga?",
        "gancho": "No salão do conselho, a regra está na mesa. Você obedece, dobra… ou queima?",
        "corpo": (
            "Segundo eixo: relação com poder, regras e autonomia. "
            "Tem gente que precisa de ordem. Tem gente que sufoca com ela. "
            "Tem gente que finge seguir e sabota por baixo. "
            "A carta que sobe no ranking carrega essa tensão. "
            "O dossiê mostra se você ergue estrutura… ou se esconde atrás dela."
        ),
        "cta": "Quiz na bio. 16 dilemas. Véu no nome. Dossiê por R$ 1,00.",
        "visual": "Carta `governante.jpg`; mesa de conselho/selo; zoom no pergaminho.",
    },
    {
        "slug": "Dia05-Video3",
        "dia": 5,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Eixo 3 — Vínculos (Amante visual) + tease paywall",
        "card": "amante.jpg",
        "tela": "Carta borrada no altar",
        "gancho": "Você responde. A carta aparece — borrada, provocativa, sem entregar o nome.",
        "corpo": (
            "‘Há uma fé quieta…’. ‘Chamas sob o verniz…’. ‘Ordem e trono…’. "
            "O paywall não é drama. É o momento em que a prévia vira dossiê: "
            "luz, sombra, confluência dominante vezes subarquétipo, três passos de integração. "
            "Por R$ 1,00 o espelho deixa de ser teaser. "
            "Sem cadastro. Sem enrolação. Só o véu."
        ),
        "cta": "Bio. Faça o quiz. Atravessa o véu. Lê a carta inteira.",
        "visual": "Carta `amante.jpg` blur/selo; altar; tipografia rosa; fade no véu.",
    },
    # —— DIA 6 ——
    {
        "slug": "Dia06-Video1",
        "dia": 6,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Inocente × Cuidador (paz vs cuidado; autossabotagem ética)",
        "card": "criador.jpg",
        "tela": "Paz… ou se doar demais?",
        "gancho": "Você evita conflito pra manter a paz… ou se doa até sumir?",
        "corpo": (
            "Dois padrões se cruzam com frequência no ranking: "
            "quem suaviza a crise… e quem carrega o outro até se esvaziar. "
            "Às vezes a confluência é exatamente essa. "
            "O diagnóstico não escolhe um ‘mocinho’. "
            "Ele mostra a autossabotagem ética — quando virtude vira fuga. "
            "Se os dois lados te acertam, o mapa híbrido existe pra isso."
        ),
        "cta": "Link na bio. Descobre dominante e subarquétipo — depois do desbloqueio.",
        "visual": "Carta `criador.jpg` (obra/tensão); split visual leve; tipografia sky.",
    },
    {
        "slug": "Dia06-Video2",
        "dia": 6,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Herói × Cuidador (polaridade criativa)",
        "card": "mago.jpg",
        "tela": "Escudo… ou colo?",
        "gancho": "No campo de batalha, você ergue o escudo… ou abre o colo pra quem sangra?",
        "corpo": (
            "Tensão clássica do diagnóstico: coragem de enfrentar versus impulso de proteger. "
            "Os dois salvam. Os dois sabotaam quando viram absoluto. "
            "A cena medieval é o ferido no chão e a escolha sem tempo. "
            "Sua resposta nos dilemas alimenta a polaridade. "
            "O dossiê mostra qual lado comanda — e qual fica na sombra."
        ),
        "cta": "Teste na bio. 16 dilemas. Confluência depois do véu.",
        "visual": "Carta `mago.jpg`; campo/névoa; zoom dual; tipografia violeta.",
    },
    {
        "slug": "Dia06-Video3",
        "dia": 6,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Rebelde × Governante (ordem vs ruptura)",
        "card": "inocente.jpg",
        "tela": "Queimar a regra… ou sentar no trono?",
        "gancho": "Uma carta puxa pra romper. Outra puxa pra ordenar. Qual vence em você?",
        "corpo": (
            "Ordem versus ruptura. Trono versus tocha. "
            "No ranking, essa confluência aparece quando você odeia o caos… "
            "e ao mesmo tempo não aguenta regra morta. "
            "A carta selada não entrega o nome. Entrega o dilema. "
            "O relatório completo nomeia a tensão — e o preço de escolher só um lado."
        ),
        "cta": "Bio. Quiz. R$ 1,00 pelo dossiê. Sem spoiler no vídeo.",
        "visual": "Carta `inocente.jpg` com overlay de selo/trono; contraste luz/fogo.",
    },
    # —— DIA 7 ——
    {
        "slug": "Dia07-Video1",
        "dia": 7,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Órfão / Bobo (máscara social × anulação)",
        "card": "pessoa_comum.jpg",
        "tela": "Máscara social",
        "gancho": "Você some no grupo pra pertencer… ou performa leveza pra ninguém te ver de verdade?",
        "corpo": (
            "Duas máscaras do reino: a do que se anula… e a do que ri pra não ser lido. "
            "Ambas protegem. Ambas cobram. "
            "O espelho do quiz cutuca exatamente isso nos eixos de vínculo e pressão. "
            "Se a frase te incomodou, ótimo. "
            "Incomodar é o gancho. O dossiê é o mapa."
        ),
        "cta": "Link na bio. Responde com as suas palavras. Desbloqueia a carta.",
        "visual": "Carta `pessoa_comum.jpg`; máscara/meio-rosto; tipografia slate.",
    },
    {
        "slug": "Dia07-Video2",
        "dia": 7,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Funil / prévia bloqueada (Herói visual)",
        "card": "heroi.jpg",
        "tela": "Véu no altar",
        "gancho": "O quiz é gratuito. A carta surge. O nome… fica atrás do véu.",
        "corpo": (
            "Esse é o ritual do produto: "
            "você responde dezesseis dilemas. "
            "A prévia provoca. A carta aparece selada. "
            "Diagnóstico completo por R$ 1,00 — luz, sombra, gatilhos, "
            "confluência dominante vezes subarquétipo e três passos de integração. "
            "Mais uma mensagem grátis no Mentor. "
            "Sem cadastro. Nome do padrão só depois do pagamento."
        ),
        "cta": "Bio. Faça o quiz agora. Atravessa o véu quando a prévia cutucar.",
        "visual": "Carta `heroi.jpg` com véu/blur; altar; tipografia laranja.",
    },
    {
        "slug": "Dia07-Video3",
        "dia": 7,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Oferta Mentor + diagnóstico (Rebelde visual — tensão)",
        "card": "rebelde.jpg",
        "tela": "R$ 1… ou o combo?",
        "gancho": "Você quer só o nome da carta… ou alguém que te cobre o próximo passo?",
        "corpo": (
            "Diagnóstico Completo: R$ 1,00. "
            "Consultoria IA 30 dias: R$ 5,00 — perguntas práticas, plano de ação, "
            "código pra reabrir o acesso. "
            "Combo: R$ 6,00. Os dois. "
            "A tensão é simples. "
            "Espelho sozinho… ou espelho com mentor que manda agir. "
            "Sem spoiler de arquétipo. Sem enrolação."
        ),
        "cta": "Link na bio. Quiz primeiro. Oferta depois da prévia.",
        "visual": "Carta `rebelde.jpg`; preços em tipografia limpa; zoom no selo.",
    },
    # —— DIA 8 ——
    {
        "slug": "Dia08-Video1",
        "dia": 8,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Eixo 4 — Ambição, Criação e Autossabotagem (Amante/Criador tensão → amante card)",
        "card": "amante.jpg",
        "tela": "Ambicionar… e sabotar",
        "gancho": "Você desenha o reino dos sonhos… e depois mesma mão joga areia na engrenagem?",
        "corpo": (
            "Quarto eixo: ambição, criação e autossabotagem. "
            "O quiz não pergunta se você ‘quer vencer’. "
            "Pergunta o que você faz quando a obra pede risco, exposição, entrega. "
            "Muita gente se reconhece no padrão: começa forte… e trava no limiar. "
            "O dossiê nomeia o freio. A carta só provoca."
        ),
        "cta": "Bio. 16 dilemas. Desbloqueia luz, sombra e integração.",
        "visual": "Carta `amante.jpg`; engrenagem/obra; tipografia rosa.",
    },
    {
        "slug": "Dia08-Video2",
        "dia": 8,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Criador (obra no scriptorium)",
        "card": "criador.jpg",
        "tela": "Pergaminho pela metade",
        "gancho": "No scriptorium, o pergaminho para no meio da frase. Quem segura a pena… trava o final.",
        "corpo": (
            "Cena pura: tinta, poeira, obra incompleta. "
            "Não é preguiça. É padrão. "
            "Mediocridade assusta. Perfeccionismo também. "
            "A leitura completa mostra a obra que você adia — "
            "e o perfeccionismo que a adia. "
            "Se o pergaminho pela metade te doeu, boa. É o espelho funcionando."
        ),
        "cta": "Quiz na bio. Carta selada. Dossiê por R$ 1,00.",
        "visual": "Carta `criador.jpg`; pergaminho/close tinta; zoom lento.",
    },
    {
        "slug": "Dia08-Video3",
        "dia": 8,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Sábio (perguntas demais; armadura)",
        "card": "sabio.jpg",
        "tela": "Perguntas demais",
        "gancho": "Essa carta brilha com perguntas demais. Clareza… ou desculpa pra não sentir?",
        "corpo": (
            "O grimório abre. As perguntas sobem. "
            "Você analisa. Compara. Adia. "
            "A sombra desse padrão é frieza com capa de inteligência. "
            "O espelho completo mostra onde a clareza vira armadura. "
            "Nome? Só depois do véu. "
            "Aqui fica a provocação — e o link."
        ),
        "cta": "Link na bio. Responde. Desbloqueia. Lê o padrão inteiro.",
        "visual": "Carta `sabio.jpg`; páginas virando; tipografia índigo; blur central.",
    },
    # —— DIA 9 ——
    {
        "slug": "Dia09-Video1",
        "dia": 9,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Mago × Inocente (transformação vs fé simplificada)",
        "card": "pessoa_comum.jpg",
        "tela": "Transformar… ou torcer?",
        "gancho": "Você tenta mudar o sistema… ou torce pra ‘dar certo’ e segue?",
        "corpo": (
            "Dois polos: catalisar transformação… versus fé simplificada que evita o custo. "
            "Os dois têm luz. Os dois têm sombra. "
            "No ranking, a confluência aparece quando você quer mudar tudo — "
            "mas foge da sujeira da execução. "
            "Ou quando mantém a paz… e abandona o poder de alterar o jogo. "
            "O dossiê corta no meio."
        ),
        "cta": "Bio. Quiz. Confluência dominante × subarquétipo depois do desbloqueio.",
        "visual": "Carta `pessoa_comum.jpg`; dualidade luz/sombra; tipografia slate.",
    },
    {
        "slug": "Dia09-Video2",
        "dia": 9,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Explorador (mapa rasgado)",
        "card": "explorador.jpg",
        "tela": "Mapa rasgado",
        "gancho": "O mapa rasgou na estrada. Você improvisa… ou volta pro porto que odeia?",
        "corpo": (
            "Cena: vento, tecido rasgado, horizonte. "
            "Liberdade real pede improviso. "
            "Fuga disfarçada também. "
            "A diferença está no corpo — e nas respostas dos dilemas. "
            "O diagnóstico revela o preço da liberdade que você cobra de si. "
            "Sem nome na tela. Só a estrada e o espelho."
        ),
        "cta": "Teste na bio. Carta selada. Atravessa o véu.",
        "visual": "Carta `explorador.jpg`; mapa/vento; pan horizontal; tipografia teal.",
    },
    {
        "slug": "Dia09-Video3",
        "dia": 9,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "Fechamento ciclo / Mago (grimório)",
        "card": "mago.jpg",
        "tela": "Grimório: 4 reinos",
        "gancho": "Quatro reinos. Quatro eixos. Dezesseis dilemas. O nome… só depois.",
        "corpo": (
            "Dominante. Subarquétipo. Às vezes híbrido. Sombra. Tags reais. "
            "O grimório se chama jornada por um motivo: "
            "você entra sem o nome… e só sai com o dossiê se atravessar o véu. "
            "Se nesses dias você se reconheceu em mais de uma carta, ótimo — "
            "o ranking existe pra isso. "
            "O espelho completa a ordem."
        ),
        "cta": "Link na bio. Fecha o ciclo. Faz o quiz. Desbloqueia o mapa.",
        "visual": "Carta `mago.jpg`; grimório aberto; tipografia violeta; fade no selo.",
    },
    # —— DIA 10 ——
    {
        "slug": "Dia10-Video1",
        "dia": 10,
        "slot": "Manhã",
        "angulo": "Conflito / Espelho",
        "base": "Recap espelho (Mago visual)",
        "card": "mago.jpg",
        "tela": "Qual carta te cutucou?",
        "gancho": "Dez dias. Trinta espelhos. Qual provocação ainda lateja no peito?",
        "corpo": (
            "Fé quieta. Banco vazio. Brasão sem nome. "
            "Quem cuida de você. Estrada sem mapa. Chamas sob o verniz. "
            "Trono sem coroa. Véu no altar. "
            "Se uma dessas cenas ainda te cutuca, não é coincidência. "
            "É o padrão pedindo o dossiê. "
            "O quiz está na bio. O nome continua atrás do véu — de propósito."
        ),
        "cta": "Bio. Responde os 16. Desbloqueia luz, sombra e integração.",
        "visual": "Carta `mago.jpg`; montage mental via zoom; tipografia violeta.",
    },
    {
        "slug": "Dia10-Video2",
        "dia": 10,
        "slot": "Tarde",
        "angulo": "Cena / Símbolo medieval",
        "base": "Oferta final / Governante (altar + trono)",
        "card": "governante.jpg",
        "tela": "Última tocha",
        "gancho": "Última tocha do ciclo. Carta selada no altar. Mentor ao lado do grimório.",
        "corpo": (
            "Diagnóstico completo mais Consultoria IA 30 dias. "
            "Código pra reabrir o acesso. Perfil embutido nas respostas. "
            "Sem revelar arquétipo no vídeo. "
            "Só a promessa fiel ao produto: luz, sombra, integração — "
            "e conversa que manda agir. "
            "O trono não é o nome. É a decisão de atravessar."
        ),
        "cta": "Link na bio. Quiz. Combo se quiser mentor. Véu primeiro.",
        "visual": "Carta `governante.jpg`; altar/tocha; tipografia ouro; zoom no selo.",
    },
    {
        "slug": "Dia10-Video3",
        "dia": 10,
        "slot": "Noite",
        "angulo": "Curiosidade / Carta fechada",
        "base": "CTA final absoluto (Governante)",
        "card": "governante.jpg",
        "tela": "Sua carta… espera",
        "gancho": "Sua carta já surgiu das brumas. O nome e o dossiê completo aguardam atrás do véu.",
        "corpo": (
            "Sem spoiler. Sem lista de nomes. "
            "Só o convite: responde. Olha a prévia. "
            "Se cutucar — desbloqueia. "
            "R$ 1,00 pelo diagnóstico. R$ 5,00 pelo mentor. R$ 6,00 pelo combo. "
            "InfinitePay no checkout. Resultado bloqueado até o pagamento. "
            "O reino não entrega a coroa de graça. Entrega o espelho."
        ),
        "cta": "Bio. Agora. Quiz → prévia → véu → dossiê.",
        "visual": "Carta `governante.jpg` selada; névoa; tipografia ouro; hold final no CTA.",
    },
]


HEADER = """# Plano 30 vídeos · 10 dias — Quiz Medieval (REFEITO)

**Produto:** Quiz dos 12 arquétipos · 16 dilemas · dominante × subarquétipo · sombra  
**Formato:** 10 dias × 3 posts (Manhã / Tarde / Noite) · ~30–50s · 1080×1920  
**Regra de ouro:** nos textos falados, na tela e no CTA **nunca nomear o arquétipo** antes do desbloqueio. Falar de carta, leitura, sombra, padrão, dossiê, espelho, véu, selo.  
**Pagamento / funil:** InfinitePay e bloqueio do resultado **inalterados**.  
**Nota interna (Ângulo):** pode citar o arquétipo/recurso. Texto público: nunca.

**Rotação de ganchos por dia:** Manhã = Conflito/Espelho · Tarde = Cena/Símbolo medieval · Noite = Curiosidade/Carta fechada.

**Proibido no falado/tela/CTA:** nomear Inocente, Órfão, Herói, Cuidador, Explorador, Rebelde, Amante, Criador, Bobo da Corte, Sábio, Mago, Governante.

---

"""


def roteiro_md(s: dict) -> str:
    return f"""# Dia {s['dia']} — Vídeo {s['slug'][-1]} ({s['slot']})
# Pronto para gravar / postar no TikTok
# Regra: NÃO falar o nome do arquétipo na tela, na fala ou no CTA

### Dia {s['dia']} — Vídeo {s['slug'][-1]} ({s['slot']})
**Ângulo & Arquétipo/Recurso Base:** {s['angulo']} · *{s['base']}*

- **Texto na Tela (0–3s):** {s['tela']}
- **Gancho Falado (0–3s):** {s['gancho']}
- **Roteiro / Desenvolvimento (3s–25s):** {s['corpo']}
- **CTA para o Quiz:** {s['cta']}
- **Sugestão Visual / Clipe:** {s['visual']}
"""


def plano_section(s: dict) -> str:
    return f"""### Dia {s['dia']} — {s['slot']} (`{s['slug']}`)
**Ângulo & Arquétipo/Recurso Base:** {s['angulo']} · *{s['base']}*

- **Texto na Tela (0–3s):** {s['tela']}
- **Gancho Falado (0–3s):** {s['gancho']}
- **Roteiro / Desenvolvimento (3s–25s):** {s['corpo']}
- **CTA para o Quiz:** {s['cta']}
- **Sugestão Visual / Clipe:** {s['visual']}

"""


def main() -> None:
    assert len(SCRIPTS) == 30, len(SCRIPTS)
    ROTEIROS.mkdir(parents=True, exist_ok=True)

    # Wipe old roteiros
    for old in ROTEIROS.glob("*.md"):
        old.unlink()

    parts = [HEADER]
    for s in SCRIPTS:
        parts.append(plano_section(s))
        (ROTEIROS / f"{s['slug']}.md").write_text(roteiro_md(s), encoding="utf-8")

    index = """# Roteiros TikTok — 10 dias × 3 vídeos (REFEITO)

Pasta: roteiros-tiktok-10-dias
Total: 30 arquivos individuais + PLANO_30_VIDEOS_10_DIAS.md em editado\\

| Dia | Manhã (V1) | Tarde (V2) | Noite (V3) |
|-----|------------|------------|------------|
"""
    for d in range(1, 11):
        index += (
            f"| {d} | Dia{d:02d}-Video1.md | Dia{d:02d}-Video2.md | Dia{d:02d}-Video3.md |\n"
        )
    index += "\nCalendário completo: ..\\PLANO_30_VIDEOS_10_DIAS.md\n"
    (ROTEIROS / "INDEX.md").write_text(index, encoding="utf-8")

    body = "".join(parts)
    dests = [
        REPO / "PLANO_30_VIDEOS_10_DIAS.md",
        EDITADO / "PLANO_30_VIDEOS_10_DIAS.md",
    ]
    for d in dests:
        d.write_text(body, encoding="utf-8")
        print(f"Wrote {d}")

    # Remove/replace old MD if present
    old_md = EDITADO / "TIKTOK_10_DIAS_QUIZ_MEDIEVAL.md"
    if old_md.is_file():
        old_md.unlink()
        print(f"Removed {old_md}")
    old_repo = REPO / "TIKTOK_10_DIAS_QUIZ_MEDIEVAL.md"
    if old_repo.is_file():
        # keep a stub pointing to new plan so old links don't confuse
        old_repo.write_text(
            "# Movido\n\nConteúdo substituído por `PLANO_30_VIDEOS_10_DIAS.md`.\n",
            encoding="utf-8",
        )
        print(f"Stubbed {old_repo}")

    print(f"Roteiros: {len(list(ROTEIROS.glob('Dia*.md')))}/30")


if __name__ == "__main__":
    main()
