# InfinitePay vs in-app Pix EMV

As of 2026-11-26, InfinitePay **Checkout Integrado** (`POST https://api.checkout.infinitepay.io/links`) returns only `{ url }` — a hosted checkout page.

Official docs / help state there is **no API that returns Pix copia-e-cola / BR Code / QR payload** for embedding. Pix QR appears only on InfinitePay’s hosted payment page. Developer surface is Checkout Integrado + InfiniteTap (presential), not Pix `/cob`.

Undocumented invoice host (`infinitepay-invoice-api…/public/pix`) can return `pix.code` **after** a captcha-gated checkout order — not usable server-side from `create-link`.

Therefore in-app scannable Pix QR uses **PagBank Orders** `qr_codes[].text` (homolog-proven) as the EMV source, while InfinitePay checkout remains available for card / hosted Pix.
