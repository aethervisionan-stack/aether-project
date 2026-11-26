/**
 * Same-tab redirect to InfinitePay checkout.
 * Prefer location.assign (not window.open — popup blockers).
 */
export function redirectToCheckout(rawUrl: string): void {
  const url = String(rawUrl ?? "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("URL de checkout inválida");
  }
  window.location.assign(url);
}
