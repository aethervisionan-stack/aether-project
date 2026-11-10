"""HTTP API for Gen-1 memory inspector / privacy controls."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.memory.context import build_system_instruction, preferences_summary
from app.memory.extractor import run_extraction
from app.memory.store import get_memory_store

logger = logging.getLogger("aether.memory.routes")

router = APIRouter(prefix="/memory", tags=["memory"])


class PreferenceUpdate(BaseModel):
    tone: str | None = None
    style: str | None = None
    language: str | None = None
    technical_level: str | None = None
    notes: str | None = None
    frequent_commands: list[str] | None = None


class ProfileQuery(BaseModel):
    profile_id: str = Field(default="local")


@router.get("/profile")
async def get_profile(profile_id: str = "local") -> dict[str, Any]:
    store = get_memory_store()
    snap = await asyncio.to_thread(store.snapshot, profile_id)
    prefs = snap.get("preferences") or {}
    return {
        **snap,
        "preference_summary": preferences_summary(prefs),
        "system_instruction_preview": build_system_instruction(prefs),
    }


@router.put("/profile")
async def put_profile(body: PreferenceUpdate, profile_id: str = "local") -> dict[str, Any]:
    store = get_memory_store()
    payload = body.model_dump(exclude_none=True)
    await asyncio.to_thread(
        store.update_preferences,
        profile_id,
        preferences=payload,
        merge=True,
    )
    # Return full snapshot so HUD can re-render without losing history.
    snap = await asyncio.to_thread(store.snapshot, profile_id)
    prefs = snap.get("preferences") or {}
    return {
        **snap,
        "preference_summary": preferences_summary(prefs),
        "system_instruction_preview": build_system_instruction(prefs),
    }


@router.delete("/profile")
async def delete_profile(
    profile_id: str = "local",
    history_only: bool = False,
) -> dict[str, Any]:
    store = get_memory_store()
    if history_only:
        snap = await asyncio.to_thread(store.clear_history, profile_id)
    else:
        snap = await asyncio.to_thread(store.clear_profile, profile_id)
    return {"cleared": True, "history_only": history_only, **snap}


@router.post("/extract")
async def extract_now(profile_id: str = "local") -> dict[str, Any]:
    """Force a background-style extraction pass (still non-blocking to Live)."""
    store = get_memory_store()
    try:
        prefs = await asyncio.to_thread(run_extraction, store, profile_id)
    except Exception as exc:
        logger.exception("manual extraction failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        "profile_id": profile_id,
        "preferences": prefs.to_dict(),
        "preference_summary": preferences_summary(prefs),
    }
