# Cloud sync + vector memory

Python adaptation of the Node sketch (`/server/src/cloud/`, `/server/src/memory/cloudVector.ts`).

## What syncs

| Surface | Store | Isolation |
| --- | --- | --- |
| Auth / identity | Supabase Auth JWT (or `X-Aether-User-Id` under local unlock) | `user_id` |
| Session prefs + HUD meta | `aether_sessions` | PK `user_id` |
| Message / HUD events | `aether_hud_events` + Realtime channel `hud:{user_id}` | `user_id` |
| Episodic vectors | Pinecone namespace **or** Qdrant payload filter | `user_id` |

Live PCM audio stays on FastAPI `/ws/live` and is **not** routed through Supabase.

## Latency

- **Target &lt;100ms HUD:** browser → Supabase Realtime WebSocket in the **same region** as the project (`VITE_SUPABASE_*`).
- **HTTP mirror / poll** (`POST/GET /cloud/hud`): typically **80–250ms+** (catch-up / server fan-out).
- Cross-region Realtime commonly exceeds 100ms; co-locate client and Supabase region when that budget matters.

## Setup

1. Create a Supabase project; paste `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `SUPABASE_SERVICE_ROLE_KEY` into `backend/.env`.
2. Run `schema.sql` in the SQL editor.
3. Mirror anon URL/key into `client/.env` as `VITE_SUPABASE_*` for browser Realtime.
4. For vectors: set either Pinecone (`PINECONE_API_KEY` + `PINECONE_HOST`) or Qdrant (`QDRANT_URL` [+ `QDRANT_API_KEY`]). `CLOUD_VECTOR_BACKEND=auto` selects the first configured.

Empty keys keep local JSON memory + vector file working offline — no invented secrets.

## HTTP map

- `GET /cloud/status`
- `GET|PUT /cloud/session`
- `GET|POST /cloud/hud`
- `POST /cloud/vector/upsert|query`
- `GET /cloud/vector/stats`

Pipeline hooks: Live turn upsert + summarizer + `/memory` preference PUT dual-write to cloud vectors when configured.
