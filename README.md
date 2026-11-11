# Aether Vision — Live modular stack

Monorepo root keeps the existing Next.js landing. This document covers the **Gemini Live** scaffold:

| Path | Role |
| --- | --- |
| `backend/` | FastAPI + official `google-genai` Live session |
| `client/` | Vite 6 + TypeScript Vanilla (PCM mic / playback + telemetry) |

```
Headset mic (PCM 16-bit mono @ 16 kHz)
  → client FifoRetentionBuffer (1.5 s cap)
  → WebSocket /api/ws/live  (Vite proxy)
  → FastAPI /ws/live
  → google-genai Live (gemini-3.8-live, api_version=v1beta)
  → PCM @ 24 kHz
  → client GaplessPcmPlayer
```

## WebSocket path

- **Browser:** `ws://127.0.0.1:5173/api/ws/live` (same-origin; default in `GeminiLiveService`)
- **Vite proxy:** `/api` → `http://127.0.0.1:8000` with `ws: true`, rewrite strips `/api`
- **FastAPI:** `/ws/live`

Override with `VITE_LIVE_WS_URL` (e.g. `ws://127.0.0.1:8000/ws/live`).

## Run locally

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # set GEMINI_API_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 2. Client

```bash
cd client
npm install
cp .env.example .env        # optional VITE_LIVE_WS_URL
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173), pair a Bluetooth headset as OS default I/O, click **Connect Live**.

## Modules

**Backend**

- `app/config.py` — env + Aether system instruction (short HUD replies)
- `app/genai/session.py` — `GeminiLiveSession` (`aio.live.connect`)
- `app/websocket/live.py` — `/ws/live` handler
- `app/main.py` — FastAPI entry

**Client**

- `src/services/GeminiLiveService.ts` — WebSocket + capture/playback wiring
- `src/audio/PcmCapture.ts` — continuous mic → PCM 16 kHz
- `src/audio/FifoRetentionBuffer.ts` — 1.5 s FIFO, drops oldest on overflow
- `src/audio/GaplessPcmPlayer.ts` — gapless 24 kHz scheduling
- `src/audio/TelemetryMonitor.ts` — RTT, WS state, FIFO discards, queue depth (console + HUD)

## Env

| Variable | Where | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | `backend/.env` | Required for Live |
| `GEMINI_LIVE_MODEL` | `backend/.env` | Default `gemini-3.8-live` |
| `GEMINI_API_VERSION` | `backend/.env` | Default `v1beta` (required for Live WS) |
| `VITE_LIVE_WS_URL` | `client/.env` | Optional absolute WS URL |
| `STRIPE_SECRET_KEY` | `backend/.env` | Required for hosted Checkout `Session.create` + webhook |
| `STRIPE_PUBLISHABLE_KEY` | `backend/.env` | Optional for redirect Checkout (Stripe.js / Elements only); incomplete `pk_test_` is fine |
| `STRIPE_WEBHOOK_SECRET` | `backend/.env` | Stripe CLI / Dashboard signing secret |
| `STRIPE_PRICE_ID` | `backend/.env` | Optional; ignored while `STRIPE_FORCE_UNIT_AMOUNT=true` |
| `STRIPE_CURRENCY` | `backend/.env` | **TEMP TEST:** `brl` (restore `usd`) |
| `STRIPE_UNIT_AMOUNT_CENTS` | `backend/.env` | **TEMP TEST:** `1` = R$0,01 (restore e.g. `1999`) |
| `STRIPE_FORCE_UNIT_AMOUNT` | `backend/.env` | **TEMP TEST:** `true` forces dynamic price_data |
| `BILLING_DEV_UNLOCK` | `backend/.env` | Local simulate unlock when Stripe unset |
| `BYPASS_SUBSCRIPTION_CHECK` | `backend/.env` | **TEMP:** `true` unlocks Live/AI without Subscribe (set `false` before `sk_live_`) |
| `TREASURY_WALLET_ADDRESS` | `backend/.env` | 70% Solana destination |
| `VISION_BURN_ADDRESS` | `backend/.env` | 30% burn destination |
| `VISION_MINT_ADDRESS` | `backend/.env` | VISION mint |
| `SOLANA_RPC_URL` | `backend/.env` | Operational / distribution RPC (default devnet) |
| `TREASURY_RPC_URL` | `backend/.env` | Preferred mainnet RPC for treasury HUD; backend proxies `/billing/treasury-balance` with Ankr/PublicNode fallbacks |
| `SOLANA_PAYER_SECRET_KEY` | `backend/.env` | Empty = **stub mode** (no real transfers) |

Persona: **Aether** — 1–3 sentence, direct, actionable replies for HUD / spatial audio.

## Subscription (Stripe) + tokenomics (Solana)

Traditional **card** checkout unlocks the Gen-1 Live HUD — no crypto wallet required.

### Flow

1. Client **Subscribe** → `POST /billing/checkout` → Stripe Checkout (subscription).
2. Stripe webhook `POST /billing/webhook` (`checkout.session.completed`) → entitlement granted instantly.
3. Background job plans **70% treasury / 30% burn** VISION distribution on Solana.
4. Client stores `subscriber_id` in `localStorage` and shows Connect Live + chat.

### Gen-1 entitlement assumptions

- Access key = Stripe customer id (preferred), else Checkout session id, else `dev_*`.
- Stored in `backend/data/entitlements.json` (gitignored). Not multi-device auth.
- Instant unlock on webhook; ~31-day expiry placeholder unless you wire subscription periods.

### Local without Stripe keys

Leave `STRIPE_*` empty and keep `BILLING_DEV_UNLOCK=true`. The UI shows **Simulate unlock**, which grants access and runs the Solana job in **stub** mode.

### TEMP: bypass subscription paywall (AI testing)

Set `BYPASS_SUBSCRIPTION_CHECK=true` in `backend/.env` and restart uvicorn. The HUD unlocks Connect Live + chat without Subscribe; `/billing/entitlement` returns granted. Stripe Checkout routes stay in place — flip the flag to `false` when `sk_live_` arrives to restore the real paywall.

### Enable real Stripe (test)

1. Copy a real `STRIPE_SECRET_KEY` (`sk_test_…`) into `backend/.env` (never commit it). Mock Checkout turns off automatically. Publishable key is not required for hosted Checkout redirect.
2. `stripe listen --forward-to localhost:8000/billing/webhook` and set `STRIPE_WEBHOOK_SECRET`.
3. Restart uvicorn. Client **Subscribe** redirects to Stripe-hosted Checkout (`checkout.stripe.com`).
4. Checkout uses `billing_address_collection=auto` and **no** `shipping_address_collection` / `allowed_countries` allowlist, so the country/region selector stays global (United States included). TEMP TEST amount stays **R$0,01 BRL** — US/international cards work via issuer FX; we do not invent multi-currency Prices.

### Flip test → live (`.env` only — no code changes)

Waiting on MEI fiscal docs before pasting production keys. When ready:

1. In `backend/.env` replace `STRIPE_SECRET_KEY=sk_test_…` with your real `sk_live_…` (never invent keys; never commit).
2. Optionally set `STRIPE_PUBLISHABLE_KEY=pk_live_…` (only needed for Stripe.js / Elements — hosted Checkout redirect works with secret alone).
3. Set production `STRIPE_WEBHOOK_SECRET=whsec_…` for the live webhook endpoint.
4. Restore official pricing (example): `STRIPE_CURRENCY=usd`, `STRIPE_UNIT_AMOUNT_CENTS=1999`, `STRIPE_FORCE_UNIT_AMOUNT=false`, optional `STRIPE_PRICE_ID=price_…`.
5. Set `BILLING_DEV_UNLOCK=false` for production.
6. Restart uvicorn. `/billing/config` reports `stripe_mode: "live"` (vs `"test"` / `"off"`). No app code edits required.

### Enable real Solana transfers

1. Set `TREASURY_WALLET_ADDRESS`, `VISION_BURN_ADDRESS`, `VISION_MINT_ADDRESS`, `SOLANA_RPC_URL`.
2. Set `SOLANA_PAYER_SECRET_KEY` to a real base58 payer secret you control (**do not invent keys**).
3. `pip install solders solana` (optional deps).
4. Gen-1 validates the payer and prepares the 70/30 plan (`live_prepared`). Extend `app/billing/solana_distribution.py` with SPL transfer instructions once mint decimals are confirmed. With an empty payer secret, the stack stays in safe **stub** mode and logs the planned split.

### Billing modules

- `backend/app/billing/routes.py` — `/billing/config|checkout|webhook|entitlement|dev-unlock`
- `backend/app/billing/stripe_service.py` — Checkout Session helpers
- `backend/app/billing/solana_distribution.py` — 70/30 stub / prepared live
- `backend/app/billing/entitlements.py` — Gen-1 access flag store
- `client/src/services/BillingService.ts` — Subscribe + entitlement client

## Cloud sync + vector memory

Optional Supabase session/HUD sync and per-user Pinecone/Qdrant vectors (ackend/app/cloud/, ackend/app/memory/cloud_vector.py).

- Empty SUPABASE_* / vector keys keep local JSON memory working offline.
- HTTP: /cloud/status, /cloud/session, /cloud/hud, /cloud/vector/*.
- Sub-100ms HUD needs same-region Supabase Realtime WS (VITE_SUPABASE_*); HTTP poll is typically 80–250ms+.
- Live PCM stays on /ws/live and is not routed through Supabase.
- See ackend/app/cloud/README.md and ackend/app/cloud/schema.sql.

