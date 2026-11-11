# Google OAuth + Workspace tools

## Auth endpoints

| Route | Role |
| --- | --- |
| `GET /auth/google/login` | Start OAuth (canonical) |
| `GET /auth/google/start` | Alias of `/login` |
| `GET /auth/google/callback` | OAuth redirect handler |
| `GET /auth/google/status` | Connection status (no secrets) |
| `GET /auth/google/config` | Public config (no secrets) |
| `DELETE /auth/google/disconnect` | Drop stored session token |

## Credential split (production rule)

1. **Login / callback** use **only** env app credentials:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - optional `GOOGLE_OAUTH_CLIENT_SECRETS_FILE` (JSON) as alternative
2. **Workspace tools** (Gmail / Calendar / Drive) use the **encrypted per-user session token** from `GOOGLE_TOKEN_DIR` (Fernet via `GOOGLE_TOKEN_FERNET_KEY`) — never the client secret.
3. **Maps** uses `GOOGLE_MAPS_API_KEY` (Maps Platform), not user OAuth scopes.

## Required env (placeholders only in `.env.example`)

```env
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8000/auth/google/callback
GOOGLE_TOKEN_FERNET_KEY=
GOOGLE_TOKEN_DIR=data/google_tokens
GOOGLE_MAPS_API_KEY=
```

Put real values only in gitignored `backend/.env`. Never commit secrets.

## DEV fallback

When OAuth is **not** configured or the user has not connected:

- Email / calendar tool paths fall back to **mock** calendar bridge (documented DEV fallback).
- Drive / Maps return clear auth / API-key errors instead of inventing data.

Once a session token exists, `HybridCalendarBridge` prefers live Google APIs.

## Redirect URI

Canonical: `GOOGLE_OAUTH_REDIRECT_URI`  
Also accepted: `GOOGLE_REDIRECT_URI`

## Verify + test routes

```powershell
cd backend
python scripts\verify_env.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# browser:
#   http://127.0.0.1:8000/auth/google/login
# then:
#   GET /tools/gmail/test
#   GET /tools/calendar/test
#   GET /tools/drive/test
#   GET /tools/maps/test
python scripts\e2e_google_tools.py
```

Full Windows runbook: [verify-integration.md](verify-integration.md).

