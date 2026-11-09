"""HTTP surface for tool catalog + ad-hoc invoke (HUD / MemoryInspector companions)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import get_settings
from app.hardware.audio_profile import parse_audio_profile
from app.hardware.priority import PaceClass, classify_pace
from app.os_bridge.confirmation import (
    get_confirmation_engine,
    is_confirmation_utterance,
    is_rejection_utterance,
)
from app.os_bridge.listener import get_notification_listener
from app.os_bridge.mock import get_os_bridge
from app.tools.registry import ToolContext, get_tool_registry

router = APIRouter(prefix="/tools", tags=["tools"])


class ToolInvokeBody(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    profile_id: str = "local"


class ToolConfirmBody(BaseModel):
    pending_id: str | None = None
    utterance: str | None = None
    confirm: bool | None = None
    profile_id: str = "local"


class ListenerIngestBody(BaseModel):
    source: str = "hud"
    title: str = ""
    body: str = ""
    raw: str | None = None
    sender: str | None = None
    package: str = "unknown"
    app: str | None = None
    priority_hint: str | None = None
    favorite: bool | None = None
    speed_mps: float | None = None
    audio_profile: str = "speaker"
    interruption_filter: bool = True
    screen_lit: bool = False


@router.get("/catalog")
async def tool_catalog() -> dict[str, Any]:
    registry = get_tool_registry()
    bridge = get_os_bridge()
    return {
        "tools": registry.prompt_catalog(),
        "names": registry.list_names(),
        "os_bridge": bridge.status(),
        "hands_free": {
            "messaging_tool": True,
            "email_calendar_tool": True,
            "telephony_tool": True,
            "system_control_tool": True,
            "two_step_confirm": True,
            "notification_listener": True,
        },
    }


@router.post("/invoke")
async def tool_invoke(body: ToolInvokeBody) -> dict[str, Any]:
    registry = get_tool_registry()
    settings = get_settings()
    result = await registry.invoke(
        body.name,
        body.arguments,
        ctx=ToolContext(profile_id=body.profile_id, settings=settings, source="http"),
    )
    return result.to_dict()


@router.get("/pending")
async def tool_pending(profile_id: str = "local") -> dict[str, Any]:
    engine = get_confirmation_engine()
    items = [p.to_dict() for p in engine.list_pending(profile_id)]
    return {"pending": items, "count": len(items)}


@router.post("/confirm")
async def tool_confirm(body: ToolConfirmBody) -> dict[str, Any]:
    """
    Complete the two-step confirmation loop.

    Accepts explicit confirm=true/false, or an utterance ("Sim", "Pode enviar", "Yes").
    """
    engine = get_confirmation_engine()
    registry = get_tool_registry()
    settings = get_settings()

    pending = None
    if body.pending_id:
        pending = engine.get(body.pending_id)
    else:
        pending = engine.latest_for_profile(body.profile_id)

    if pending is None:
        return {"ok": False, "status": "no_pending", "error": "no pending action"}

    confirm: bool | None = body.confirm
    if confirm is None and body.utterance:
        if is_rejection_utterance(body.utterance):
            confirm = False
        elif is_confirmation_utterance(body.utterance):
            confirm = True
        else:
            return {
                "ok": False,
                "status": "unclear_utterance",
                "pending_id": pending.id,
                "speak": pending.speak,
                "error": "utterance was neither confirm nor reject",
            }

    if confirm is None:
        return {
            "ok": False,
            "status": "need_confirm_flag",
            "pending_id": pending.id,
            "speak": pending.speak,
            "error": "provide confirm or utterance",
        }

    if not confirm:
        engine.pop(pending.id)
        return {
            "ok": True,
            "status": "cancelled",
            "pending_id": pending.id,
            "tool": pending.tool,
            "action": pending.action,
            "speak": "Cancelado.",
            "success_beep": False,
        }

    engine.pop(pending.id)
    args = dict(pending.arguments)
    args["confirmed"] = True
    args["pending_id"] = pending.id
    result = await registry.invoke(
        pending.tool,
        args,
        ctx=ToolContext(profile_id=body.profile_id, settings=settings, source="confirm"),
    )
    payload = result.to_dict()
    payload["status"] = "executed" if result.ok else "failed"
    payload["pending_id"] = pending.id
    payload["success_beep"] = bool(result.ok)
    # Surface speak at top-level for HUD / voice cue.
    speak = None
    if isinstance(payload.get("result"), dict):
        speak = payload["result"].get("speak")
        payload["success_beep"] = bool(
            payload.get("success_beep") and payload["result"].get("success_beep", True)
        )
    payload["speak"] = speak or ("Feito." if result.ok else "Falhou.")
    return payload


@router.get("/os-bridge")
async def os_bridge_status() -> dict[str, Any]:
    return get_os_bridge().status()


@router.post("/listener/ingest")
async def listener_ingest(body: ListenerIngestBody) -> dict[str, Any]:
    listener = get_notification_listener()
    pace = classify_pace(body.speed_mps)
    decision = listener.ingest_raw(
        source=body.source,
        title=body.title,
        body=body.body,
        raw=body.raw,
        sender=body.sender,
        package=body.package,
        app=body.app,
        priority_hint=body.priority_hint,
        favorite=body.favorite,
        screen_lit=body.screen_lit,
        pace=pace,
        audio_profile=parse_audio_profile(body.audio_profile),
        interruption_filter=body.interruption_filter,
    )
    return {
        "ok": True,
        "decision": decision.to_dict(),
        "pace": pace.value,
        "favorites": listener.favorites.to_list(),
    }


@router.get("/listener/poll")
async def listener_poll(
    since_id: str | None = None,
    speed_mps: float | None = None,
    audio_profile: str = "speaker",
    interruption_filter: bool = True,
) -> dict[str, Any]:
    listener = get_notification_listener()
    pace = classify_pace(speed_mps)
    decisions = await listener.poll_bridge(
        since_id=since_id,
        pace=pace,
        audio_profile=parse_audio_profile(audio_profile),
        interruption_filter=interruption_filter,
    )
    return {
        "ok": True,
        "count": len(decisions),
        "decisions": [d.to_dict() for d in decisions],
        "pace": pace.value if isinstance(pace, PaceClass) else str(pace),
        "favorites": listener.favorites.to_list(),
    }
