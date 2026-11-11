"""Official Google OAuth 2.0 (google-auth) with refresh_token persistence."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from app.auth.credential_store import CredentialStore, get_credential_store
from app.config import Settings, get_settings

logger = logging.getLogger("aether.auth.google_oauth")

GOOGLE_SCOPES: tuple[str, ...] = (
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive.readonly",
)


class GoogleOAuthService:
    def __init__(
        self,
        settings: Settings | None = None,
        store: CredentialStore | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.store = store or get_credential_store()

    def configured(self) -> bool:
        return bool(self._client_config())

    def _client_config(self) -> dict[str, Any] | None:
        secrets_file = (self.settings.google_oauth_client_secrets_file or "").strip()
        if secrets_file:
            path = Path(secrets_file).expanduser()
            if not path.is_absolute():
                backend_root = Path(__file__).resolve().parent.parent.parent
                path = (backend_root / path).resolve()
            if path.is_file():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError) as exc:
                    logger.error("invalid GOOGLE_OAUTH_CLIENT_SECRETS_FILE: %s", exc)
                    return None
                if "web" in data or "installed" in data:
                    return data

        client_id = (self.settings.google_oauth_client_id or "").strip()
        client_secret = (self.settings.google_oauth_client_secret or "").strip()
        if not client_id or not client_secret:
            return None
        if "placeholder" in client_id.lower() or "placeholder" in client_secret.lower():
            return None
        redirect = (self.settings.google_oauth_redirect_uri or "").strip()
        return {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect],
            }
        }

    def _redirect_uri(self) -> str:
        return (self.settings.google_oauth_redirect_uri or "").strip()

    def _flow(self, *, state: str | None = None) -> Flow:
        config = self._client_config()
        if not config:
            raise RuntimeError(
                "Google OAuth not configured — set GOOGLE_OAUTH_CLIENT_ID + "
                "GOOGLE_OAUTH_CLIENT_SECRET (or GOOGLE_OAUTH_CLIENT_SECRETS_FILE)"
            )
        flow = Flow.from_client_config(config, scopes=list(GOOGLE_SCOPES), state=state)
        flow.redirect_uri = self._redirect_uri()
        return flow

    def authorization_url(self, *, profile_id: str = "local") -> dict[str, str]:
        flow = self._flow()
        state = f"profile:{profile_id}"
        auth_url, state_out = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state,
        )
        return {"authorization_url": auth_url, "state": state_out, "profile_id": profile_id}

    def exchange_code(
        self,
        *,
        code: str,
        state: str | None = None,
        profile_id: str | None = None,
    ) -> dict[str, Any]:
        resolved_profile = profile_id or "local"
        if state and state.startswith("profile:"):
            resolved_profile = state.split(":", 1)[1] or resolved_profile
        flow = self._flow(state=state)
        flow.fetch_token(code=code)
        creds = flow.credentials
        payload = self._creds_to_dict(creds)
        prior = self.store.load(resolved_profile) or {}
        if not payload.get("refresh_token") and prior.get("refresh_token"):
            payload["refresh_token"] = prior["refresh_token"]
        email = self._fetch_email(creds)
        if email:
            payload["email"] = email
        self.store.save(resolved_profile, payload)
        return {
            "ok": True,
            "profile_id": resolved_profile,
            "email": email,
            "scopes": payload.get("scopes") or list(GOOGLE_SCOPES),
            "has_refresh_token": bool(payload.get("refresh_token")),
        }

    def load_credentials(self, profile_id: str = "local") -> Credentials | None:
        data = self.store.load(profile_id)
        if not data:
            return None
        info = {
            "token": data.get("token"),
            "refresh_token": data.get("refresh_token"),
            "token_uri": data.get("token_uri") or "https://oauth2.googleapis.com/token",
            "client_id": data.get("client_id") or self.settings.google_oauth_client_id,
            "client_secret": data.get("client_secret") or self.settings.google_oauth_client_secret,
            "scopes": data.get("scopes") or list(GOOGLE_SCOPES),
        }
        if not info["client_id"] or not info["client_secret"]:
            cfg = self._client_config() or {}
            block = cfg.get("web") or cfg.get("installed") or {}
            info["client_id"] = info["client_id"] or block.get("client_id")
            info["client_secret"] = info["client_secret"] or block.get("client_secret")
        creds = Credentials.from_authorized_user_info(info, scopes=list(GOOGLE_SCOPES))
        if creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                self.store.save(profile_id, self._creds_to_dict(creds, email=data.get("email")))
            except Exception as exc:  # noqa: BLE001
                logger.exception("Google token refresh failed profile=%s", profile_id)
                raise RuntimeError(f"Google token refresh failed: {exc}") from exc
        return creds

    def disconnect(self, profile_id: str = "local") -> bool:
        return self.store.delete(profile_id)

    def status(self, profile_id: str = "local") -> dict[str, Any]:
        base = self.store.status(profile_id)
        return {
            **base,
            "oauth_configured": self.configured(),
            "redirect_uri": self._redirect_uri(),
            "scopes_requested": list(GOOGLE_SCOPES),
            "maps_api_key_configured": bool(
                (self.settings.google_maps_api_key or "").strip()
                and "placeholder" not in (self.settings.google_maps_api_key or "").lower()
            ),
            "login_path": "/auth/google/login",
            "start_path": "/auth/google/start",
            "callback_path": "/auth/google/callback",
            "uses_env_client_credentials": True,
            "workspace_uses_session_token": True,
        }

    def start_url_query(self, profile_id: str = "local") -> str:
        return "/auth/google/login?" + urlencode({"profile_id": profile_id})

    @staticmethod
    def _creds_to_dict(creds: Credentials, *, email: str | None = None) -> dict[str, Any]:
        expiry: str | None = None
        if creds.expiry:
            exp = creds.expiry
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            expiry = exp.astimezone(timezone.utc).isoformat()
        out: dict[str, Any] = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or GOOGLE_SCOPES),
            "expiry": expiry,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        if email:
            out["email"] = email
        return out

    @staticmethod
    def _fetch_email(creds: Credentials) -> str | None:
        try:
            from googleapiclient.discovery import build

            service = build("oauth2", "v2", credentials=creds, cache_discovery=False)
            info = service.userinfo().get().execute()
            email = info.get("email")
            return str(email) if email else None
        except Exception:  # noqa: BLE001
            logger.debug("could not fetch Google userinfo email", exc_info=True)
            return None


@lru_cache
def get_google_oauth_service() -> GoogleOAuthService:
    return GoogleOAuthService()
