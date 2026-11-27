# Real integration verify (Windows)

## Ports

| Service | Preferred | Classic |
| --- | --- | --- |
| API | **8001** | 8000 |
| HUD | **5174** | 5173 |
| Landing | **3010** | 3000 |

Examples below use preferred ports. Swap to classic if your Google Console redirect / local tabs still point at `:8000` / `:5173`. Launchers never kill foreign processes.

## 1. Env check (no secrets printed)

```powershell
cd C:\Users\Next\aether-project\backend
.\.venv\Scripts\activate
python scripts\verify_env.py
```

Expect `RESULT: OAuth-ready` when `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and redirect URI are consistent. The script flags URI mismatches between `GOOGLE_OAUTH_REDIRECT_URI` and `GOOGLE_REDIRECT_URI`.

## 2. Start backend

Preferred (isolated):

```powershell
cd C:\Users\Next\aether-project
npm run dev:api
# or:
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Classic (if Console still uses `:8000`):

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health: http://127.0.0.1:8001/health

## 3. Google login (canonical path)

Open in a browser:

**http://127.0.0.1:8001/auth/google/login**

Aliases / helpers:

| URL | Role |
| --- | --- |
| http://127.0.0.1:8001/auth/google/login | Canonical OAuth start (redirects to Google) |
| http://127.0.0.1:8001/auth/google/start | Alias of `/login` |
| http://127.0.0.1:8001/auth/google/status | Session connected? |
| http://127.0.0.1:8001/auth/google/config | Public config (no secrets) |
| http://127.0.0.1:8001/auth/google/callback | Console redirect URI target |

Google Cloud Console authorized redirect URI must match env exactly, e.g.:

`http://127.0.0.1:8001/auth/google/callback`

(or `:8000` if you run classic).

## 4. Workspace / Maps test routes (after login)

Direct FastAPI:

```text
GET http://127.0.0.1:8001/tools/gmail/test
GET http://127.0.0.1:8001/tools/calendar/test
GET http://127.0.0.1:8001/tools/drive/test
GET http://127.0.0.1:8001/tools/maps/test
GET http://127.0.0.1:8001/tools/google/test
```

Via Vite `/api` proxy (same handlers):

```text
GET http://127.0.0.1:5174/api/tools/gmail/test
GET http://127.0.0.1:5174/api/tools/calendar/test
GET http://127.0.0.1:5174/api/tools/drive/test
GET http://127.0.0.1:5174/api/tools/maps/test
```

E2E script (backend running):

```powershell
cd C:\Users\Next\aether-project\backend
python scripts\e2e_google_tools.py
```

Gmail/Calendar/Drive return `401` until OAuth completes. Maps needs `GOOGLE_MAPS_API_KEY` (expect graceful `503` without key).

## 5. OS Bridge inspector + pytest

```powershell
cd C:\Users\Next\aether-project\backend
.\.venv\Scripts\activate
pytest tests\test_os_bridge_native.py -q
```

Inspector (active driver `mock` | `desktop` | `android`):

```text
GET http://127.0.0.1:8001/tools/os-bridge/inspector
GET http://127.0.0.1:8001/tools/os-bridge/status
```

Look for `active_driver` in the JSON.
