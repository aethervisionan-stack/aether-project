import type { Messages } from "./en";

export const es: Messages = {
  nav: {
    hardware: "Hardware",
    presale: "Preventa",
    tokenomics: "Tokenomics",
    vision: "Visión",
    updates: "Updates",
    secureKit: "Asegurar kit",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    primary: "Principal",
  },
  hero: {
    kicker: "Solana DePIN + AI Wearable",
    title: "Aether Vision",
    headline: "El puente definitivo entre hardware e inteligencia artificial",
    body: "El primer modelo es simple, funcional y accesible. Las suscripciones de la app de IA aceptan $VISION y $AETH. Con las ventas, el buyback automático quema ambos tokens y recarga la tesorería para la próxima generación de hardware.",
    ctaPresale: "Participar en la preventa",
    ctaHardware: "Ver el hardware",
    cardTitle: "Línea Vision",
    cardSub: "Vision 1.0 → 4.0 · App Bridge · middleware de IA",
    app: "App",
    yield: "Yield",
    token: "Token",
    vault: "Vault",
  },
  presale: {
    kicker: "Preventa · Tesorería",
    title: "Kits de hardware + tokens",
    leadBefore: "Precio oficial:",
    leadAfter:
      "por 1 $VISION. Conecta Phantom o Backpack y envía SOL a la tesorería de recepción. Las suscripciones mensuales aceptan de forma nativa $AETH y $VISION.",
    nativePay:
      "Pago de las suscripciones mensuales de la app: $AETH y $VISION se aceptan de forma nativa.",
  },
  checkout: {
    treasuryKicker: "Tesorería on-chain · cartera de recepción",
    treasuryBody:
      "El SOL se envía a esta Phantom de recepción (relayer). Verifica la dirección en la cartera antes de firmar.",
    copy: "Copiar dirección",
    copied: "¡Copiado!",
    audit: "Auditar en Solscan",
    progress: "Progreso de la fase",
    checkoutTitle: "Checkout de preventa",
    liveRate: "Tasa en vivo:",
    liveQuote: "cotización live",
    fallbackQuote: "fallback US$ 150",
    wallets: "Phantom · Backpack",
    amountLabel: "Cantidad en SOL",
    slider: "Slider de SOL",
    usd: "USD",
    bonus: "Bonus",
    youReceive: "Recibes",
    confirming: "Confirmando en la cartera…",
    buySol: "Buy with Solana",
    connectWallet: "Conectar Phantom / Backpack",
    legal:
      "Transferencia nativa de SOL a la tesorería de recepción. $VISION se acredita según la tasa de esta fase; no es una oferta de valores.",
    paySol: "Pagar con SOL",
    payPix: "Pagar con PIX",
    destLabel: "Cartera Solana que recibe $VISION",
    destPlaceholder: "Pega la dirección o conecta Phantom",
    pixHint:
      "Abre la app del banco, pega el código PIX y espera. $VISION llega a la cartera de arriba tras confirmar el pago.",
    pixCopy: "Copiar código PIX",
    pixWaiting: "Esperando el pago PIX…",
    pixSimulate: "Simular PIX (dev)",
    creatingOrder: "Creando pedido…",
    fulfillPending: "Pago confirmado. Enviando $VISION…",
    fulfillWaitWallet:
      "Pago registrado. La transferencia espera la cartera de distribución.",
    fulfillOk: "$VISION enviado a tu cartera.",
    select: "Seleccionar",
    contribution: "Aporte Vision",
    visionBonus: "$VISION · bonus",
  },
  tiers: {
    early: {
      badge: "Smart Audio",
      perk1: "Asignación Vision 1.0 · audio esencial",
      perk2: "Equivalente a 3 meses de suscripción de la app de IA",
    },
    pro: {
      badge: "AI Camera",
      perk1: "Asignación Vision 2.0 · cámara 12MP multimodal",
      perk2: "Equivalente a 6 meses de suscripción de la app",
    },
    master: {
      badge: "Ejecutivo",
      perk1: "Asignación Vision 3.0 · titanio y conducción ósea",
      perk2: "Suscripción vitalicia de la app + 10.000 $AETH en mainnet",
    },
    apex: {
      badge: "Flagship AR",
      perk1: "Asignación Vision 4.0 · Micro-OLED AR neural",
      perk2: "Asignación prioritaria + suscripción vitalicia + 10.000 $AETH",
    },
  },
  hardware: {
    kicker: "Línea Vision",
    title: "Cuatro generaciones. Un middleware.",
    lead: "Vision 1.0 a Vision 4.0 te conectan a la IA descentralizada de Aether. Cada card dispara una transferencia nativa de SOL a la Squads Multisig.",
    connectBuy: "Conectar y comprar",
    visualAlt: "Visual de estudio de {name}",
    v1: {
      tag: "Esencial",
      category: "Entry-Level · Smart Audio",
      headline: "IA cotidiana, sin cámara y sin excesos.",
      body: "La puerta de entrada. Audio bidireccional, comandos de voz y App Bridge — inteligencia wearable esencial con la mejor relación calidad-precio.",
      frame: "Montura TR90 clásica, patillas ergonómicas, chasis ligero.",
      cta: "Asegurar asignación",
      specs: [
        { label: "Cámara", value: "No incluye" },
        { label: "Audio", value: "Bidireccional open-ear" },
        { label: "Interfaz", value: "Voz + App Bridge" },
        { label: "Material", value: "TR90 · patillas ergonómicas" },
      ],
    },
    v2: {
      tag: "Equilibrio",
      category: "AI Camera · Visión multimodal",
      headline: "Captura visual discreta y análisis en tiempo real.",
      body: "El punto de equilibrio. Visión computacional, traducción y contexto multimodal en el middleware de IA — la experiencia completa de gafas inteligentes.",
      frame: "TR90 de alta densidad mate, microcámara 12MP en la bisagra.",
      cta: "Buy Tier",
      specs: [
        { label: "Cámara", value: "12MP camuflada en la bisagra" },
        { label: "IA", value: "Visión computacional multimodal" },
        { label: "Live", value: "Traducción y análisis en tiempo real" },
        { label: "Material", value: "TR90 alta densidad · mate" },
      ],
    },
    v3: {
      tag: "Lujo",
      category: "Futurista invisible · Ejecutivo",
      headline: "Titanio, conducción ósea y discreción de firma.",
      body: "El modelo ejecutivo. Look de montura de alta gama, audio por conducción ósea y gestos hápticos — máxima elegancia con tecnología de punta.",
      frame: "Titanio ultrafino, conducción ósea acústica, gestos táctiles en las patillas.",
      cta: "Asegurar asignación",
      specs: [
        { label: "Audio", value: "Conducción ósea acústica" },
        { label: "Gestos", value: "Control háptico en las patillas" },
        { label: "Display", value: "Air-display discreto" },
        { label: "Material", value: "Titanio ultrafino" },
      ],
    },
    v4: {
      tag: "Halo",
      category: "Flagship holográfico · Micro-OLED AR",
      headline: "AR contextual, neural tracking y la cúspide de la línea.",
      body: "El flagship. Lentes electrocrómicas, cámaras estéreo de profundidad, proyectores Micro-OLED y tracking neural — realidad aumentada flotante en el middleware Aether.",
      frame: "Titanio aeroespacial y fibra de carbono. El ápice de Aether Vision en Web3.",
      cta: "Buy Tier",
      specs: [
        { label: "Display", value: "Proyectores Micro-OLED AR" },
        { label: "Visión", value: "Cámaras estéreo de profundidad" },
        { label: "Neural", value: "Tracking contextual" },
        { label: "Material", value: "Titanio aeroespacial · carbono" },
      ],
    },
  },
  vision: {
    kicker: "Visión de producto",
    title: "Estrategia de valorización AETHER",
    lead: "Hardware accesible ahora, tesorería transparente y un ciclo en el que las ventas alimentan la quema de tokens y el siguiente modelo.",
    points: [
      {
        title: "Vision 1.0 a Vision 4.0",
        body: "Una línea progresiva: del smart audio esencial al flagship Micro-OLED AR — función en el centro, entrada accesible, cúspide tecnológica arriba.",
      },
      {
        title: "Valorización continua del ecosistema",
        body: "El objetivo principal es valorizar el ecosistema AETHER y desarrollar de forma progresiva modelos de gafas superiores.",
      },
      {
        title: "Buyback & Burn automatizado",
        body: "Con el éxito de ventas del primer lote, el mecanismo compra y quema $AETH y $VISION, reduciendo la oferta con el uso real.",
      },
      {
        title: "Caja para la próxima generación",
        body: "Los ingresos recargan la tesorería del proyecto para desarrollar y lanzar modelos aún más avanzados.",
      },
    ],
  },
  tokenomics: {
    kicker: "Tokenomics transparente",
    title: "$VISION · 1.000.000.000",
    lead: "Supply fijo de 1 mil millones. Preventa entre 10% y 20% a $0,05. Liquidez, recompensas de la app y equipo con asignación pública.",
    items: [
      {
        label: "Preventa / Soft Launch",
        value: "10–20%",
        detail:
          "100M a 200M $VISION a $0,05. Recaudación estimada de hasta $10M para financiar gafas y la app durante años.",
      },
      {
        label: "Liquidez Raydium",
        value: "40%",
        detail:
          "400M $VISION en el pool DEX, asignados con los fondos recaudados tras la preventa.",
      },
      {
        label: "Ecosistema y recompensas",
        value: "30%",
        detail:
          "300M $VISION para cashback, bonus de referidos y recompensas DePIN de la app.",
      },
      {
        label: "Equipo y marketing",
        value: "10%",
        detail:
          "100M $VISION bloqueados para el equipo de desarrollo y la expansión a largo plazo.",
      },
    ],
    note: "$AETH entra en la mainnet nativa; $VISION opera la app y la liquidez en Solana. Ambos entran en el ciclo de Buyback & Burn tras el primer lote.",
  },
  updates: {
    kicker: "Desarrollo y actualizaciones",
    title: "Build constante, en X oficial",
    leadBefore:
      "No publicamos un roadmap estático. Las actualizaciones de desarrollo son continuas y salen en el canal oficial",
    leadAfter: ".",
    pillar: "Pilar",
    items: [
      {
        title: "App Bridge",
        body: "Integración Bluetooth entre el smartphone y las gafas Aether Vision — audio, voz y sesión de la app de IA en un solo flujo.",
      },
      {
        title: "Primer lote",
        body: "Recaudación para fabricar y lanzar el primer lote de gafas, con costo accesible y la función en el centro del producto.",
      },
      {
        title: "Mainnet $AETH",
        body: "Recaudación estratégica para el lanzamiento de $AETH con blockchain nativa, además del token $VISION en Solana.",
      },
    ],
  },
  trust: {
    label: "Red y tesorería",
    solana: "Powered by Solana",
    squads: "Secured by Squads Multisig",
  },
  footer: {
    rights: "© 2026 Aether Vision. Todos los derechos reservados.",
    disclaimer:
      "La adquisición de Vouchers/Kits en la preventa representa la compra anticipada de licencias de uso de la aplicación de inteligencia artificial y/o dispositivos físicos, y no constituye una oferta pública de valores ni inversiones financieras especulativas.",
  },
  wallet: {
    body: "No se detectó ninguna cartera Solana. Instala Phantom o Backpack para participar en la preventa on-chain.",
    phantom: "Instalar Phantom",
    backpack: "Instalar Backpack",
    later: "Ahora no",
  },
  receipt: {
    close: "Cerrar",
    closeReceipt: "Cerrar recibo",
    title: "Aporte confirmado on-chain",
    withTier: "La asignación {tier} se envió a la tesorería de recepción.",
    noTier: "La transferencia de SOL se confirmó en la red Solana.",
    solscan: "Ver en Solscan",
  },
  errors: {
    wallet_missing:
      "No se encontró una cartera Solana. Instala Phantom o Backpack para continuar.",
    min_sol: "Mínimo de {min} SOL por transacción.",
    invalid_sol: "Cantidad de SOL inválida.",
    cancelled: "Transacción cancelada en la cartera.",
    insufficient:
      "Saldo insuficiente de SOL para la transacción y las comisiones de red.",
    simulation: "Falló la simulación de la transacción.",
    expired:
      "La red tardó demasiado en confirmar. Si el SOL ya salió de la cartera, no vuelvas a pagar — la tesorería puede haberlo recibido.",
    generic: "Error en la transacción.",
  },
  lang: {
    label: "Idioma",
    en: "EN",
    pt: "PT",
    es: "ES",
  },
};
