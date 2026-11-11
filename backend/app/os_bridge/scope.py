"""Scoped permission gates for desktop / native OS bridge actions."""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

BridgeScope = Literal[
    "desktop_capture",
    "notification_read",
    "keyboard",
    "mouse",
    "system_control",
]

SENSITIVE_SCOPES: frozenset[BridgeScope] = frozenset(
    {
        "desktop_capture",
        "notification_read",
        "keyboard",
        "mouse",
    }
)


@dataclass
class ScopeGrant:
    scope: BridgeScope
    profile_id: str
    granted_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    source: str = "confirm"

    def alive(self) -> bool:
        if self.expires_at <= 0:
            return True
        return time.time() < self.expires_at

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ScopeRegistry:
    def __init__(self, *, default_ttl_s: float = 300.0) -> None:
        self.default_ttl_s = default_ttl_s
        self._grants: dict[tuple[str, BridgeScope], ScopeGrant] = {}

    def purge(self) -> None:
        dead = [k for k, g in self._grants.items() if not g.alive()]
        for k in dead:
            self._grants.pop(k, None)

    def grant(
        self,
        *,
        scope: BridgeScope,
        profile_id: str = "local",
        ttl_s: float | None = None,
        source: str = "confirm",
    ) -> ScopeGrant:
        self.purge()
        ttl = self.default_ttl_s if ttl_s is None else ttl_s
        item = ScopeGrant(
            scope=scope,
            profile_id=profile_id,
            expires_at=time.time() + max(0.0, ttl) if ttl > 0 else 0.0,
            source=source,
        )
        self._grants[(profile_id, scope)] = item
        return item

    def revoke(self, *, scope: BridgeScope, profile_id: str = "local") -> bool:
        return self._grants.pop((profile_id, scope), None) is not None

    def has(self, *, scope: BridgeScope, profile_id: str = "local") -> bool:
        self.purge()
        grant = self._grants.get((profile_id, scope))
        return bool(grant and grant.alive())

    def list_for(self, profile_id: str = "local") -> list[ScopeGrant]:
        self.purge()
        return sorted(
            [g for (pid, _), g in self._grants.items() if pid == profile_id],
            key=lambda g: g.granted_at,
            reverse=True,
        )

    def status(self, profile_id: str = "local") -> dict[str, Any]:
        grants = self.list_for(profile_id)
        return {
            "profile_id": profile_id,
            "grants": [g.to_dict() for g in grants],
            "active_scopes": [g.scope for g in grants],
            "sensitive": sorted(SENSITIVE_SCOPES),
        }


_SCOPES = ScopeRegistry()


def get_scope_registry() -> ScopeRegistry:
    return _SCOPES


def action_to_scope(action: str) -> BridgeScope | None:
    a = (action or "").strip().lower()
    if a in {"desktop_capture", "capture", "screenshot"}:
        return "desktop_capture"
    if a in {"notification_read", "notifications", "read_notifications"}:
        return "notification_read"
    if a in {"keyboard", "type", "key", "hotkey"}:
        return "keyboard"
    if a in {"mouse", "click", "move", "drag", "scroll"}:
        return "mouse"
    if a in {
        "media",
        "battery",
        "volume",
        "sound_mode",
        "timer",
        "alarm",
        "delete_alarm",
    }:
        return "system_control"
    return None
