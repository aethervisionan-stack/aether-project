"""Resolve cloud user identity from Bearer JWT or explicit user_id (dev)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Header, HTTPException, Query

from app.cloud.supabase_client import get_supabase
from app.config import get_settings


@dataclass
class CloudUser:
    user_id: str
    email: str | None = None
    source: str = "local"
    raw: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "email": self.email,
            "source": self.source,
        }


def resolve_user_id(
    *,
    authorization: str | None = None,
    x_aether_user_id: str | None = None,
    user_id: str | None = None,
) -> CloudUser:
    settings = get_settings()
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if token and settings.supabase_configured():
        user = get_supabase().verify_jwt(token)
        if user and user.get("id"):
            return CloudUser(
                user_id=str(user["id"]),
                email=(str(user["email"]) if user.get("email") else None),
                source="supabase",
                raw=user,
            )
        raise HTTPException(status_code=401, detail="invalid_supabase_token")

    if x_aether_user_id and x_aether_user_id.strip():
        if settings.local_feature_unlock() or not settings.supabase_configured():
            return CloudUser(user_id=x_aether_user_id.strip()[:128], source="header")

    if user_id and user_id.strip():
        if settings.local_feature_unlock() or not settings.supabase_configured():
            return CloudUser(user_id=user_id.strip()[:128], source="query")

    return CloudUser(user_id="local", source="local")


async def cloud_user_dep(
    authorization: str | None = Header(default=None),
    x_aether_user_id: str | None = Header(default=None, alias="X-Aether-User-Id"),
    user_id: str | None = Query(default=None),
) -> CloudUser:
    return resolve_user_id(
        authorization=authorization,
        x_aether_user_id=x_aether_user_id,
        user_id=user_id,
    )
