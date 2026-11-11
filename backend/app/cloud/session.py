"""Cloud session state — preferences + HUD meta synced per user_id."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.cloud.supabase_client import get_supabase
from app.config import get_settings
from app.memory.store import get_memory_store

logger = logging.getLogger("aether.cloud.session")

TABLE = "aether_sessions"


def pull_session(user_id: str) -> dict[str, Any]:
    uid = (user_id or "local").strip() or "local"
    settings = get_settings()
    local = get_memory_store().snapshot(uid)

    if not settings.supabase_configured() or uid == "local":
        return {
            "ok": True,
            "source": "local",
            "user_id": uid,
            "session": local,
            "synced_at": None,
        }

    sb = get_supabase()
    status, rows = sb.select(
        TABLE,
        query=f"select=*&user_id=eq.{uid}&order=updated_at.desc&limit=1",
    )
    remote: dict[str, Any] | None = None
    if status and 200 <= status < 300 and isinstance(rows, list) and rows:
        remote = rows[0] if isinstance(rows[0], dict) else None

    if remote:
        remote_prefs = (
            remote.get("preferences")
            if isinstance(remote.get("preferences"), dict)
            else {}
        )
        remote_updated = float(remote.get("updated_at") or 0)
        local_updated = float(local.get("updated_at") or 0)
        if remote_prefs and remote_updated >= local_updated:
            try:
                get_memory_store().update_preferences(
                    uid, preferences=remote_prefs, merge=True
                )
                local = get_memory_store().snapshot(uid)
            except Exception:
                logger.debug("local merge from cloud failed", exc_info=True)
        return {
            "ok": True,
            "source": "supabase",
            "user_id": uid,
            "session": {
                **local,
                "hud": remote.get("hud") if isinstance(remote.get("hud"), dict) else {},
                "device_id": remote.get("device_id"),
                "cloud_updated_at": remote.get("updated_at"),
            },
            "synced_at": remote.get("updated_at"),
        }

    push_session(uid, preferences=local.get("preferences") or {}, hud={}, device_id=None)
    return {
        "ok": True,
        "source": "local_seeded",
        "user_id": uid,
        "session": local,
        "synced_at": time.time(),
    }


def push_session(
    user_id: str,
    *,
    preferences: dict[str, Any] | None = None,
    hud: dict[str, Any] | None = None,
    device_id: str | None = None,
    merge_prefs: bool = True,
) -> dict[str, Any]:
    uid = (user_id or "local").strip() or "local"
    settings = get_settings()
    store = get_memory_store()

    if preferences is not None:
        store.update_preferences(uid, preferences=preferences, merge=merge_prefs)

    snap = store.snapshot(uid)
    now = time.time()

    if not settings.supabase_configured() or uid == "local":
        return {
            "ok": True,
            "source": "local",
            "user_id": uid,
            "session": snap,
            "synced_at": now,
        }

    row = {
        "user_id": uid,
        "preferences": snap.get("preferences") or {},
        "hud": hud if isinstance(hud, dict) else {},
        "device_id": device_id,
        "updated_at": now,
        "profile_id": uid,
    }
    status, body = get_supabase().upsert_rows(TABLE, row, on_conflict="user_id")
    ok = bool(status) and 200 <= status < 300
    if not ok:
        logger.info(
            "cloud session upsert failed status=%s body=%s", status, str(body)[:200]
        )
    return {
        "ok": ok,
        "source": "supabase" if ok else "local_fallback",
        "user_id": uid,
        "session": {**snap, "hud": row["hud"], "device_id": device_id},
        "synced_at": now,
        "http_status": status,
    }
