"""Core runtime helpers (env bootstrap, memory).

Keep this package init lazy to avoid circular imports:
`app.config` → `app.core.config` must not pull in `memory` → `app.config`.
"""

from __future__ import annotations

from typing import Any

__all__ = ["AdaptiveMemory", "get_adaptive_memory", "load_backend_dotenv"]


def __getattr__(name: str) -> Any:
    if name in ("AdaptiveMemory", "get_adaptive_memory"):
        from app.core.memory import AdaptiveMemory, get_adaptive_memory

        return AdaptiveMemory if name == "AdaptiveMemory" else get_adaptive_memory
    if name == "load_backend_dotenv":
        from app.core.config import load_backend_dotenv

        return load_backend_dotenv
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
