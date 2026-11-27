# InfinitePay Checkout Integrado

As of 2026-11-26, InfinitePay **Checkout Integrado** (`POST https://api.checkout.infinitepay.io/links`) returns only `{ url }` — a hosted checkout page.

Official docs / help state there is **no API that returns Pix copia-e-cola / BR Code / QR payload** for embedding. Pix QR appears only on InfinitePay’s hosted payment page.

This app therefore uses **same-tab redirect** to the InfinitePay checkout URL. Unlock happens via:

1. `redirect_url` return (`/?payment_return=1` + `order_nsu` / `transaction_nsu` / `slug`) → `POST /api/infinitepay/verify` → `payment_check`
2. InfinitePay webhook → `POST /api/infinitepay/webhook`

Required env (either is enough for create-link; API key enables advanced options):

- `INFINITEPAY_HANDLE` — InfiniteTag without `$`
- `INFINITEPAY_API_KEY` — Checkout Integrado API key

No PagBank / EMV fallback is used.
