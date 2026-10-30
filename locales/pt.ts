import type { Messages } from "./en";

export const pt: Messages = {
  nav: {
    hardware: "Hardware",
    presale: "Pré-venda",
    tokenomics: "Tokenomics",
    vision: "Visão",
    updates: "Updates",
    secureKit: "Garantir Kit",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    primary: "Principal",
  },
  hero: {
    kicker: "Solana DePIN + AI Wearable",
    title: "Aether Vision",
    headline: "A Ponte Definitiva entre Hardware e Inteligência Artificial",
    body: "O primeiro modelo é simples, funcional e acessível. Assinaturas do app de IA aceitam $VISION e $AETH. Com as vendas, buyback automático queima os dois tokens e reabastece o caixa para a próxima geração de hardware.",
    ctaPresale: "Participar da pré-venda",
    ctaHardware: "Ver o hardware",
    cardTitle: "Linha Vision",
    cardSub: "Vision 1.0 → 4.0 · App Bridge · middleware de IA",
    app: "App",
    yield: "Yield",
    token: "Token",
    vault: "Vault",
  },
  presale: {
    kicker: "Pré-venda · Tesouraria",
    title: "Kits Hardware + Tokens",
    leadBefore: "Preço oficial:",
    leadAfter:
      "por 1 $VISION. Conecte Phantom ou Backpack e envie SOL para a Squads Multisig. Assinaturas mensais aceitam nativamente $AETH e $VISION.",
    nativePay:
      "Pagamento das assinaturas mensais do aplicativo: $AETH e $VISION são aceitos nativamente.",
  },
  checkout: {
    treasuryKicker: "Tesouraria on-chain · Squads",
    treasuryBody:
      "Vault transparente para auditoria pública. SOL vai direto para esta multisig. Confira o endereço na carteira antes de assinar.",
    copy: "Copiar endereço",
    copied: "Copiado!",
    audit: "Auditar no Solscan",
    progress: "Progresso da fase",
    checkoutTitle: "Checkout da pré-venda",
    liveRate: "Taxa ao vivo:",
    liveQuote: "cotação live",
    fallbackQuote: "fallback US$ 150",
    wallets: "Phantom · Backpack",
    amountLabel: "Quantidade em SOL",
    slider: "Slider de SOL",
    usd: "USD",
    bonus: "Bônus",
    youReceive: "Você recebe",
    confirming: "Confirmando na carteira…",
    buySol: "Buy with Solana",
    connectWallet: "Conectar Phantom / Backpack",
    legal:
      "Transferência nativa de SOL para a Squads Multisig. $VISION é creditado conforme a taxa desta fase; não é uma oferta de valor mobiliário.",
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
    lead: "Vision 1.0 a Vision 4.0 conectam o usuário à IA descentralizada da Aether. Cada card dispara transferência nativa de SOL para a Squads Multisig.",
    connectBuy: "Conectar e comprar",
    visualAlt: "Visual de estúdio do {name}",
    v1: {
      tag: "Essencial",
      category: "Entry-Level · Smart Audio",
      headline: "IA no dia a dia, sem câmera e sem excesso.",
      body: "Porta de entrada da linha. Áudio bidirecional, comandos de voz e App Bridge — a experiência essencial de inteligência no wearable, com o melhor custo-benefício.",
      frame: "Armação TR90 clássica, hastes ergonômicas, chassis leve.",
      cta: "Garantir Alocação",
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
      body: "O ponto de equilíbrio da coleção. Visão computacional, tradução e contexto multimodal no middleware de IA — a experiência completa de óculos inteligentes.",
      frame: "TR90 de alta densidade, fosco aveludado, micro-câmera 12MP na dobradiça.",
      cta: "Buy Tier",
      specs: [
        { label: "Câmera", value: "12MP camuflada na dobradiça" },
        { label: "IA", value: "Visão computacional multimodal" },
        { label: "Live", value: "Tradução e análise em tempo real" },
        { label: "Material", value: "TR90 alta densidade · fosco" },
      ],
    },
    v3: {
      tag: "Luxo",
      category: "Futurista invisível · Executivo",
      headline: "Titânio, condução óssea e discrição de grife.",
      body: "O modelo executivo. Visual idêntico a armações de alto padrão, áudio por condução óssea e gestos táteis — máxima elegância com tecnologia de ponta.",
      frame: "Titânio ultrafino, condução óssea acústica, gestos táteis nas hastes.",
      cta: "Garantir Alocação",
      specs: [
        { label: "Áudio", value: "Condução óssea acústica" },
        { label: "Gestos", value: "Controle tátil nas hastes" },
        { label: "Display", value: "Air-display discreto" },
        { label: "Material", value: "Titânio ultrafino" },
      ],
    },
    v4: {
      tag: "Halo",
      category: "Flagship holográfico · Micro-OLED AR",
      headline: "AR contextual, neural tracking e o ápice da linha.",
      body: "O flagship. Lentes eletrocrômicas, câmeras estéreo de profundidade, projetores Micro-OLED e rastreamento neural — realidade aumentada flutuante no middleware Aether.",
      frame: "Titânio aeroespacial e fibra de carbono. O ápice da Aether Vision na Web3.",
      cta: "Buy Tier",
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
    title: "Estratégia de valorização AETHER",
    lead: "Hardware acessível agora, tesouraria transparente, e um ciclo em que vendas alimentam queima de tokens e o próximo modelo.",
    points: [
      {
        title: "Vision 1.0 ao Vision 4.0",
        body: "Uma linha progressiva: do smart audio essencial ao flagship Micro-OLED AR — função no centro, custo acessível no início, ápice tecnológico no topo.",
      },
      {
        title: "Valorização contínua do ecossistema",
        body: "O objetivo principal é a valorização do ecossistema AETHER e o desenvolvimento progressivo de modelos de óculos superiores.",
      },
      {
        title: "Buyback & Burn automatizado",
        body: "Com o sucesso de vendas do primeiro lote, o mecanismo compra e queima $AETH e $VISION, reduzindo oferta conforme o uso real.",
      },
      {
        title: "Caixa para a próxima geração",
        body: "A receita reabastece o caixa do projeto para desenvolver e lançar modelos ainda mais avançados.",
      },
    ],
  },
  tokenomics: {
    kicker: "Tokenomics transparente",
    title: "$VISION · 1.000.000.000",
    lead: "Supply fixo de 1 bilhão. Pré-venda entre 10% e 20% a $0,05. Liquidez, recompensas do app e time com alocação pública.",
    items: [
      {
        label: "Pré-venda / Soft Launch",
        value: "10–20%",
        detail:
          "100M a 200M $VISION a $0,05. Arrecadação estimada de até $10M para financiar óculos e o app por anos.",
      },
      {
        label: "Liquidez Raydium",
        value: "40%",
        detail:
          "400M $VISION no pool DEX, alocados com os fundos arrecadados após a pré-venda.",
      },
      {
        label: "Ecossistema & Recompensas",
        value: "30%",
        detail:
          "300M $VISION para cashback, bônus de indicação e recompensas DePIN do app.",
      },
      {
        label: "Time & Marketing",
        value: "10%",
        detail:
          "100M $VISION travados para o time de desenvolvimento e expansão de longo prazo.",
      },
    ],
    note: "$AETH entra na mainnet nativa; $VISION opera o app e a liquidez na Solana. Ambos entram no ciclo de Buyback & Burn após o primeiro lote.",
  },
  updates: {
    kicker: "Desenvolvimento & atualizações",
    title: "Build constante, no X oficial",
    leadBefore:
      "Não publicamos um roadmap estático. As atualizações de desenvolvimento são contínuas e saem no canal oficial",
    leadAfter: ".",
    pillar: "Pilar",
    items: [
      {
        title: "App Bridge",
        body: "Integração Bluetooth entre o smartphone e os óculos Aether Vision — áudio, voz e sessão do app de IA em um único fluxo.",
      },
      {
        title: "Primeiro lote",
        body: "Arrecadação para fabricação e lançamento do primeiro lote de óculos, com custo acessível e função no centro do produto.",
      },
      {
        title: "Mainnet $AETH",
        body: "Arrecadação estratégica para o lançamento da criptomoeda $AETH com blockchain nativa, além do token $VISION na Solana.",
      },
    ],
  },
  trust: {
    label: "Rede e tesouraria",
    solana: "Powered by Solana",
    squads: "Secured by Squads Multisig",
  },
  footer: {
    rights: "© 2026 Aether Vision. Todos os direitos reservados.",
    disclaimer:
      "A aquisição de Vouchers/Kits na pré-venda representa a compra antecipada de licenças de uso do aplicativo de inteligência artificial e/ou dispositivos físicos, não constituindo oferta pública de valores mobiliários ou investimentos financeiros especulativos.",
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
    withTier: "A alocação {tier} foi enviada para a tesouraria Squads.",
    noTier: "A transferência de SOL foi confirmada na rede Solana.",
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
    generic: "Falha na transação.",
  },
  lang: {
    label: "Idioma",
    en: "EN",
    pt: "PT",
    es: "ES",
  },
};
