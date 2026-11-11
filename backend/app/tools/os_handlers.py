"""Handlers for hands-free OS automation tools (messaging / email / telephony / system)."""

from __future__ import annotations

from typing import Any

from app.config import Settings
from app.os_bridge.confirmation import (
    build_speak_summary,
    get_confirmation_engine,
    requires_confirmation,
)
from app.os_bridge.factory import get_os_bridge
from app.os_bridge.scope import get_scope_registry


def _action_of(args: dict[str, Any], default: str) -> str:
    return str(args.get("action") or default).strip() or default


async def messaging_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del settings
    bridge = get_os_bridge().messaging
    action = _action_of(args, "summarize")
    app = str(args.get("app") or "whatsapp").strip().lower() or "whatsapp"
    contact = str(args.get("contact") or "").strip()
    text = str(args.get("text") or "").strip()
    limit = int(args.get("limit") or 5)
    confirmed = bool(args.get("confirmed"))
    pending_id = str(args.get("pending_id") or "").strip() or None

    if action == "read":
        result = await bridge.read_threads(app=app, limit=limit)  # type: ignore[arg-type]
        return {**result.to_dict(), "tool": "messaging_tool", "status": "ok"}

    if action == "summarize":
        if not contact:
            return {"ok": False, "error": "contact required for summarize", "tool": "messaging_tool"}
        result = await bridge.summarize(app=app, contact=contact, limit=limit)  # type: ignore[arg-type]
        return {**result.to_dict(), "tool": "messaging_tool", "status": "ok"}

    if action in {"send", "voice_reply"}:
        if not contact or not text:
            return {
                "ok": False,
                "error": "contact and text required",
                "tool": "messaging_tool",
                "action": action,
            }
        if requires_confirmation("messaging_tool", action, confirmed=confirmed):
            pending = get_confirmation_engine().create(
                tool="messaging_tool",
                action=action,
                arguments={
                    "action": action,
                    "app": app,
                    "contact": contact,
                    "text": text,
                    "confirmed": True,
                },
                profile_id=profile_id,
            )
            return {
                "ok": True,
                "status": "pending_confirmation",
                "tool": "messaging_tool",
                "action": action,
                "pending_id": pending.id,
                "speak": pending.speak,
                "requires_confirmation": True,
            }
        if action == "voice_reply":
            result = await bridge.voice_reply(app=app, contact=contact, text=text)  # type: ignore[arg-type]
        else:
            result = await bridge.send_message(app=app, contact=contact, text=text)  # type: ignore[arg-type]
        payload = result.to_dict()
        return {
            **payload,
            "tool": "messaging_tool",
            "status": "executed",
            "pending_id": pending_id,
            "success_beep": True,
            "speak": f"Mensagem enviada para {contact}.",
        }

    return {"ok": False, "error": f"unknown action: {action}", "tool": "messaging_tool"}


async def email_calendar_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del settings
    bridge = get_os_bridge().calendar
    action = _action_of(args, "agenda")
    confirmed = bool(args.get("confirmed"))
    pending_id = str(args.get("pending_id") or "").strip() or None

    if action in {"read_email", "priority_email"}:
        result = await bridge.list_priority_email(limit=int(args.get("limit") or 5))
        return {**result.to_dict(), "tool": "email_calendar_tool", "status": "ok"}

    if action == "draft":
        to = str(args.get("to") or "").strip()
        subject = str(args.get("subject") or "").strip()
        body = str(args.get("body") or args.get("text") or "").strip()
        if not to or not body:
            return {"ok": False, "error": "to and body required", "tool": "email_calendar_tool"}
        result = await bridge.draft_email(to=to, subject=subject or "(no subject)", body=body)
        return {
            **result.to_dict(),
            "tool": "email_calendar_tool",
            "status": "ok",
            "speak": "Rascunho pronto. Quer que eu envie?",
        }

    if action == "send_draft":
        draft_id = str(args.get("draft_id") or "").strip()
        if not draft_id:
            return {"ok": False, "error": "draft_id required", "tool": "email_calendar_tool"}
        if requires_confirmation("email_calendar_tool", "send_draft", confirmed=confirmed):
            pending = get_confirmation_engine().create(
                tool="email_calendar_tool",
                action="send_draft",
                arguments={"action": "send_draft", "draft_id": draft_id, "confirmed": True},
                profile_id=profile_id,
            )
            return {
                "ok": True,
                "status": "pending_confirmation",
                "tool": "email_calendar_tool",
                "action": "send_draft",
                "pending_id": pending.id,
                "speak": pending.speak,
                "requires_confirmation": True,
            }
        result = await bridge.send_draft(draft_id=draft_id)
        return {
            **result.to_dict(),
            "tool": "email_calendar_tool",
            "status": "executed",
            "pending_id": pending_id,
            "success_beep": True,
            "speak": "E-mail enviado.",
        }

    if action == "schedule":
        title = str(args.get("title") or "").strip()
        when = str(args.get("when") or "").strip()
        if not title or not when:
            return {"ok": False, "error": "title and when required", "tool": "email_calendar_tool"}
        duration = int(args.get("duration_min") or 30)
        attendees = args.get("attendees") if isinstance(args.get("attendees"), list) else []
        if requires_confirmation("email_calendar_tool", "schedule", confirmed=confirmed):
            pending = get_confirmation_engine().create(
                tool="email_calendar_tool",
                action="schedule",
                arguments={
                    "action": "schedule",
                    "title": title,
                    "when": when,
                    "duration_min": duration,
                    "attendees": attendees,
                    "confirmed": True,
                },
                profile_id=profile_id,
            )
            return {
                "ok": True,
                "status": "pending_confirmation",
                "tool": "email_calendar_tool",
                "action": "schedule",
                "pending_id": pending.id,
                "speak": pending.speak,
                "requires_confirmation": True,
            }
        result = await bridge.schedule_appointment(
            title=title,
            when=when,
            duration_min=duration,
            attendees=[str(a) for a in attendees],
        )
        return {
            **result.to_dict(),
            "tool": "email_calendar_tool",
            "status": "executed",
            "pending_id": pending_id,
            "success_beep": True,
            "speak": f"Agendado: {title}.",
        }

    if action in {"agenda", "query_agenda"}:
        day = str(args.get("day") or "today")
        result = await bridge.query_agenda(day=day)
        return {**result.to_dict(), "tool": "email_calendar_tool", "status": "ok"}

    if action == "delete":
        event_id = str(args.get("event_id") or "").strip()
        if not event_id:
            return {"ok": False, "error": "event_id required", "tool": "email_calendar_tool"}
        if requires_confirmation("email_calendar_tool", "delete", confirmed=confirmed):
            pending = get_confirmation_engine().create(
                tool="email_calendar_tool",
                action="delete",
                arguments={"action": "delete", "event_id": event_id, "confirmed": True},
                profile_id=profile_id,
            )
            return {
                "ok": True,
                "status": "pending_confirmation",
                "tool": "email_calendar_tool",
                "action": "delete",
                "pending_id": pending.id,
                "speak": pending.speak,
                "requires_confirmation": True,
            }
        result = await bridge.delete_event(event_id=event_id)
        return {
            **result.to_dict(),
            "tool": "email_calendar_tool",
            "status": "executed",
            "pending_id": pending_id,
            "success_beep": True,
            "speak": "Evento apagado.",
        }

    return {"ok": False, "error": f"unknown action: {action}", "tool": "email_calendar_tool"}


async def telephony_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del settings
    bridge = get_os_bridge().telephony
    action = _action_of(args, "incoming")
    confirmed = bool(args.get("confirmed"))
    pending_id = str(args.get("pending_id") or "").strip() or None

    if action in {"incoming", "identify"}:
        result = await bridge.incoming_call()
        payload = result.to_dict()
        speak = str((payload.get("data") or {}).get("speak") or payload.get("detail") or "")
        return {**payload, "tool": "telephony_tool", "status": "ok", "speak": speak}

    if action in {"answer", "decline", "place_call"}:
        if requires_confirmation("telephony_tool", action, confirmed=confirmed):
            pending_args = {
                "action": action,
                "confirmed": True,
                "speaker": bool(args.get("speaker")),
                "contact": str(args.get("contact") or "").strip(),
            }
            pending = get_confirmation_engine().create(
                tool="telephony_tool",
                action=action,
                arguments=pending_args,
                profile_id=profile_id,
                speak=build_speak_summary("telephony_tool", action, pending_args),
            )
            return {
                "ok": True,
                "status": "pending_confirmation",
                "tool": "telephony_tool",
                "action": action,
                "pending_id": pending.id,
                "speak": pending.speak,
                "requires_confirmation": True,
            }
        if action == "answer":
            result = await bridge.answer(speaker=bool(args.get("speaker")))
            speak = "Chamada atendida."
        elif action == "decline":
            result = await bridge.decline()
            speak = "Chamada recusada."
        else:
            contact = str(args.get("contact") or "").strip()
            if not contact:
                return {"ok": False, "error": "contact required", "tool": "telephony_tool"}
            result = await bridge.place_call(contact=contact)
            speak = f"Ligando para {contact}."
        return {
            **result.to_dict(),
            "tool": "telephony_tool",
            "status": "executed",
            "pending_id": pending_id,
            "success_beep": True,
            "speak": speak,
        }

    return {"ok": False, "error": f"unknown action: {action}", "tool": "telephony_tool"}


def _scope_gate(
    *,
    action: str,
    args: dict[str, Any],
    profile_id: str,
    confirmed: bool,
    scope: str,
) -> dict[str, Any] | None:
    scopes = get_scope_registry()
    if scopes.has(scope=scope, profile_id=profile_id):  # type: ignore[arg-type]
        return None
    if requires_confirmation("system_control_tool", action, confirmed=confirmed):
        pending = get_confirmation_engine().create(
            tool="system_control_tool",
            action=action,
            arguments={**args, "action": action, "confirmed": True},
            profile_id=profile_id,
        )
        return {
            "ok": True,
            "status": "pending_confirmation",
            "tool": "system_control_tool",
            "action": action,
            "pending_id": pending.id,
            "speak": pending.speak,
            "requires_confirmation": True,
            "scope": scope,
        }
    scopes.grant(scope=scope, profile_id=profile_id, source="confirm")  # type: ignore[arg-type]
    return None


async def system_control_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del settings
    bundle = get_os_bridge()
    bridge = bundle.system
    action = _action_of(args, "battery")
    confirmed = bool(args.get("confirmed"))
    pending_id = str(args.get("pending_id") or "").strip() or None

    if action == "media":
        media_action = str(args.get("media_action") or args.get("media") or "pause").strip()
        result = await bridge.media(action=media_action)  # type: ignore[arg-type]
        return {**result.to_dict(), "tool": "system_control_tool", "status": "ok"}

    if action == "battery":
        result = await bridge.battery()
        return {**result.to_dict(), "tool": "system_control_tool", "status": "ok"}

    if action == "volume":
        level = int(args.get("level") if args.get("level") is not None else 50)
        result = await bridge.set_volume(level=level)
        return {**result.to_dict(), "tool": "system_control_tool", "status": "ok"}

    if action == "sound_mode":
        mode = str(args.get("mode") or "normal").strip().lower()
        result = await bridge.set_sound_mode(mode=mode)  # type: ignore[arg-type]
        return {**result.to_dict(), "tool": "system_control_tool", "status": "ok"}

    if action == "timer":
        minutes = int(args.get("minutes") or 5)
        label = str(args.get("label") or "")
        result = await bridge.set_timer(minutes=minutes, label=label)
        return {**result.to_dict(), "tool": "system_control_tool", "status": "ok"}

    if action == "alarm":
        time_hhmm = str(args.get("time") or args.get("time_hhmm") or "").strip()
        if not time_hhmm:
            return {"ok": False, "error": "time required (HH:MM)", "tool": "system_control_tool"}
        label = str(args.get("label") or "")
        result = await bridge.set_alarm(time_hhmm=time_hhmm, label=label)
        return {**result.to_dict(), "tool": "system_control_tool", "status": "ok"}

    if action == "delete_alarm":
        alarm_id = str(args.get("alarm_id") or "").strip()
        if not alarm_id:
            return {"ok": False, "error": "alarm_id required", "tool": "system_control_tool"}
        if requires_confirmation("system_control_tool", "delete_alarm", confirmed=confirmed):
            pending = get_confirmation_engine().create(
                tool="system_control_tool",
                action="delete_alarm",
                arguments={"action": "delete_alarm", "alarm_id": alarm_id, "confirmed": True},
                profile_id=profile_id,
            )
            return {
                "ok": True,
                "status": "pending_confirmation",
                "tool": "system_control_tool",
                "action": "delete_alarm",
                "pending_id": pending.id,
                "speak": pending.speak,
                "requires_confirmation": True,
            }
        native = getattr(bridge, "delete_alarm", None)
        if native is None:
            return {"ok": False, "error": "delete_alarm unsupported", "tool": "system_control_tool"}
        result = await native(alarm_id=alarm_id)
        return {
            **result.to_dict(),
            "tool": "system_control_tool",
            "status": "executed",
            "pending_id": pending_id,
            "success_beep": True,
        }

    if action in {"desktop_capture", "capture", "screenshot"}:
        gate = _scope_gate(
            action="desktop_capture",
            args={"max_width": int(args.get("max_width") or 1280)},
            profile_id=profile_id,
            confirmed=confirmed,
            scope="desktop_capture",
        )
        if gate:
            return gate
        capture = getattr(bundle, "capture", None)
        if capture is None:
            return {
                "ok": False,
                "error": "desktop capture unavailable (set AETHER_OS_BRIDGE=desktop)",
                "tool": "system_control_tool",
            }
        result = capture.capture(max_width=int(args.get("max_width") or 1280))
        return {
            **result.to_dict(),
            "tool": "system_control_tool",
            "status": "executed" if result.ok else "failed",
            "pending_id": pending_id,
            "success_beep": bool(result.ok),
        }

    if action in {"notification_read", "notifications", "read_notifications"}:
        gate = _scope_gate(
            action="notification_read",
            args={"limit": int(args.get("limit") or 10)},
            profile_id=profile_id,
            confirmed=confirmed,
            scope="notification_read",
        )
        if gate:
            return gate
        reader = getattr(bundle, "notifications", None)
        if reader is not None:
            result = await reader.read(limit=int(args.get("limit") or 10))
        else:
            events = await bundle.accessibility.poll_notifications()
            from app.os_bridge.contracts import BridgeResult

            result = BridgeResult(
                ok=True,
                action="notification_read",
                detail=f"{len(events)} notifications",
                data={"notifications": [e.to_dict() for e in events], "count": len(events)},
                mock=bundle.platform in {"mock", "web"},
            )
        return {
            **result.to_dict(),
            "tool": "system_control_tool",
            "status": "executed" if result.ok else "failed",
            "pending_id": pending_id,
            "success_beep": bool(result.ok),
        }

    if action in {"keyboard", "type", "hotkey"}:
        gate = _scope_gate(
            action="keyboard",
            args={"mode": args.get("mode") or action, "text": args.get("text"), "keys": args.get("keys")},
            profile_id=profile_id,
            confirmed=confirmed,
            scope="keyboard",
        )
        if gate:
            return gate
        controller = getattr(bundle, "input", None)
        if controller is None:
            return {
                "ok": False,
                "error": "keyboard unavailable (set AETHER_OS_BRIDGE=desktop)",
                "tool": "system_control_tool",
            }
        mode = str(args.get("mode") or action).strip().lower()
        if mode == "hotkey" or action == "hotkey":
            keys = args.get("keys") if isinstance(args.get("keys"), list) else []
            result = controller.hotkey(keys=[str(k) for k in keys])
        else:
            result = controller.type_text(text=str(args.get("text") or ""))
        return {
            **result.to_dict(),
            "tool": "system_control_tool",
            "status": "executed" if result.ok else "failed",
            "pending_id": pending_id,
            "success_beep": bool(result.ok),
        }

    if action in {"mouse", "click", "move", "scroll"}:
        gate = _scope_gate(
            action="mouse",
            args={
                "mode": args.get("mode") or action,
                "x": args.get("x"),
                "y": args.get("y"),
                "button": args.get("button"),
                "delta": args.get("delta"),
            },
            profile_id=profile_id,
            confirmed=confirmed,
            scope="mouse",
        )
        if gate:
            return gate
        controller = getattr(bundle, "input", None)
        if controller is None:
            return {
                "ok": False,
                "error": "mouse unavailable (set AETHER_OS_BRIDGE=desktop)",
                "tool": "system_control_tool",
            }
        mode = str(args.get("mode") or action).strip().lower()
        if mode == "scroll" or action == "scroll":
            result = controller.scroll(delta=int(args.get("delta") or 0))
        elif mode == "move" or action == "move":
            result = controller.move(x=int(args.get("x") or 0), y=int(args.get("y") or 0))
        else:
            result = controller.click(
                x=int(args.get("x") or 0),
                y=int(args.get("y") or 0),
                button=str(args.get("button") or "left"),
            )
        return {
            **result.to_dict(),
            "tool": "system_control_tool",
            "status": "executed" if result.ok else "failed",
            "pending_id": pending_id,
            "success_beep": bool(result.ok),
        }

    return {"ok": False, "error": f"unknown action: {action}", "tool": "system_control_tool"}
