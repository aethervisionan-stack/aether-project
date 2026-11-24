/**
 * Fixed official PagBank Pix for Opção 1 R$3 curiosity unlock.
 * QR asset: /public/pix-qrcode-pagbank.png (decoded EMV below).
 * Public Pix copia-e-cola — not an API token/secret.
 */

export const FIXED_PIX_QR_SRC = "/pix-qrcode-pagbank.png";

/** Exact one-line EMV decoded from the official PagBank QR PNG. */
export const FIXED_PIX_EMV =
  "00020126600014br.gov.bcb.pix0111467390518010223quiz medieval resultado27600016BR.COM.PAGSEGURO01368E98180E-07E0-45FD-969F-68D0E562F92452048999530398654043.005802BR5925GUILHERME CAMILO DA SILVA6005Bauru62290525PAGS00000030026112413394263042157";

/** Delay before "Já realizei o pagamento" is enabled. */
export const FIXED_PIX_UNLOCK_ENABLE_MS = 4000;
