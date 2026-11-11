"""
Entitlement store — Stripe / Solana Pay access with payment_status + receipts.

Access is keyed by client-held `subscriber_id` (Stripe customer id, checkout
session id, Solana reference, or local `dev_*` id). Persistence: JSON under
`backend/data/`.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import Settings, get_settings

logger = logging.getLogger("aether.billing.entitlements")

PAYMENT_STATUS_ACTIVE = "active"
PAYMENT_STATUS_INACTIVE = "inactive"
PAYMENT_STATUS_CANCELED = "canceled"
PAYMENT_STATUS_PAST_DUE = "past_due"
PAYMENT_STATUS_PENDING = "pending"

PAYMENT_STATUSES = frozenset(
    {
        PAYMENT_STATUS_ACTIVE,
        PAYMENT_STATUS_INACTIVE,
        PAYMENT_STATUS_CANCELED,
        PAYMENT_STATUS_PAST_DUE,
        PAYMENT_STATUS_PENDING,
    }
)


@dataclass
class Entitlement:
    subscriber_id: str
    active: bool
    source: str
    payment_status: str = PAYMENT_STATUS_INACTIVE
    email: str | None = None
    stripe_session_id: str | None = None
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    interval: str | None = None
    granted_at: float = 0.0
    expires_at: float | None = None
    metadata: dict[str, Any] | None = None
    receipts: list[dict[str, Any]] = field(default_factory=list)

    def is_valid(self, now: float | None = None) -> bool:
        if not self.active:
            return False
        if self.payment_status != PAYMENT_STATUS_ACTIVE:
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
                ps = str(item.get("payment_status") or "").strip().lower()
                if not ps:
                    ps = PAYMENT_STATUS_ACTIVE if item.get("active") else PAYMENT_STATUS_INACTIVE
                receipts = item.get("receipts")
                if not isinstance(receipts, list):
                    receipts = []
                ent = Entitlement(
                    subscriber_id=str(item["subscriber_id"]),
                    active=bool(item.get("active", False)),
                    source=str(item.get("source") or "unknown"),
                    payment_status=ps,
                    email=item.get("email"),
                    stripe_session_id=item.get("stripe_session_id"),
                    stripe_customer_id=item.get("stripe_customer_id"),
                    stripe_subscription_id=item.get("stripe_subscription_id"),
                    interval=item.get("interval"),
                    granted_at=float(item.get("granted_at") or 0),
                    expires_at=(
                        float(item["expires_at"])
                        if item.get("expires_at") is not None
                        else None
                    ),
                    metadata=item.get("metadata")
                    if isinstance(item.get("metadata"), dict)
                    else None,
                    receipts=[r for r in receipts if isinstance(r, dict)],
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

    def register_alias(self, alias: str, subscriber_id: str) -> None:
        alias = (alias or "").strip()
        subscriber_id = (subscriber_id or "").strip()
        if not alias or not subscriber_id:
            return
        with self._lock:
            self._aliases[alias] = subscriber_id
            self._persist()

    def set_payment_status(
        self,
        key: str,
        payment_status: str,
        *,
        active: bool | None = None,
        metadata_patch: dict[str, Any] | None = None,
        expires_at: float | None = None,
    ) -> dict[str, Any]:
        ps = (payment_status or "").strip().lower()
        if ps not in PAYMENT_STATUSES:
            ps = PAYMENT_STATUS_INACTIVE
        with self._lock:
            subscriber_id = self._aliases.get(key, key)
            ent = self._by_id.get(subscriber_id)
            if ent is None:
                return {
                    "subscriber_id": key,
                    "active": False,
                    "payment_status": PAYMENT_STATUS_INACTIVE,
                    "updated": False,
                }
            ent.payment_status = ps
            if active is not None:
                ent.active = bool(active)
            elif ps == PAYMENT_STATUS_ACTIVE:
                ent.active = True
            elif ps in {PAYMENT_STATUS_CANCELED, PAYMENT_STATUS_INACTIVE, PAYMENT_STATUS_PAST_DUE}:
                ent.active = False
            if expires_at is not None:
                ent.expires_at = expires_at
            if metadata_patch:
                meta = dict(ent.metadata or {})
                meta.update(metadata_patch)
                ent.metadata = meta
            self._persist()
            return {
                "subscriber_id": subscriber_id,
                "active": ent.active,
                "payment_status": ent.payment_status,
                "updated": True,
            }

    def append_receipt(self, key: str, receipt: dict[str, Any]) -> Entitlement | None:
        with self._lock:
            subscriber_id = self._aliases.get(key, key)
            ent = self._by_id.get(subscriber_id)
            if ent is None:
                return None
            ent.receipts.append(dict(receipt))
            self._persist()
            return ent

    def grant(
        self,
        *,
        subscriber_id: str,
        source: str,
        email: str | None = None,
        stripe_session_id: str | None = None,
        stripe_customer_id: str | None = None,
        stripe_subscription_id: str | None = None,
        interval: str | None = None,
        expires_at: float | None = None,
        metadata: dict[str, Any] | None = None,
        payment_status: str = PAYMENT_STATUS_ACTIVE,
    ) -> Entitlement:
        with self._lock:
            ps = (payment_status or PAYMENT_STATUS_ACTIVE).strip().lower()
            if ps not in PAYMENT_STATUSES:
                ps = PAYMENT_STATUS_ACTIVE
            existing = self._by_id.get(subscriber_id)
            receipts = list(existing.receipts) if existing else []
            ent = Entitlement(
                subscriber_id=subscriber_id,
                active=ps == PAYMENT_STATUS_ACTIVE,
                source=source,
                payment_status=ps,
                email=email or (existing.email if existing else None),
                stripe_session_id=stripe_session_id
                or (existing.stripe_session_id if existing else None),
                stripe_customer_id=stripe_customer_id
                or (existing.stripe_customer_id if existing else None),
                stripe_subscription_id=stripe_subscription_id
                or (existing.stripe_subscription_id if existing else None),
                interval=interval or (existing.interval if existing else None),
                granted_at=time.time(),
                expires_at=expires_at
                if expires_at is not None
                else (existing.expires_at if existing else None),
                metadata=metadata if metadata is not None else (existing.metadata if existing else {}),
                receipts=receipts,
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
                "entitlement granted subscriber_id=%s source=%s payment_status=%s",
                subscriber_id,
                source,
                ps,
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
                if ent.active and ent.payment_status == PAYMENT_STATUS_ACTIVE:
                    ent.active = False
                    ent.payment_status = PAYMENT_STATUS_INACTIVE
                    self._persist()
            return ent

    def status(self, key: str) -> dict[str, Any]:
        ent = self.get(key)
        if ent is None:
            return {
                "subscriber_id": key,
                "active": False,
                "source": None,
                "payment_status": PAYMENT_STATUS_INACTIVE,
                "receipts": [],
            }
        return {
            "subscriber_id": ent.subscriber_id,
            "active": ent.is_valid(),
            "source": ent.source,
            "payment_status": ent.payment_status,
            "email": ent.email,
            "expires_at": ent.expires_at,
            "granted_at": ent.granted_at,
            "stripe_customer_id": ent.stripe_customer_id,
            "stripe_subscription_id": ent.stripe_subscription_id,
            "receipts_count": len(ent.receipts),
            "receipts": list(ent.receipts),
        }

    def revoke(self, key: str) -> dict[str, Any]:
        with self._lock:
            subscriber_id = self._aliases.get(key, key)
            ent = self._by_id.get(subscriber_id)
            removed_aliases = 0
            if ent is not None:
                ent.active = False
                ent.payment_status = PAYMENT_STATUS_CANCELED
                drop = [a for a, sid in self._aliases.items() if sid == subscriber_id]
                for a in drop:
                    del self._aliases[a]
                    removed_aliases += 1
                if key in self._aliases:
                    del self._aliases[key]
                    removed_aliases += 1
                self._persist()
                logger.info("entitlement revoked subscriber_id=%s", subscriber_id)
                return {
                    "subscriber_id": subscriber_id,
                    "active": False,
                    "payment_status": PAYMENT_STATUS_CANCELED,
                    "revoked": True,
                    "aliases_cleared": removed_aliases,
                }
            if key in self._aliases:
                del self._aliases[key]
                self._persist()
            return {
                "subscriber_id": key,
                "active": False,
                "payment_status": PAYMENT_STATUS_INACTIVE,
                "revoked": False,
                "aliases_cleared": 0,
            }


@lru_cache
def get_entitlement_store() -> EntitlementStore:
    settings: Settings = get_settings()
    path = Path(settings.entitlements_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    return EntitlementStore(path)
