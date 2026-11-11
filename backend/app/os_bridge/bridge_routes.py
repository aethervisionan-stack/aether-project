"""Secure HTTP routes for native OS bridge surfaces under /tools/os-bridge/*."""

from __future__ import annotations

import hmac
import time
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.os_bridge.confirmation import (
    build_speak_summary,
    get_confirmation_engine,
    requires_confirmation,
)
from app.os_bridge.contracts import NotificationEvent
from app.os_bridge.factory import get_os_bridge
from app.os_bridge.listener import get_notification_listener
from app.os_bridge.scope import BridgeScope, action_to_scope, get_scope_registry
from app.tools.registry import ToolContext, get_tool_registry

router = APIRouter(prefix="/tools/os-bridge", tags=["os-bridge"])


class ScopeGrantBody(BaseModel):
    scope: BridgeScope
    profile_id: str = "local"
    ttl_s: float | None = None
    confirmed: bool = False


class DesktopCaptureBody(BaseModel):
    max_width: int = Field(default=1280, ge=160, le=3840)
    profile_id: str = "local"
    confirmed: bool = False


class NotificationReadBody(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)
    profile_id: str = "local"
    confirmed: bool = False


class KeyboardBody(BaseModel):
    mode: Literal["type", "hotkey"] = "type"
    text: str | None = None
    keys: list[str] | None = None
    profile_id: str = "local"
    confirmed: bool = False


class MouseBody(BaseModel):
    mode: Literal["click", "move", "scroll"] = "click"
    x: int | None = None
    y: int | None = None
    button: Literal["left", "right"] = "left"
    delta: int = 0
    profile_id: str = "local"
    confirmed: bool = False


class MobileInjectBody(BaseModel):
    id: str | None = None
    package: str = "unknown"
    title: str = ""
    body: str = ""
    sender: str | None = None
    app: str | None = None
    priority_hint: str | None = None
    favorite: bool = False
    screen_lit: bool = False
    visible_text: list[str] | None = None
    tree_summary: str | None = None


def _check_bridge_token(authorization: str | None) -> None:
    settings = get_settings()
    expected = (settings.aether_os_bridge_token or "").strip()
    if not expected:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    got = authorization.split(" ", 1)[1].strip()
    if not hmac.compare_digest(got, expected):
        raise HTTPException(status_code=403, detail="invalid bridge token")


def _ensure_flag(flag: bool, name: str) -> None:
    if not flag:
        raise HTTPException(
            status_code=403,
            detail=f"{name} disabled — set the matching AETHER_DESKTOP_* env flag",
        )


def _pending_or_scope(
    *,
    tool: str,
    action: str,
    arguments: dict[str, Any],
    profile_id: str,
    confirmed: bool,
    scope: BridgeScope,
) -> dict[str, Any] | None:
    scopes = get_scope_registry()
    if scopes.has(scope=scope, profile_id=profile_id):
        return None
    if confirmed:
        scopes.grant(scope=scope, profile_id=profile_id, source="confirm")
        return None
    pending = get_confirmation_engine().create(
        tool=tool,
        action=action,
        arguments={**arguments, "confirmed": True},
        profile_id=profile_id,
        speak=build_speak_summary(tool, action, arguments),
    )
    return {
        "ok": True,
        "status": "pending_confirmation",
        "tool": tool,
        "action": action,
        "pending_id": pending.id,
        "speak": pending.speak,
        "requires_confirmation": True,
        "scope": scope,
    }


def _active_driver(settings_mode: str, platform: str | None) -> str:
    """Normalize inspector label to mock | desktop | android."""
    mode = (settings_mode or "mock").strip().lower() or "mock"
    if mode in {"mock", "desktop", "android"}:
        return mode
    plat = (platform or "").strip().lower()
    if plat in {"mock", "desktop", "android", "web"}:
        return "mock" if plat == "web" else plat
    return "mock"


def _bridge_inspector_payload(profile_id: str = "local") -> dict[str, Any]:
    settings = get_settings()
    bridge = get_os_bridge()
    bridge_status = bridge.status()
    platform = str(bridge_status.get("platform") or getattr(bridge, "platform", "mock"))
    configured = (settings.aether_os_bridge or "mock").strip().lower() or "mock"
    active = _active_driver(configured, platform)
    return {
        **bridge_status,
        "ok": True,
        "mode": configured,
        "configured_driver": configured,
        "active_driver": active,
        "platform": platform,
        "driver": active,
        "flags": {
            "capture": settings.aether_desktop_capture_enabled,
            "input": settings.aether_desktop_input_enabled,
            "notifications": settings.aether_desktop_notifications_enabled,
        },
        "scopes": get_scope_registry().status(profile_id),
        "token_required": bool((settings.aether_os_bridge_token or "").strip()),
        "routes": {
            "inspector": "/tools/os-bridge/inspector",
            "status": "/tools/os-bridge/status",
        },
    }



@router.get("/status")
async def bridge_status(
    profile_id: str = "local",
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_bridge_token(authorization)
    return _bridge_inspector_payload(profile_id)


@router.get("/inspector")
async def bridge_inspector(
    profile_id: str = "local",
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """
    Bridge status inspector — shows active driver as mock | desktop | android.
    Same payload as /status with an explicit active_driver field for ops/UI.
    """
    _check_bridge_token(authorization)
    payload = _bridge_inspector_payload(profile_id)
    payload["summary"] = (
        f"active_driver={payload['active_driver']} "
        f"configured={payload['configured_driver']} "
        f"platform={payload['platform']}"
    )
    return payload



@router.get("/scopes")
async def list_scopes(
    profile_id: str = "local",
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_bridge_token(authorization)
    return get_scope_registry().status(profile_id)


@router.post("/scopes/grant")
async def grant_scope(
    body: ScopeGrantBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_bridge_token(authorization)
    if not body.confirmed:
        pending = get_confirmation_engine().create(
            tool="system_control_tool",
            action=f"grant_scope:{body.scope}",
            arguments={
                "action": f"grant_scope:{body.scope}",
                "scope": body.scope,
                "confirmed": True,
                "ttl_s": body.ttl_s,
            },
            profile_id=body.profile_id,
            speak=f"Vou liberar o escopo «{body.scope}» por alguns minutos. Confirma?",
        )
        return {
            "ok": True,
            "status": "pending_confirmation",
            "pending_id": pending.id,
            "speak": pending.speak,
            "requires_confirmation": True,
            "scope": body.scope,
        }
    grant = get_scope_registry().grant(
        scope=body.scope,
        profile_id=body.profile_id,
        ttl_s=body.ttl_s,
        source="http",
    )
    return {"ok": True, "status": "granted", "grant": grant.to_dict()}


@router.post("/desktop-capture")
async def desktop_capture(
    body: DesktopCaptureBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    settings = get_settings()
    _check_bridge_token(authorization)
    _ensure_flag(settings.aether_desktop_capture_enabled, "desktopCapture")
    gate = _pending_or_scope(
        tool="system_control_tool",
        action="desktop_capture",
        arguments={"action": "desktop_capture", "max_width": body.max_width},
        profile_id=body.profile_id,
        confirmed=body.confirmed,
        scope="desktop_capture",
    )
    if gate:
        return gate
    bridge = get_os_bridge()
    capture = getattr(bridge, "capture", None)
    if capture is None:
        raise HTTPException(status_code=501, detail="desktop capture unavailable")
    result = capture.capture(max_width=body.max_width)
    return {**result.to_dict(), "status": "ok" if result.ok else "failed"}


@router.post("/notifications/read")
async def notifications_read(
    body: NotificationReadBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    settings = get_settings()
    _check_bridge_token(authorization)
    _ensure_flag(settings.aether_desktop_notifications_enabled, "notification_read")
    gate = _pending_or_scope(
        tool="system_control_tool",
        action="notification_read",
        arguments={"action": "notification_read", "limit": body.limit},
        profile_id=body.profile_id,
        confirmed=body.confirmed,
        scope="notification_read",
    )
    if gate:
        return gate
    bridge = get_os_bridge()
    reader = getattr(bridge, "notifications", None)
    if reader is None:
        events = await bridge.accessibility.poll_notifications()
        return {
            "ok": True,
            "status": "ok",
            "action": "notification_read",
            "data": {
                "notifications": [e.to_dict() for e in events[: body.limit]],
                "count": min(len(events), body.limit),
            },
            "mock": bridge.platform in {"mock", "web"},
        }
    result = await reader.read(limit=body.limit)
    return {**result.to_dict(), "status": "ok" if result.ok else "failed"}


@router.post("/keyboard")
async def keyboard_action(
    body: KeyboardBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    settings = get_settings()
    _check_bridge_token(authorization)
    _ensure_flag(settings.aether_desktop_input_enabled, "keyboard")
    gate = _pending_or_scope(
        tool="system_control_tool",
        action="keyboard",
        arguments={"action": "keyboard", "mode": body.mode, "text": body.text, "keys": body.keys},
        profile_id=body.profile_id,
        confirmed=body.confirmed,
        scope="keyboard",
    )
    if gate:
        return gate
    bridge = get_os_bridge()
    controller = getattr(bridge, "input", None)
    if controller is None:
        raise HTTPException(status_code=501, detail="keyboard unavailable")
    if body.mode == "hotkey":
        if not body.keys:
            raise HTTPException(status_code=400, detail="keys required")
        result = controller.hotkey(keys=body.keys)
    else:
        if not body.text:
            raise HTTPException(status_code=400, detail="text required")
        result = controller.type_text(text=body.text)
    return {**result.to_dict(), "status": "ok" if result.ok else "failed"}


@router.post("/mouse")
async def mouse_action(
    body: MouseBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    settings = get_settings()
    _check_bridge_token(authorization)
    _ensure_flag(settings.aether_desktop_input_enabled, "mouse")
    gate = _pending_or_scope(
        tool="system_control_tool",
        action="mouse",
        arguments={
            "action": "mouse",
            "mode": body.mode,
            "x": body.x,
            "y": body.y,
            "button": body.button,
            "delta": body.delta,
        },
        profile_id=body.profile_id,
        confirmed=body.confirmed,
        scope="mouse",
    )
    if gate:
        return gate
    bridge = get_os_bridge()
    controller = getattr(bridge, "input", None)
    if controller is None:
        raise HTTPException(status_code=501, detail="mouse unavailable")
    if body.mode == "scroll":
        result = controller.scroll(delta=body.delta)
    elif body.mode == "move":
        if body.x is None or body.y is None:
            raise HTTPException(status_code=400, detail="x and y required")
        result = controller.move(x=body.x, y=body.y)
    else:
        if body.x is None or body.y is None:
            raise HTTPException(status_code=400, detail="x and y required")
        result = controller.click(x=body.x, y=body.y, button=body.button)
    return {**result.to_dict(), "status": "ok" if result.ok else "failed"}


@router.post("/mobile/inject")
async def mobile_inject(
    body: MobileInjectBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_bridge_token(authorization)
    event = NotificationEvent(
        id=body.id or f"m_{uuid.uuid4().hex[:8]}",
        package=body.package,
        title=body.title,
        body=body.body,
        sender=body.sender,
        app=body.app,
        favorite=body.favorite,
        priority_hint=body.priority_hint,
        screen_lit=body.screen_lit,
        created_at=time.time(),
        extras={
            "visible_text": list(body.visible_text or []),
            "tree_summary": body.tree_summary,
            "source": "android_accessibility",
        },
    )
    bridge = get_os_bridge()
    acc = bridge.accessibility
    if hasattr(acc, "inject"):
        acc.inject(event)  # type: ignore[attr-defined]
    decision = get_notification_listener().ingest_event(event)
    return {"ok": True, "event": event.to_dict(), "decision": decision.to_dict()}


@router.post("/confirm-execute")
async def confirm_execute_pending(
    pending_id: str,
    profile_id: str = "local",
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_bridge_token(authorization)
    engine = get_confirmation_engine()
    pending = engine.pop(pending_id)
    if pending is None:
        return {"ok": False, "status": "no_pending", "error": "no pending action"}
    if pending.action.startswith("grant_scope:"):
        scope_name = pending.action.split(":", 1)[1]
        grant = get_scope_registry().grant(
            scope=scope_name,  # type: ignore[arg-type]
            profile_id=profile_id,
            ttl_s=pending.arguments.get("ttl_s"),
            source="confirm",
        )
        return {"ok": True, "status": "granted", "grant": grant.to_dict()}
    scope = action_to_scope(pending.action)
    if scope:
        get_scope_registry().grant(scope=scope, profile_id=profile_id, source="confirm")
    args = dict(pending.arguments)
    args["confirmed"] = True
    args["pending_id"] = pending.id
    settings = get_settings()
    result = await get_tool_registry().invoke(
        pending.tool,
        args,
        ctx=ToolContext(profile_id=profile_id, settings=settings, source="confirm"),
    )
    return result.to_dict()
