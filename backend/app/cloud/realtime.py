"""Realtime message / HUD sync via Supabase Realtime broadcast + REST mirror."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from app.cloud.supabase_client import get_supabase
from app.config import get_settings

logger = logging.getLogger("aether.cloud.realtime")

EVENTS_TABLE = "aether_hud_events"
CHANNEL_PREFIX = "hud"


def channel_name(user_id: str) -> str:
    uid = (user_id or "local").strip() or "local"
    return f"{CHANNEL_PREFIX}:{uid}"


def publish_hud_event(
    user_id: str,
    *,
    event_type: str,
    payload: dict[str, Any],
    device_id: str | None = None,
) -> dict[str, Any]:
    uid = (user_id or "local").strip() or "local"
    settings = get_settings()
    now = time.time()
    event_id = uuid.uuid4().hex[:16]
    row = {
        "id": event_id,
        "user_id": uid,
        "event_type": (event_type or "hud")[:64],
        "payload": payload if isinstance(payload, dict) else {"value": payload},
        "device_id": device_id,
        "created_at": now,
    }

    if not settings.supabase_configured() or uid == "local":
        return {
            "ok": True,
            "source": "local_noop",
            "channel": channel_name(uid),
            "event_id": event_id,
            "created_at": now,
            "latency_note": (
                "Supabase unset — event kept local only. "
                "For <100ms cross-device HUD, configure same-region Realtime WS."
            ),
        }

    sb = get_supabase()
    status, body = sb.upsert_rows(EVENTS_TABLE, row)
    mirrored = bool(status) and 200 <= status < 300

    broadcast_ok = False
    if settings.supabase_service_role_key.strip():
        topic = f"realtime:{channel_name(uid)}"
        b_status, _ = sb.request(
            "POST",
            "/realtime/v1/api/broadcast",
            body={
                "messages": [
                    {
                        "topic": topic,
                        "event": event_type or "hud",
                        "payload": {
                            "id": event_id,
                            "user_id": uid,
                            "event_type": event_type,
                            "payload": row["payload"],
                            "device_id": device_id,
                            "created_at": now,
                        },
                    }
                ]
            },
            timeout=4.0,
        )
        broadcast_ok = bool(b_status) and 200 <= b_status < 300
        if not broadcast_ok:
            logger.debug("realtime broadcast soft-fail status=%s", b_status)

    return {
        "ok": mirrored or broadcast_ok,
        "source": "supabase",
        "channel": channel_name(uid),
        "event_id": event_id,
        "mirrored": mirrored,
        "broadcast": broadcast_ok,
        "created_at": now,
        "http_status": status,
        "latency_note": (
            "Target <100ms requires client Realtime WS in the same region as "
            "the Supabase project. This HTTP mirror/broadcast path is typically "
            "80-250ms+ and is for catch-up / server fan-out."
        ),
    }


def recent_events(user_id: str, *, limit: int = 40) -> dict[str, Any]:
    uid = (user_id or "local").strip() or "local"
    settings = get_settings()
    if not settings.supabase_configured() or uid == "local":
        return {"ok": True, "source": "local", "user_id": uid, "events": []}

    lim = max(1, min(int(limit), 100))
    status, rows = get_supabase().select(
        EVENTS_TABLE,
        query=f"select=*&user_id=eq.{uid}&order=created_at.desc&limit={lim}",
    )
    events = rows if isinstance(rows, list) else []
    return {
        "ok": bool(status) and 200 <= status < 300,
        "source": "supabase",
        "user_id": uid,
        "channel": channel_name(uid),
        "events": events,
        "http_status": status,
    }
