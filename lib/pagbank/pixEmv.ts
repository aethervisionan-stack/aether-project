/**
 * Validate a Pix copia-e-cola EMV string from PagBank.
 * Rejects empty, mock placeholders, and obviously forged payloads banks refuse.
 */
/** Returns true when `text` is a non-placeholder Pix copia-e-cola EMV. */
export function isValidPixEmv(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const t = text.trim();
  if (t.length < 60) return false;
  if (!t.startsWith("000201")) return false;
  // Must look like BR Pix (Central Bank or PagBank host payload)
  const lower = t.toLowerCase();
  if (
    !lower.includes("br.gov.bcb.pix") &&
    !lower.includes("br.com.pagbank") &&
    !lower.includes("pagseguro.com")
  ) {
    return false;
  }
  // Reject known mock / placeholder emission
  if (/MOCK_/i.test(t)) return false;
  if (/6304ABCD\s*$/i.test(t)) return false;
  if (/Arquetipo Quiz/i.test(t) && /6304ABCD/i.test(t)) return false;
  return true;
}
