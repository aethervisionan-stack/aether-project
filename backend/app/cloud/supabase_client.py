"""Minimal Supabase REST helpers (stdlib urllib; no hard supabase-py dep)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from app.config import Settings, get_settings

logger = logging.getLogger("aether.cloud.supabase")


class SupabaseClient:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    @property
    def enabled(self) -> bool:
        return self._settings.supabase_configured()

    def _base(self) -> str:
        return self._settings.supabase_url.strip().rstrip("/")

    def _key(self) -> str:
        sr = self._settings.supabase_service_role_key.strip()
        if sr:
            return sr
        return self._settings.supabase_anon_key.strip()

    def _headers(self, *, prefer: str | None = None) -> dict[str, str]:
        key = self._key()
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Any | None = None,
        prefer: str | None = None,
        timeout: float = 8.0,
    ) -> tuple[int, Any]:
        if not self.enabled:
            return 0, {"ok": False, "reason": "supabase_not_configured"}
        url = f"{self._base()}{path if path.startswith('/') else '/' + path}"
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers=self._headers(prefer=prefer),
            method=method.upper(),
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8") or "null"
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = raw
                return int(resp.status), parsed
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            logger.debug(
                "supabase HTTP %s %s -> %s %s", method, path, exc.code, detail[:240]
            )
            try:
                parsed = json.loads(detail) if detail else {"error": str(exc)}
            except json.JSONDecodeError:
                parsed = {"error": detail or str(exc)}
            return int(exc.code), parsed
        except Exception as exc:
            logger.debug("supabase request failed: %s", exc, exc_info=True)
            return 0, {"error": str(exc)}

    def upsert_rows(
        self,
        table: str,
        rows: list[dict[str, Any]] | dict[str, Any],
        *,
        on_conflict: str | None = None,
    ) -> tuple[int, Any]:
        prefer = "resolution=merge-duplicates,return=representation"
        path = f"/rest/v1/{table}"
        if on_conflict:
            path = f"{path}?on_conflict={on_conflict}"
        return self.request("POST", path, body=rows, prefer=prefer)

    def select(self, table: str, *, query: str = "select=*") -> tuple[int, Any]:
        return self.request("GET", f"/rest/v1/{table}?{query}")

    def verify_jwt(self, access_token: str) -> dict[str, Any] | None:
        token = (access_token or "").strip()
        if not token or not self.enabled:
            return None
        url = f"{self._base()}/auth/v1/user"
        headers = {
            "apikey": self._settings.supabase_anon_key.strip()
            or self._settings.supabase_service_role_key.strip(),
            "Authorization": f"Bearer {token}",
        }
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                raw = resp.read().decode("utf-8")
                data = json.loads(raw) if raw else {}
                if isinstance(data, dict) and data.get("id"):
                    return data
                return None
        except Exception:
            logger.debug("jwt verify failed", exc_info=True)
            return None


_client: SupabaseClient | None = None


def get_supabase() -> SupabaseClient:
    global _client
    if _client is None:
        _client = SupabaseClient()
    return _client
