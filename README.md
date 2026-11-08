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

Persona: **Aether** — 1–3 sentence, direct, actionable replies for HUD / spatial audio.
