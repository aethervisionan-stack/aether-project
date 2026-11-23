/**
 * Generates a mathematically valid CPF (checksum) for PagBank customer.tax_id.
 * Not a real identity — used only so the Orders API accepts the request
 * without collecting forms from the user (zero-friction Pix).
 */
export function generateValidCPF(): string {
  const n: number[] = [];
  for (let i = 0; i < 9; i++) {
    n.push(Math.floor(Math.random() * 10));
  }
  // Avoid known-invalid all-same sequences
  if (n.every((d) => d === n[0])) {
    n[8] = (n[8] + 1) % 10;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += n[i]! * (10 - i);
  }
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  n.push(d1);

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += n[i]! * (11 - i);
  }
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  n.push(d2);

  return n.join("");
}
