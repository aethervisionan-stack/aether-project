/** Unlock price in BRL centavos (R$ 3,00). */
export const PAGBANK_UNLOCK_AMOUNT_CENTAVOS = 300;

/** Mentor Estratégico — Passe 30 dias (R$ 19,90). */
export const PAGBANK_MENTOR_AMOUNT_CENTAVOS = 1990;

export type PagbankProduct = "unlock" | "mentor";

export function pagbankProductMeta(product: PagbankProduct = "unlock") {
  if (product === "mentor") {
    return {
      product: "mentor" as const,
      amountCentavos: PAGBANK_MENTOR_AMOUNT_CENTAVOS,
      amountLabel: "R$ 19,90",
      itemReference: "mentor-pass-30d",
      itemName: "Passe Mentor Estratégico 30 dias",
      chargeDescription: "Passe 30 dias — Mentor Estratégico de Arquétipos",
    };
  }
  return {
    product: "unlock" as const,
    amountCentavos: PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
    amountLabel: "R$ 3,00",
    itemReference: "archetype-unlock",
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
