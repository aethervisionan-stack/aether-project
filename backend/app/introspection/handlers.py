"""Introspection / help tool handlers (read-only — never require two-step confirm)."""

from __future__ import annotations

import logging
from typing import Any

from app import __version__
from app.config import Settings, get_settings
from app.introspection.manifest import (
    CAPABILITY_CATEGORIES,
    build_feature_flags,
    capabilities_for_category,
    sync_tools_with_registry,
)
from app.introspection.telemetry import get_latency_telemetry
from app.os_bridge.mock import get_os_bridge

logger = logging.getLogger("aether.introspection.handlers")


def _registry():
    # Lazy import avoids circular load with ToolRegistry defaults.
    from app.tools.registry import get_tool_registry

    return get_tool_registry()


async def system_help_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    """
    Unified help tool.

    Actions:
      - get_system_capabilities (optional category)
      - get_system_health
    """
    del profile_id  # help is process-global
    cfg = settings or get_settings()
    action = str(args.get("action") or args.get("op") or "").strip()
    # Allow shorthand: category alone → capabilities; bare health keyword.
    if not action:
        if args.get("category") is not None:
            action = "get_system_capabilities"
        else:
            action = "get_system_capabilities"

    if action in {
        "get_system_capabilities",
        "capabilities",
        "help",
        "what_can_you_do",
    }:
        return _capabilities(args)

    if action in {"get_system_health", "health", "status"}:
        return _health(cfg)

    return {
        "ok": False,
        "error": f"unknown action: {action}",
        "allowed": ["get_system_capabilities", "get_system_health"],
        "requires_confirmation": False,
    }


def _capabilities(args: dict[str, Any]) -> dict[str, Any]:
    category = args.get("category")
    cat = str(category).strip() if category is not None else None
    caps = capabilities_for_category(cat)
    # Practical voice examples always present on each entry.
    speak_bits: list[str] = []
    for entry in caps[:4]:
        title = entry.get("title") or entry.get("id")
        example = entry.get("example_voice") or ""
        if title and example:
            speak_bits.append(f"{title}: «{example}»")

    registry = _registry()
    sync = sync_tools_with_registry(registry.list_names())

    return {
        "ok": True,
        "action": "get_system_capabilities",
        "category": cat or "all",
        "categories": list(CAPABILITY_CATEGORIES),
        "capabilities": caps,
        "tool_sync": sync,
        "requires_confirmation": False,
        "speak": (
            "Posso ajudar com: "
            + "; ".join(speak_bits[:3])
            + ". Exemplo: «"
            + str((caps[0].get("example_voice") if caps else None) or "O que você consegue fazer?")
            + "»."
        ),
        "source": "tool:system_help_tool",
    }


def _health(settings: Settings) -> dict[str, Any]:
    registry = _registry()
    bridge = get_os_bridge()
    latency = get_latency_telemetry()
    sync = sync_tools_with_registry(registry.list_names())

    integrations = {
        "gemini_api_key": settings.has_api_key(),
        "stripe": settings.has_stripe(),
        "solana_mode": (
            "live_prepared" if settings.solana_live_transfers_enabled() else "stub"
        ),
        "memory_enabled": settings.memory_enabled,
        "os_bridge": bridge.status(),
        "tools_registered": sync["registered"],
        "tool_sync_ok": len(sync["missing_from_registry"]) == 0,
    }

    return {
        "ok": True,
        "action": "get_system_health",
        "status": "ok",
        "service": "aether-vision-live",
        "version": __version__,
        "backend_port": settings.port,
        "model": settings.gemini_live_model,
        "latency": latency,
        "ttft_ms": latency.get("ttft_ms"),
        "integrations": integrations,
        "introspection": build_feature_flags(),
        "requires_confirmation": False,
        "speak": (
            f"Backend {__version__} ok na porta {settings.port}. "
            + (
                f"TTFT {latency['ttft_ms']:.0f} ms."
                if isinstance(latency.get("ttft_ms"), (int, float))
                else "TTFT ainda sem amostra do LatencyTracker."
            )
        ),
        "source": "tool:system_help_tool",
    }
