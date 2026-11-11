"""Fernet-encrypted on-disk Google OAuth credential storage."""

from __future__ import annotations

import json
import logging
import threading
from functools import lru_cache
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.config import Settings, get_settings

logger = logging.getLogger("aether.auth.credentials")


class CredentialStore:
    """Per-profile encrypted token blobs under ``backend/data/google_tokens/``."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._lock = threading.Lock()
        self._root = Path(self._settings.google_token_dir).expanduser()
        if not self._root.is_absolute():
            backend_root = Path(__file__).resolve().parent.parent.parent
            self._root = (backend_root / self._root).resolve()
        self._root.mkdir(parents=True, exist_ok=True)
        self._fernet = Fernet(self._resolve_fernet_key())

    def _resolve_fernet_key(self) -> bytes:
        raw = (self._settings.google_token_fernet_key or "").strip()
        if raw:
            return raw.encode("utf-8")
        key_path = self._root / ".fernet.key"
        if key_path.exists():
            return key_path.read_bytes().strip()
        key = Fernet.generate_key()
        key_path.write_bytes(key)
        try:
            key_path.chmod(0o600)
        except OSError:
            pass
        logger.warning(
            "GOOGLE_TOKEN_FERNET_KEY unset — generated local key at %s "
            "(set the env var for multi-process / production)",
            key_path,
        )
        return key

    def _path_for(self, profile_id: str) -> Path:
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in (profile_id or "local"))
        return self._root / f"{safe}.token.enc"

    def has(self, profile_id: str = "local") -> bool:
        return self._path_for(profile_id).is_file()

    def load(self, profile_id: str = "local") -> dict[str, Any] | None:
        path = self._path_for(profile_id)
        if not path.is_file():
            return None
        with self._lock:
            blob = path.read_bytes()
        try:
            plain = self._fernet.decrypt(blob)
        except InvalidToken:
            logger.error("failed to decrypt Google tokens for profile=%s", profile_id)
            return None
        try:
            data = json.loads(plain.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            logger.error("corrupt Google token JSON for profile=%s", profile_id)
            return None
        return data if isinstance(data, dict) else None

    def save(self, profile_id: str, payload: dict[str, Any]) -> None:
        path = self._path_for(profile_id)
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        encrypted = self._fernet.encrypt(raw)
        with self._lock:
            path.write_bytes(encrypted)
            try:
                path.chmod(0o600)
            except OSError:
                pass

    def delete(self, profile_id: str = "local") -> bool:
        path = self._path_for(profile_id)
        with self._lock:
            if not path.exists():
                return False
            path.unlink()
            return True

    def status(self, profile_id: str = "local") -> dict[str, Any]:
        data = self.load(profile_id)
        if not data:
            return {
                "connected": False,
                "profile_id": profile_id,
                "has_refresh_token": False,
                "scopes": [],
            }
        scopes = data.get("scopes") or data.get("scope") or []
        if isinstance(scopes, str):
            scopes = [s for s in scopes.split() if s]
        return {
            "connected": True,
            "profile_id": profile_id,
            "has_refresh_token": bool(data.get("refresh_token")),
            "token_uri": data.get("token_uri"),
            "expiry": data.get("expiry"),
            "scopes": list(scopes),
            "email": data.get("email"),
        }


@lru_cache
def get_credential_store() -> CredentialStore:
    return CredentialStore()
