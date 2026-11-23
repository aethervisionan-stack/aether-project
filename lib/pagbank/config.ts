/** Unlock price in BRL centavos (R$ 3,00). */
export const PAGBANK_UNLOCK_AMOUNT_CENTAVOS = 300;

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
