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
| `STRIPE_PRICE_ID` / `STRIPE_PRICE_ID_MONTHLY` | `backend/.env` | Monthly Dashboard Price |
| `STRIPE_PRICE_ID_ANNUAL` / `STRIPE_ANNUAL_PRICE_ID` | `backend/.env` | Annual Price id |
| `STRIPE_CURRENCY` | `backend/.env` | Monthly currency |
| `STRIPE_UNIT_AMOUNT_CENTS` | `backend/.env` | Monthly amount (dynamic mode) |
| `STRIPE_ANNUAL_CURRENCY` / `STRIPE_ANNUAL_UNIT_AMOUNT_CENTS` | `backend/.env` | Annual pricing (default `19900`) |
| `STRIPE_FORCE_UNIT_AMOUNT` | `backend/.env` | Force `price_data` instead of Price ids |
| `BILLING_DEV_UNLOCK` | `backend/.env` | Default `false` |
| `BYPASS_SUBSCRIPTION_CHECK` | `backend/.env` | Default `false` |
| `SOLANA_PAY_*` | `backend/.env` | Solana Pay amounts, TTL, webhook secret |
| `VITE_DEV_UNLOCK` | `client/.env` | Default `false` (`true`/`1`/`on` for local HUD) |
| `TREASURY_WALLET_ADDRESS` | `backend/.env` | 70% Solana destination |
| `VISION_BURN_ADDRESS` | `backend/.env` | 30% burn destination |
| `VISION_MINT_ADDRESS` | `backend/.env` | VISION mint |
| `SOLANA_RPC_URL` | `backend/.env` | Operational / distribution RPC (default devnet) |
| `TREASURY_RPC_URL` | `backend/.env` | Preferred mainnet RPC for treasury HUD; backend proxies `/billing/treasury-balance` with Ankr/PublicNode fallbacks |
| `SOLANA_PAYER_SECRET_KEY` | `backend/.env` | Empty = **stub mode** (no real transfers) |

Persona: **Aether** — 1–3 sentence, direct, actionable replies for HUD / spatial audio.

## Subscription (Stripe + Solana Pay) + tokenomics

Stripe (`month`/`year`) or Solana Pay unlocks entitlements with `payment_status=active`. Advanced Tool Registry routes require active payment (HTTP 402).

### Stripe

`POST /billing/checkout` · webhooks (`checkout.session.completed`, `invoice.paid`, subscription lifecycle) · `POST /billing/cancel` · `GET /billing/receipts`.

### Solana Pay

`POST /billing/solana/create-payment` · `POST /billing/solana/verify` · `POST /billing/solana/webhook`.

### Tool gating

`POST /tools/invoke`, `/invoke_many`, `/sandbox`, `/confirm` need `payment_status=active` via `X-Subscriber-Id` or `subscriber_id`. Catalog includes `access.advanced_unlocked`.

### DEV bypasses (off by default)

`BILLING_DEV_UNLOCK`, `BYPASS_SUBSCRIPTION_CHECK`, `VITE_DEV_UNLOCK` — set explicitly for local testing. `/billing/dev-unlock` is blocked with `sk_live_`.
