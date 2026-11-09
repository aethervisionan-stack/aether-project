"""
Gen-1 entitlement store — unlocks HUD + chat after successful Stripe payment.

Assumptions (document in README):
- Access is keyed by a client-held `subscriber_id` (Stripe customer id, checkout
  session id, or local `dev_*` id). No full auth system yet.
- Persistence is a local JSON file under `backend/data/` (fine for Gen-1 / local).
- Webhook grants `active` immediately; expiry follows Stripe subscription period
  when present, else +31 days.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import Settings, get_settings

logger = logging.getLogger("aether.billing.entitlements")


@dataclass
class Entitlement:
    subscriber_id: str
    active: bool
    source: str
    email: str | None = None
    stripe_session_id: str | None = None
    stripe_customer_id: str | None = None
    granted_at: float = 0.0
    expires_at: float | None = None
    metadata: dict[str, Any] | None = None

    def is_valid(self, now: float | None = None) -> bool:
        if not self.active:
            return False
        ts = now if now is not None else time.time()
        if self.expires_at is not None and ts > self.expires_at:
            return False
        return True


class EntitlementStore:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._by_id: dict[str, Entitlement] = {}
        # Alternate lookup keys (checkout session id, email) → subscriber_id
        self._aliases: dict[str, str] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            items = raw.get("entitlements", []) if isinstance(raw, dict) else []
            aliases = raw.get("aliases", {}) if isinstance(raw, dict) else {}
            for item in items:
                if not isinstance(item, dict) or not item.get("subscriber_id"):
                    continue
                ent = Entitlement(
                    subscriber_id=str(item["subscriber_id"]),
                    active=bool(item.get("active", False)),
                    source=str(item.get("source") or "unknown"),
                    email=item.get("email"),
                    stripe_session_id=item.get("stripe_session_id"),
                    stripe_customer_id=item.get("stripe_customer_id"),
                    granted_at=float(item.get("granted_at") or 0),
                    expires_at=(
                        float(item["expires_at"])
                        if item.get("expires_at") is not None
                        else None
                    ),
                    metadata=item.get("metadata")
                    if isinstance(item.get("metadata"), dict)
                    else None,
                )
                self._by_id[ent.subscriber_id] = ent
            if isinstance(aliases, dict):
                self._aliases = {str(k): str(v) for k, v in aliases.items()}
        except Exception as exc:
            logger.warning("failed to load entitlements from %s: %s", self._path, exc)

    def _persist(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "entitlements": [asdict(e) for e in self._by_id.values()],
            "aliases": self._aliases,
            "updated_at": time.time(),
        }
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp.replace(self._path)

    def grant(
        self,
        *,
        subscriber_id: str,
        source: str,
        email: str | None = None,
        stripe_session_id: str | None = None,
        stripe_customer_id: str | None = None,
        expires_at: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Entitlement:
        with self._lock:
            ent = Entitlement(
                subscriber_id=subscriber_id,
                active=True,
                source=source,
                email=email,
                stripe_session_id=stripe_session_id,
                stripe_customer_id=stripe_customer_id,
                granted_at=time.time(),
                expires_at=expires_at,
                metadata=metadata or {},
            )
            self._by_id[subscriber_id] = ent
            if stripe_session_id:
                self._aliases[stripe_session_id] = subscriber_id
            if stripe_customer_id:
                self._aliases[stripe_customer_id] = subscriber_id
            if email:
                self._aliases[f"email:{email.lower()}"] = subscriber_id
            self._persist()
            logger.info(
                "entitlement granted subscriber_id=%s source=%s email=%s",
                subscriber_id,
                source,
                email or "—",
            )
            return ent

    def resolve_id(self, key: str) -> str:
        with self._lock:
            return self._aliases.get(key, key)

    def get(self, key: str) -> Entitlement | None:
        with self._lock:
            subscriber_id = self._aliases.get(key, key)
            ent = self._by_id.get(subscriber_id)
            if ent is None:
                return None
            if not ent.is_valid():
                ent.active = False
                self._persist()
            return ent

    def status(self, key: str) -> dict[str, Any]:
        ent = self.get(key)
        if ent is None:
            return {
                "subscriber_id": key,
                "active": False,
                "source": None,
            }
        return {
            "subscriber_id": ent.subscriber_id,
            "active": ent.is_valid(),
            "source": ent.source,
            "email": ent.email,
            "expires_at": ent.expires_at,
            "granted_at": ent.granted_at,
        }


@lru_cache
def get_entitlement_store() -> EntitlementStore:
    settings: Settings = get_settings()
    path = Path(settings.entitlements_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    return EntitlementStore(path)
