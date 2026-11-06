import type { Messages } from "./en";

export const es: Messages = {
  nav: {
    hardware: "Hardware",
    presale: "Preventa",
    tokenomics: "Tokenomics",
    vision: "Visión",
    updates: "Actualizaciones",
    secureKit: "Asegurar un kit",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    primary: "Principal",
  },
  hero: {
    kicker: "Ecosistema DePIN · infraestructura Solana",
    title: "Aether Vision",
    headline: "El puente entre hardware HUD táctico y Edge AI en tiempo real",
    body: "Aether Vision es una línea de hardware DePIN en Solana. El primer modelo es simple, funcional y accesible. Las suscripciones de la app se liquidan en el token de utilidad $VISION y en $AETH. Con las ventas, el buyback automático quema ambos tokens y recarga la tesorería para la próxima generación.",
    ctaPresale: "Participar en la preventa",
    ctaHardware: "Ver el hardware",
    cardTitle: "Línea Vision",
    cardSub: "Vision 1.0 → 4.0 · App Bridge · Edge AI en tiempo real",
    app: "App",
    yield: "Mecanismo",
    token: "Token",
    vault: "Custodia",
  },
  presale: {
    kicker: "Preventa · Tesorería",
    title: "Kits de hardware y $VISION",
    leadBefore: "Precio oficial:",
    leadAfter:
      "por $VISION. Conecta Phantom o Backpack y envía SOL a la tesorería de recepción. Las suscripciones mensuales aceptan $AETH y $VISION de forma nativa.",
    nativePay:
      "Pago de las suscripciones mensuales de la app: $AETH y $VISION se aceptan de forma nativa.",
    tge: {
      kicker: "TGE Condicional",
      title: "Liquidez, KYC y auditoría antes de cualquier negociación pública",
      priceLabel: "Precio de la preventa",
      price: "R$ 0,0001",
      priceUnit: " / token",
      priceUsd: "$0.0001 USD",
      ruleLabel: "Regla del TGE",
      rule: "El Token Generation Event (TGE) y la liberación oficial del pool de liquidez en Raydium ocurren solo después del cierre exitoso de la preventa, la inyección del fondo de liquidez, la conclusión del KYC del equipo y la emisión del informe de auditoría del contrato inteligente.",
      steps: [
        "Captación inicial de la preventa",
        "KYC del equipo y auditoría del contrato inteligente, durante la preventa",
        "Conclusión exitosa del KYC y de la auditoría",
        "Inyección del fondo de liquidez",
        "TGE y liberación oficial del pool en Raydium",
      ],
      kycLabel: "Transparencia y seguridad",
      kycBody:
        "El KYC — verificación de identidad del equipo — y la emisión del informe de auditoría del contrato inteligente se realizan por completo durante la preventa y concluyen antes del Token Generation Event (TGE) y de la liberación oficial del pool de liquidez en Raydium. El compromiso es público: ninguna negociación en mercado abierto empieza sin la identidad del equipo verificada y sin la auditoría del contrato concluida.",
      valueLabel: "Propuesta de valor",
      value:
        "Esta secuencia está diseñada para una liquidez ordenada en Raydium, una emisión verificada y una apertura disciplinada de la negociación pública en Solana.",
    },
  },
  checkout: {
    treasuryKicker: "Tesorería on-chain · cartera de recepción",
    treasuryBody:
      "El SOL se envía a esta cartera Phantom de recepción (relayer). Verifica la dirección en la cartera antes de firmar.",
    copy: "Copiar dirección",
    copied: "¡Copiado!",
    audit: "Verificar en Solscan",
    progress: "Progreso de la fase",
    checkoutTitle: "Checkout de preventa",
    liveRate: "Tasa en vivo:",
    liveQuote: "cotización en vivo",
    fallbackQuote: "cotización de referencia: US$ 150",
    wallets: "Phantom · Backpack",
    amountLabel: "Cantidad en SOL",
    slider: "Control de SOL",
    usd: "USD",
    bonus: "Bonus",
    youReceive: "Recibes",
    confirming: "Confirmando en la cartera…",
    buySol: "Comprar con SOL",
    connectWallet: "Conectar Phantom / Backpack",
    legal:
      "Transferencia nativa de SOL a la tesorería de recepción. $VISION se acredita según la tasa de esta fase. No es una oferta de valores.",
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
    deliveryNotice:
      "El envío de los tokens $VISION lo hace manualmente un administrador y puede tardar hasta 24 horas en aparecer en tu cartera después de confirmar el pago.",
    fulfillPending:
      "Pago confirmado. Un administrador envía el $VISION en un plazo de 24 horas.",
    fulfillWaitWallet:
      "Pago registrado. El $VISION lo envía manualmente un administrador en un plazo de 24 horas.",
    fulfillOk: "Pago confirmado. El $VISION puede tardar hasta 24 horas en llegar.",
    select: "Seleccionar",
    contribution: "Aporte Vision",
    visionBonus: "$VISION · bono",
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
    lead: "Vision 1.0 a Vision 4.0 te conectan con la Edge AI descentralizada de Aether Vision. Cada tarjeta dispara una transferencia nativa de SOL a Squads Multisig.",
    connectBuy: "Conectar y comprar",
    v1: {
      tag: "Esencial",
      category: "Entrada · Smart audio",
      headline: "IA cotidiana, sin cámara y sin excesos.",
      body: "La puerta de entrada. Audio bidireccional, comandos de voz y App Bridge: inteligencia wearable esencial, con la mejor relación calidad-precio.",
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
      body: "El punto de equilibrio. Visión computacional, traducción y contexto multimodal en el middleware de Edge AI: la experiencia completa de gafas inteligentes.",
      frame: "TR90 de alta densidad mate, microcámara 12MP en la bisagra.",
      cta: "Asegurar asignación",
      specs: [
        { label: "Cámara", value: "12MP camuflada en la bisagra" },
        { label: "IA", value: "Visión computacional multimodal" },
        { label: "En vivo", value: "Traducción y análisis en tiempo real" },
        { label: "Material", value: "TR90 alta densidad · mate" },
      ],
    },
    v3: {
      tag: "Lujo",
      category: "Ejecutivo discreto",
      headline: "Titanio, conducción ósea y discreción de diseño.",
      body: "El modelo ejecutivo. Montura de alta gama, audio por conducción ósea y gestos hápticos: lo bastante discreto para un uso formal, con hardware de vanguardia.",
      frame: "Titanio ultrafino, conducción ósea acústica y gestos hápticos en las patillas.",
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
      headline: "AR contextual, neural tracking y un HUD táctico.",
      body: "El modelo flagship. Lentes electrocrómicas, cámaras estéreo de profundidad, proyectores Micro-OLED y neural tracking: un HUD táctico flotante en el middleware de Aether Vision.",
      frame: "Titanio aeroespacial y fibra de carbono. La cúspide del hardware Aether Vision.",
      cta: "Asegurar asignación",
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
    title: "Estrategia de valor de Aether",
    lead: "Hardware accesible ahora, tesorería transparente y un ciclo en el que las ventas financian la quema de tokens y el siguiente modelo.",
    points: [
      {
        title: "Vision 1.0 a Vision 4.0",
        body: "Una línea progresiva: del smart audio esencial al HUD táctico Micro-OLED. La función va primero, la entrada es accesible y la cúspide técnica queda en lo más alto.",
      },
      {
        title: "Valor continuo del ecosistema",
        body: "El objetivo central es expandir el ecosistema Aether Vision y lanzar, de forma progresiva, modelos de gafas más avanzados.",
      },
      {
        title: "Buyback y burn automatizados",
        body: "A medida que se vende el primer lote, el mecanismo compra y quema $AETH y $VISION, y reduce la oferta frente al uso real.",
      },
      {
        title: "Tesorería para la próxima generación",
        body: "Los ingresos reponen la tesorería del proyecto para desarrollar y lanzar modelos aún más avanzados.",
      },
    ],
  },
  tokenomics: {
    kicker: "Tokenomics transparente",
    title: "$VISION · 2.000.000.000",
    lead: "Oferta fija de 2.000 millones de $VISION. La preventa asigna del 10% al 20% a US$ 0,0001. Liquidez, recompensas de la app y la asignación del equipo son públicas.",
    items: [
      {
        label: "Preventa / soft launch",
        value: "10–20%",
        detail:
          "200M a 400M de $VISION a US$ 0,0001 por token. Recaudación estimada de US$ 20.000 a US$ 40.000 para financiar las gafas y la app durante años.",
      },
      {
        label: "Liquidez en Raydium",
        value: "40%",
        detail:
          "800M de $VISION en el pool de liquidez de Raydium, emparejados con los fondos recaudados tras la preventa.",
      },
      {
        label: "Ecosistema y recompensas",
        value: "30%",
        detail:
          "600M de $VISION para cashback, bonos de referidos y recompensas del ecosistema DePIN en la app.",
      },
      {
        label: "Equipo y marketing",
        value: "10%",
        detail:
          "200M de $VISION bloqueados para el equipo de desarrollo y la expansión a largo plazo.",
      },
    ],
    note: "$AETH se lanza en la mainnet nativa. $VISION es el token de utilidad de la app y de la liquidez en Solana. Ambos entran en buyback y burn tras el primer lote.",
  },
  updates: {
    kicker: "Desarrollo y actualizaciones",
    title: "Desarrollo continuo, en el X oficial",
    leadBefore:
      "No publicamos un roadmap estático. Las actualizaciones de desarrollo son continuas y se publican en el canal oficial",
    leadAfter: ".",
    pillar: "Pilar",
    items: [
      {
        title: "App Bridge",
        body: "Integración Bluetooth entre el smartphone y las gafas Aether Vision — audio, voz y sesión de la app de IA en un solo flujo.",
      },
      {
        title: "Primer lote",
        body: "Capital para fabricar y lanzar el primer lote de gafas, con un costo accesible y la función en el centro del producto.",
      },
      {
        title: "Mainnet $AETH",
        body: "Captación estratégica para el lanzamiento de $AETH en una red nativa, junto con el token de utilidad $VISION en Solana.",
      },
    ],
  },
  trust: {
    label: "Red y tesorería",
    solana: "Infraestructura Solana",
    squads: "Custodia Squads Multisig",
  },
  footer: {
    rights: "© 2026 Aether Vision. Todos los derechos reservados.",
    disclaimer:
      "La adquisición de vouchers o kits en la preventa es la compra anticipada de licencias de uso de la aplicación de inteligencia artificial y/o de dispositivos físicos. No constituye una oferta pública de valores ni una inversión financiera especulativa.",
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
    deliveryNotice:
      "El envío de los tokens $VISION lo hace manualmente un administrador y puede tardar hasta 24 horas en aparecer en tu cartera después de este pago.",
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
