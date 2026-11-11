"""Shared Google API service builders (sync; call via asyncio.to_thread)."""

from __future__ import annotations

from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import Resource, build

from app.auth.google_oauth import get_google_oauth_service


def credentials_for(profile_id: str = "local") -> Credentials | None:
    return get_google_oauth_service().load_credentials(profile_id)


def build_gmail(creds: Credentials) -> Resource:
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def build_calendar(creds: Credentials) -> Resource:
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def build_drive(creds: Credentials) -> Resource:
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def require_creds(profile_id: str = "local") -> Credentials:
    creds = credentials_for(profile_id)
    if creds is None:
        raise RuntimeError(
            "Google account not connected — visit /auth/google/start after "
            "setting GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET"
        )
    return creds


def api_error_payload(exc: BaseException, *, tool: str, action: str) -> dict[str, Any]:
    return {
        "ok": False,
        "tool": tool,
        "action": action,
        "error": str(exc)[:400],
        "mock": False,
    }
