"""HTTP API for cloud auth/session/HUD sync + vector status."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.cloud.auth import CloudUser, cloud_user_dep
from app.cloud.realtime import channel_name, publish_hud_event, recent_events
from app.cloud.session import pull_session, push_session
from app.cloud.status import cloud_status
from app.memory.cloud_vector import (
    cloud_vector_stats,
    query_cloud_vectors,
    upsert_cloud_vector,
)

router = APIRouter(prefix="/cloud", tags=["cloud"])


class SessionPushBody(BaseModel):
    preferences: dict[str, Any] | None = None
    hud: dict[str, Any] | None = None
    device_id: str | None = None
    merge_prefs: bool = True


class HudEventBody(BaseModel):
    event_type: str = Field(default="hud", max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)
    device_id: str | None = None


class VectorUpsertBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    kind: str = Field(default="interaction", max_length=32)
    meta: dict[str, Any] | None = None
    record_id: str | None = None


class VectorQueryBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=6, ge=1, le=32)
    kinds: list[str] | None = None


@router.get("/status")
async def get_cloud_status() -> dict[str, Any]:
    return cloud_status()


@router.get("/me")
async def cloud_me(user: CloudUser = Depends(cloud_user_dep)) -> dict[str, Any]:
    return {"ok": True, **user.to_dict(), "channel": channel_name(user.user_id)}


@router.get("/session")
async def get_session(user: CloudUser = Depends(cloud_user_dep)) -> dict[str, Any]:
    return await asyncio.to_thread(pull_session, user.user_id)


@router.put("/session")
async def put_session(
    body: SessionPushBody,
    user: CloudUser = Depends(cloud_user_dep),
) -> dict[str, Any]:
    return await asyncio.to_thread(
        push_session,
        user.user_id,
        preferences=body.preferences,
        hud=body.hud,
        device_id=body.device_id,
        merge_prefs=body.merge_prefs,
    )


@router.post("/hud")
async def post_hud_event(
    body: HudEventBody,
    user: CloudUser = Depends(cloud_user_dep),
) -> dict[str, Any]:
    return await asyncio.to_thread(
        publish_hud_event,
        user.user_id,
        event_type=body.event_type,
        payload=body.payload,
        device_id=body.device_id,
    )


@router.get("/hud")
async def get_hud_events(
    user: CloudUser = Depends(cloud_user_dep),
    limit: int = 40,
) -> dict[str, Any]:
    return await asyncio.to_thread(recent_events, user.user_id, limit=limit)


@router.get("/vector/stats")
async def vector_stats(user: CloudUser = Depends(cloud_user_dep)) -> dict[str, Any]:
    return await asyncio.to_thread(cloud_vector_stats, user.user_id)


@router.post("/vector/upsert")
async def vector_upsert(
    body: VectorUpsertBody,
    user: CloudUser = Depends(cloud_user_dep),
) -> dict[str, Any]:
    return await asyncio.to_thread(
        upsert_cloud_vector,
        user.user_id,
        text=body.text,
        kind=body.kind,
        meta=body.meta,
        record_id=body.record_id,
    )


@router.post("/vector/query")
async def vector_query(
    body: VectorQueryBody,
    user: CloudUser = Depends(cloud_user_dep),
) -> dict[str, Any]:
    hits = await asyncio.to_thread(
        query_cloud_vectors,
        user.user_id,
        text=body.text,
        limit=body.limit,
        kinds=body.kinds,
    )
    return {"ok": True, "user_id": user.user_id, "hits": hits}
