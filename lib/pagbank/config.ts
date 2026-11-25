/** Diagnóstico completo — R$ 3,00. */
export const PAGBANK_BASIC_AMOUNT_CENTAVOS = 300;
/** Alias legado (status routes / client fallback). */
export const PAGBANK_UNLOCK_AMOUNT_CENTAVOS = PAGBANK_BASIC_AMOUNT_CENTAVOS;

/** Combo diagnóstico + Mentor 30d — R$ 8,90. */
export const PAGBANK_COMBO_AMOUNT_CENTAVOS = 890;

/** Upgrade Mentor (diff após basic) — R$ 5,90. */
export const PAGBANK_MENTOR_UPGRADE_AMOUNT_CENTAVOS = 590;

/** @deprecated use PAGBANK_MENTOR_UPGRADE_AMOUNT_CENTAVOS */
export const PAGBANK_MENTOR_AMOUNT_CENTAVOS =
  PAGBANK_MENTOR_UPGRADE_AMOUNT_CENTAVOS;

export type PagbankProduct = "basic_3" | "combo_890" | "mentor_upgrade";

export type PaywallPlanId = "basic_3" | "combo_890";

export function parsePagbankProduct(raw: unknown): PagbankProduct {
  if (raw === "combo_890") return "combo_890";
  if (raw === "mentor_upgrade" || raw === "mentor") return "mentor_upgrade";
  // basic_3 | unlock | default
  return "basic_3";
}

export function pagbankProductMeta(product: PagbankProduct = "basic_3") {
  if (product === "combo_890") {
    return {
      product: "combo_890" as const,
      amountCentavos: PAGBANK_COMBO_AMOUNT_CENTAVOS,
      amountLabel: "R$ 8,90",
      amountBrl: 8.9,
      itemReference: "archetype-combo-890",
      itemName: "Diagnóstico + Mentor 30 dias",
      chargeDescription:
        "Combo — relatório de arquétipos + Passe Mentor 30 dias",
    };
  }
  if (product === "mentor_upgrade") {
    return {
      product: "mentor_upgrade" as const,
      amountCentavos: PAGBANK_MENTOR_UPGRADE_AMOUNT_CENTAVOS,
      amountLabel: "R$ 5,90",
      amountBrl: 5.9,
      itemReference: "mentor-upgrade-590",
      itemName: "Upgrade Mentor Estratégico 30 dias",
      chargeDescription:
        "Upgrade Mentor 30 dias (diferença após diagnóstico)",
    };
  }
  return {
    product: "basic_3" as const,
    amountCentavos: PAGBANK_BASIC_AMOUNT_CENTAVOS,
    amountLabel: "R$ 3,00",
    amountBrl: 3.0,
    itemReference: "archetype-basic-3",
    itemName: "Relatório de Arquétipos",
    chargeDescription: "Desbloqueio do relatório de arquétipos",
  };
}

export function pagbankToken(): string | undefined {
  return (
    process.env.PAGBANK_TOKEN?.trim() ||
    process.env.PAGSEGURO_TOKEN?.trim() ||
    undefined
  );
}

export function pagbankApiBase(): string {
  const explicit = process.env.PAGBANK_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.PAGBANK_SANDBOX === "true") {
    return "https://sandbox.api.pagseguro.com";
  }
  return "https://api.pagseguro.com";
}

/** Dev/local simulate path — never treat production as auto-on. */
export function pagbankSimulateAllowed(): boolean {
  if (process.env.PAGBANK_ALLOW_SIMULATE === "true") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export function pagbankMockMode(): boolean {
  if (process.env.PAGBANK_MOCK === "true") return true;
  return !pagbankToken();
}
