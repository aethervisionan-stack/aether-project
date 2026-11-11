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
from app.memory.summarizer import summarize_profile
from app.memory.vector_store import get_vector_store

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
    # Dual-write cloud session + preference vector (no-op when unset / local).
    try:
        from app.cloud.session import push_session
        from app.memory.cloud_vector import mirror_local_upsert

        await asyncio.to_thread(
            push_session,
            profile_id,
            preferences=prefs if isinstance(prefs, dict) else {},
            hud={},
            device_id=None,
        )
        pref_bits = []
        if isinstance(prefs, dict):
            for key in ("tone", "style", "technical_level", "language", "notes"):
                val = prefs.get(key)
                if val:
                    pref_bits.append(f"{key}={val}")
        if pref_bits:
            await asyncio.to_thread(
                mirror_local_upsert,
                profile_id=profile_id,
                text="User preferences: " + "; ".join(pref_bits),
                kind="preference",
                meta={"source": "memory_put"},
                record_id=f"pref-{profile_id}",
            )
    except Exception:
        logger.debug("cloud preference push skipped", exc_info=True)
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


@router.get("/vector/search")
async def vector_search(
    q: str,
    profile_id: str = "local",
    k: int = 8,
) -> dict[str, Any]:
    """Semantic recall over indexed interaction embeddings."""
    vs = get_vector_store()
    hits = await asyncio.to_thread(
        vs.query,
        q,
        profile_id=profile_id,
        limit=max(1, min(k, 32)),
    )
    return {"profile_id": profile_id, "query": q, "hits": hits}


@router.post("/vector/summarize")
async def vector_summarize(profile_id: str = "local") -> dict[str, Any]:
    """Force a semantic summary pass for long-chat context hygiene."""
    result = await asyncio.to_thread(summarize_profile, profile_id)
    return {"profile_id": profile_id, **result}
