"""Select mock vs native desktop / mobile OS bridge from env."""

from __future__ import annotations

from functools import lru_cache

from app.os_bridge.contracts import OsBridgeBundle
from app.os_bridge.mock import MockOsBridgeBundle


@lru_cache
def get_os_bridge() -> OsBridgeBundle:
    """
    AETHER_OS_BRIDGE:
      - mock (default)
      - desktop — Win32 automation
      - android — accessibility via mobile WS IPC
    """
    from app.config import get_settings

    settings = get_settings()
    mode = (settings.aether_os_bridge or "mock").strip().lower()
    if mode == "desktop":
        from app.os_bridge.desktop import build_desktop_bundle

        return build_desktop_bundle()
    if mode == "android":
        from app.os_bridge.desktop import build_desktop_bundle

        bundle = build_desktop_bundle()
        bundle.platform = "android"
        return bundle
    return MockOsBridgeBundle()


def reset_os_bridge_cache() -> None:
    get_os_bridge.cache_clear()
