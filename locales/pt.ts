import type { Messages } from "./en";

export const pt: Messages = {
  nav: {
    hardware: "Hardware",
    presale: "Pré-venda",
    tokenomics: "Tokenomics",
    vision: "Visão",
    updates: "Atualizações",
    secureKit: "Garantir um kit",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    primary: "Principal",
  },
  hero: {
    kicker: "Ecossistema DePIN · infraestrutura Solana",
    title: "Aether Vision",
    headline: "A ponte entre hardware HUD tático e Edge AI em tempo real",
    body: "Aether Vision é uma linha de hardware DePIN na Solana. O primeiro modelo é simples, funcional e acessível. As assinaturas do app são liquidadas no token utilitário $VISION e em $AETH. Com as vendas, o buyback automático queima os dois tokens e reabastece a tesouraria para a próxima geração.",
    ctaPresale: "Participar da pré-venda",
    ctaHardware: "Ver o hardware",
    cardTitle: "Linha Vision",
    cardSub: "Vision 1.0 → 4.0 · App Bridge · Edge AI em tempo real",
    app: "App",
    yield: "Mecanismo",
    token: "Token",
    vault: "Custódia",
  },
  presale: {
    kicker: "Pré-venda · Tesouraria",
    title: "Kits de hardware e $VISION",
    leadBefore: "Preço oficial:",
    leadAfter:
      "por $VISION. Conecte a Phantom ou a Backpack e envie SOL para a tesouraria de recebimento. As assinaturas mensais aceitam $AETH e $VISION de forma nativa.",
    nativePay:
      "Pagamento das assinaturas mensais do aplicativo: $AETH e $VISION são aceitos nativamente.",
    tge: {
      kicker: "TGE Condicional",
      title: "Liquidez, KYC e auditoria antes de qualquer negociação pública",
      priceLabel: "Preço da pré-venda",
      price: "R$ 0,0001",
      priceUnit: " / token",
      priceUsd: "$0.0001 USD",
      ruleLabel: "Regra do TGE",
      rule: "O Token Generation Event (TGE) e a liberação oficial do pool de liquidez na Raydium só acontecem depois do encerramento bem-sucedido da pré-venda, da injeção do fundo de liquidez, da conclusão do KYC da equipe e da emissão do relatório de auditoria do contrato inteligente.",
      steps: [
        "Captação inicial da pré-venda",
        "KYC da equipe e auditoria do contrato inteligente, durante a pré-venda",
        "Conclusão bem-sucedida do KYC e da auditoria",
        "Injeção do fundo de liquidez",
        "TGE e liberação oficial do pool na Raydium",
      ],
      kycLabel: "Transparência e segurança",
      kycBody:
        "O KYC — verificação de identidade da equipe — e a emissão do relatório de auditoria do contrato inteligente ocorrem por completo durante a pré-venda e são concluídos antes do Token Generation Event (TGE) e da liberação oficial do pool de liquidez na Raydium. O compromisso é público: nenhuma negociação em mercado aberto começa sem a identidade da equipe verificada e sem a auditoria do contrato concluída.",
      valueLabel: "Proposta de valor",
      value:
        "Essa sequência foi desenhada para liquidez ordenada na Raydium, emissão verificada e uma abertura disciplinada da negociação pública na Solana.",
    },
  },
  checkout: {
    treasuryKicker: "Tesouraria on-chain · carteira de recebimento",
    treasuryBody:
      "O SOL é enviado para esta carteira Phantom de recebimento (relayer). Confira o endereço na carteira antes de assinar.",
    copy: "Copiar endereço",
    copied: "Copiado!",
    audit: "Verificar no Solscan",
    progress: "Progresso da fase",
    checkoutTitle: "Checkout da pré-venda",
    liveRate: "Taxa ao vivo:",
    liveQuote: "cotação ao vivo",
    fallbackQuote: "cotação de referência: US$ 150",
    wallets: "Phantom · Backpack",
    amountLabel: "Quantidade em SOL",
    slider: "Controle de SOL",
    usd: "USD",
    bonus: "Bônus",
    youReceive: "Você recebe",
    confirming: "Confirmando na carteira…",
    buySol: "Comprar com SOL",
    connectWallet: "Conectar Phantom / Backpack",
    legal:
      "Transferência nativa de SOL para a tesouraria de recebimento. O $VISION é creditado pela taxa desta fase. Isto não é uma oferta de valores mobiliários.",
    paySol: "Pagar com SOL",
    payPix: "Pagar com PIX",
    destLabel: "Carteira Solana que recebe $VISION",
    destPlaceholder: "Cole o endereço ou conecte a Phantom",
    pixHint:
      "Abra o app do banco, cole o código PIX e aguarde. O $VISION vai para a carteira acima após a confirmação.",
    pixCopy: "Copiar código PIX",
    pixWaiting: "Aguardando pagamento PIX…",
    pixSimulate: "Simular PIX (dev)",
    creatingOrder: "Criando pedido…",
    deliveryNotice:
      "O envio dos tokens $VISION é feito manualmente pelo administrador e pode levar até 24 horas para aparecer na sua carteira após a confirmação do pagamento.",
    fulfillPending:
      "Pagamento confirmado. O $VISION é enviado pelo administrador em até 24 horas.",
    fulfillWaitWallet:
      "Pagamento registrado. O $VISION é enviado manualmente por um administrador em até 24 horas.",
    fulfillOk: "Pagamento confirmado. O $VISION pode levar até 24 horas para chegar.",
    select: "Selecionar",
    contribution: "Aporte Vision",
    visionBonus: "$VISION · bônus",
  },
  tiers: {
    early: {
      badge: "Smart Audio",
      perk1: "Alocação Vision 1.0 · áudio essencial",
      perk2: "Equivalente a 3 meses de assinatura do app de IA",
    },
    pro: {
      badge: "AI Camera",
      perk1: "Alocação Vision 2.0 · câmera 12MP multimodal",
      perk2: "Equivalente a 6 meses de assinatura do app",
    },
    master: {
      badge: "Executivo",
      perk1: "Alocação Vision 3.0 · titânio e condução óssea",
      perk2: "Assinatura vitalícia do app + 10.000 $AETH na mainnet",
    },
    apex: {
      badge: "Flagship AR",
      perk1: "Alocação Vision 4.0 · Micro-OLED AR neural",
      perk2: "Alocação prioritária + assinatura vitalícia + 10.000 $AETH",
    },
  },
  hardware: {
    kicker: "Linha Vision",
    title: "Quatro gerações. Um middleware.",
    lead: "Vision 1.0 a Vision 4.0 conectam você à Edge AI descentralizada da Aether Vision. Cada card dispara uma transferência nativa de SOL para a Squads Multisig.",
    connectBuy: "Conectar e comprar",
    v1: {
      tag: "Essencial",
      category: "Entrada · Smart audio",
      headline: "IA no dia a dia, sem câmera e sem excesso.",
      body: "A porta de entrada da linha. Áudio bidirecional, comandos de voz e App Bridge — inteligência wearable essencial, com o melhor custo-benefício.",
      frame: "Armação TR90 clássica, hastes ergonômicas, chassis leve.",
      cta: "Garantir alocação",
      specs: [
        { label: "Câmera", value: "Não possui" },
        { label: "Áudio", value: "Bidirecional open-ear" },
        { label: "Interface", value: "Voz + App Bridge" },
        { label: "Material", value: "TR90 · hastes ergonômicas" },
      ],
    },
    v2: {
      tag: "Equilíbrio",
      category: "AI Camera · Visão multimodal",
      headline: "Captura visual discreta e análise em tempo real.",
      body: "O ponto de equilíbrio da linha. Visão computacional, tradução e contexto multimodal no middleware de Edge AI — a experiência completa de óculos inteligentes.",
      frame: "TR90 de alta densidade, fosco aveludado, micro-câmera 12MP na dobradiça.",
      cta: "Garantir alocação",
      specs: [
        { label: "Câmera", value: "12MP camuflada na dobradiça" },
        { label: "IA", value: "Visão computacional multimodal" },
        { label: "Ao vivo", value: "Tradução e análise em tempo real" },
        { label: "Material", value: "TR90 alta densidade · fosco" },
      ],
    },
    v3: {
      tag: "Luxo",
      category: "Executivo discreto",
      headline: "Titânio, condução óssea e discrição de design.",
      body: "O modelo executivo. Armação de alto padrão, áudio por condução óssea e gestos hápticos — discreto o bastante para uso formal, com hardware de ponta.",
      frame: "Titânio ultrafino, condução óssea acústica e gestos hápticos nas hastes.",
      cta: "Garantir alocação",
      specs: [
        { label: "Áudio", value: "Condução óssea acústica" },
        { label: "Gestos", value: "Controle háptico nas hastes" },
        { label: "Display", value: "Air-display discreto" },
        { label: "Material", value: "Titânio ultrafino" },
      ],
    },
    v4: {
      tag: "Halo",
      category: "Flagship holográfico · Micro-OLED AR",
      headline: "AR contextual, rastreamento neural e um HUD tático.",
      body: "O modelo flagship. Lentes eletrocrômicas, câmeras estéreo de profundidade, projetores Micro-OLED e rastreamento neural — um HUD tático flutuante no middleware da Aether Vision.",
      frame: "Titânio aeroespacial e fibra de carbono. O ápice do hardware Aether Vision.",
      cta: "Garantir alocação",
      specs: [
        { label: "Display", value: "Projetores Micro-OLED AR" },
        { label: "Visão", value: "Câmeras estéreo de profundidade" },
        { label: "Neural", value: "Rastreamento contextual" },
        { label: "Material", value: "Titânio aeroespacial · carbono" },
      ],
    },
  },
  vision: {
    kicker: "Visão do produto",
    title: "Estratégia de valor da Aether",
    lead: "Hardware acessível agora, tesouraria transparente e um ciclo em que as vendas financiam a queima de tokens e o próximo modelo.",
    points: [
      {
        title: "Vision 1.0 ao Vision 4.0",
        body: "Uma linha progressiva: do smart audio essencial ao HUD tático Micro-OLED — função em primeiro lugar, entrada acessível e o ápice técnico no topo.",
      },
      {
        title: "Valor contínuo do ecossistema",
        body: "O objetivo central é expandir o ecossistema Aether Vision e lançar, de forma progressiva, modelos de óculos mais avançados.",
      },
      {
        title: "Buyback e burn automatizados",
        body: "Conforme o primeiro lote é vendido, o mecanismo compra e queima $AETH e $VISION, reduzindo a oferta diante do uso real.",
      },
      {
        title: "Tesouraria para a próxima geração",
        body: "A receita reabastece a tesouraria do projeto para desenvolver e lançar modelos ainda mais avançados.",
      },
    ],
  },
  tokenomics: {
    kicker: "Tokenomics transparente",
    title: "$VISION · 2.000.000.000",
    lead: "Oferta fixa de 2 bilhões de $VISION. A pré-venda aloca de 10% a 20% a US$ 0,0001. Liquidez, recompensas do app e a alocação da equipe são públicas.",
    items: [
      {
        label: "Pré-venda / soft launch",
        value: "10–20%",
        detail:
          "200M a 400M de $VISION a US$ 0,0001 por token. Captação estimada de US$ 20.000 a US$ 40.000 para financiar os óculos e o app por anos.",
      },
      {
        label: "Liquidez na Raydium",
        value: "40%",
        detail:
          "800M de $VISION no pool de liquidez da Raydium, pareados com os recursos captados após a pré-venda.",
      },
      {
        label: "Ecossistema e recompensas",
        value: "30%",
        detail:
          "600M de $VISION para cashback, bônus de indicação e recompensas do ecossistema DePIN no app.",
      },
      {
        label: "Equipe e marketing",
        value: "10%",
        detail:
          "200M de $VISION bloqueados para a equipe de desenvolvimento e a expansão de longo prazo.",
      },
    ],
    note: "O $AETH é lançado na mainnet nativa. O $VISION é o token utilitário do app e da liquidez na Solana. Os dois entram em buyback e burn após o primeiro lote.",
  },
  updates: {
    kicker: "Desenvolvimento e atualizações",
    title: "Construção contínua, no X oficial",
    leadBefore:
      "Não publicamos um roadmap estático. As atualizações de desenvolvimento são contínuas e são publicadas no canal oficial",
    leadAfter: ".",
    pillar: "Pilar",
    items: [
      {
        title: "App Bridge",
        body: "Integração Bluetooth entre o smartphone e os óculos Aether Vision — áudio, voz e sessão do app de IA em um único fluxo.",
      },
      {
        title: "Primeiro lote",
        body: "Capital para fabricar e lançar o primeiro lote de óculos, com custo acessível e a função no centro do produto.",
      },
      {
        title: "Mainnet $AETH",
        body: "Captação estratégica para o lançamento de $AETH em uma rede nativa, junto com o token utilitário $VISION na Solana.",
      },
    ],
  },
  trust: {
    label: "Rede e tesouraria",
    solana: "Infraestrutura Solana",
    squads: "Custódia Squads Multisig",
  },
  footer: {
    rights: "© 2026 Aether Vision. Todos os direitos reservados.",
    disclaimer:
      "A aquisição de vouchers ou kits na pré-venda é a compra antecipada de licenças de uso do aplicativo de inteligência artificial e/ou de dispositivos físicos. Não constitui oferta pública de valores mobiliários nem investimento financeiro especulativo.",
  },
  wallet: {
    body: "Nenhuma carteira Solana detectada. Instale Phantom ou Backpack para participar da pré-venda on-chain.",
    phantom: "Instalar Phantom",
    backpack: "Instalar Backpack",
    later: "Agora não",
  },
  receipt: {
    close: "Fechar",
    closeReceipt: "Fechar recibo",
    title: "Aporte confirmado on-chain",
    withTier: "A alocação {tier} foi enviada para a tesouraria de recebimento.",
    noTier: "A transferência de SOL foi confirmada na rede Solana.",
    deliveryNotice:
      "O envio dos tokens $VISION é feito manualmente pelo administrador e pode levar até 24 horas para aparecer na sua carteira após este pagamento.",
    solscan: "Ver no Solscan",
  },
  errors: {
    wallet_missing:
      "Nenhuma carteira Solana encontrada. Instale Phantom ou Backpack para continuar.",
    min_sol: "Mínimo de {min} SOL por transação.",
    invalid_sol: "Quantidade de SOL inválida.",
    cancelled: "Transação cancelada na carteira.",
    insufficient:
      "Saldo insuficiente em SOL para a transação e as taxas da rede.",
    simulation: "A simulação da transação falhou.",
    expired:
      "A rede demorou demais para confirmar. Se o SOL já saiu da carteira, não pague de novo — a tesouraria pode ter recebido.",
    generic: "Falha na transação.",
  },
  lang: {
    label: "Idioma",
    en: "EN",
    pt: "PT",
    es: "ES",
  },
};
