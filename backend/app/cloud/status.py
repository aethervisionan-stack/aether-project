"""Public capability flags for /health and /cloud/status (no secrets)."""

from __future__ import annotations

from typing import Any

from app.config import Settings, get_settings


def cloud_status(settings: Settings | None = None) -> dict[str, Any]:
    s = settings or get_settings()
    supabase_on = s.supabase_configured()
    vector_backend = s.cloud_vector_backend_resolved()
    return {
        "enabled": supabase_on or vector_backend != "off",
        "supabase": {
            "configured": supabase_on,
            "auth": supabase_on,
            "session_sync": supabase_on,
            "realtime_hud": supabase_on,
            "url_host": s.supabase_url_host(),
        },
        "vector": {
            "backend": vector_backend,
            "configured": vector_backend != "off",
            "isolation": "user_id",
            "kinds": ["interaction", "summary", "preference", "context"],
        },
        "latency": {
            "target_hud_ms": 100,
            "note": (
                "Sub-100ms HUD sync needs same-region Supabase Realtime WebSocket "
                "(client <-> Supabase). Cross-region or HTTP poll paths typically "
                "land 80-250ms+. Live PCM audio stays on the local FastAPI WS and "
                "is not routed through Supabase."
            ),
        },
    }
