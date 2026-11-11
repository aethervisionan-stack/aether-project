"""Select mock vs native desktop / mobile OS bridge from env."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.os_bridge.contracts import OsBridgeBundle
from app.os_bridge.mock import MockOsBridgeBundle


def _attach_google_calendar(bundle: OsBridgeBundle, *, profile_id: str = "local") -> OsBridgeBundle:
    """
    Prefer live Gmail/Calendar when an OAuth session token exists.
    Workspace tools use the stored user token — never the OAuth client secret.
    """
    try:
        from app.auth.google_oauth import get_google_oauth_service
        from app.tools.google.bridge import HybridCalendarBridge, google_credentials_ready
    except Exception:  # noqa: BLE001 — auth/google optional at import time
        return bundle

    bundle.calendar = HybridCalendarBridge(profile_id=profile_id)
    original_status = bundle.status

    def status_with_google() -> dict[str, Any]:
        base = original_status()
        live = google_credentials_ready(profile_id)
        base["google"] = {
            "email_calendar_live": live,
            "oauth": get_google_oauth_service().status(profile_id),
        }
        if live and base.get("platform") in {"mock", "web"}:
            # Keep native desktop/android platform label when bridge is real.
            base["email_calendar_source"] = "google"
            base["mock_email_calendar"] = False
        elif live:
            base["email_calendar_source"] = "google"
            base["mock_email_calendar"] = False
        else:
            base["email_calendar_source"] = "mock"
            base["mock_email_calendar"] = True
        return base

    bundle.status = status_with_google  # type: ignore[method-assign]
    return bundle


@lru_cache
def get_os_bridge() -> OsBridgeBundle:
    """
    AETHER_OS_BRIDGE:
      - mock (default DEV fallback; documented + off for production)
      - desktop — Win32 automation (system_control_tool real path)
      - android — accessibility via mobile WS IPC
    """
    from app.config import get_settings

    settings = get_settings()
    mode = (settings.aether_os_bridge or "mock").strip().lower()
    if mode == "desktop":
        from app.os_bridge.desktop import build_desktop_bundle

        bundle: OsBridgeBundle = build_desktop_bundle()
    elif mode == "android":
        from app.os_bridge.desktop import build_desktop_bundle

        bundle = build_desktop_bundle()
        bundle.platform = "android"
    else:
        bundle = MockOsBridgeBundle()
    return _attach_google_calendar(bundle)


def reset_os_bridge_cache() -> None:
    get_os_bridge.cache_clear()
