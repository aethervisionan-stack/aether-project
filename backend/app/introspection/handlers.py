"""Introspection / help tool handlers (read-only — never require two-step confirm)."""

from __future__ import annotations

import logging
from typing import Any

from app import __version__
from app.config import Settings, get_settings
from app.introspection.manifest import (
    CAPABILITIES,
    CAPABILITY_CATEGORIES,
    build_feature_flags,
    capabilities_for_category,
    sync_tools_with_registry,
)
from app.introspection.telemetry import get_latency_telemetry
from app.os_bridge.factory import get_os_bridge

logger = logging.getLogger("aether.introspection.handlers")

# Full product vision — returned with capabilities so replies never collapse to one app.
AETHER_VISION_MANIFESTO = (
    "Aether Vision is a Strategic Real-Life Co-Pilot (engine v0.4.1) for wearables "
    "and earbuds — end-to-end resolution of real situations, not a task/scheduling "
    "assistant. It filters notifications by priority and user pace, speaks through "
    "VAD Open-Mic and Barge-In voice UX, learns long-term preferences, orchestrates "
    "the Tool Registry in parallel/chained calls for root-cause resolution, and "
    "requires two-step confirmation before irreversible OS actions. Messaging "
    "(WhatsApp/Telegram/etc.) is one hands-free channel among email, calendar, "
    "telephony, and device control — not the product definition."
)

VALUE_PROPOSITION = (
    "Strategic Real-Life Co-Pilot + autonomous OS agent on wearables: diagnose, "
    "plan, orchestrate tools, deliver expected outcomes — interrupt only when "
    "worth speaking, act by voice with confirm safety, remember user prefs."
)


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


def _voice_examples(caps: list[dict[str, Any]], *, limit: int = 6) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for entry in caps:
        title = str(entry.get("title") or entry.get("id") or "").strip()
        example = str(entry.get("example_voice") or "").strip()
        if title and example:
            out.append({"title": title, "example_voice": example})
        if len(out) >= limit:
            break
    return out


def _capabilities(args: dict[str, Any]) -> dict[str, Any]:
    category = args.get("category")
    cat = str(category).strip() if category is not None else None
    caps = capabilities_for_category(cat)
    voice_examples = _voice_examples(caps, limit=6)
    # Prefer identity + non-messaging pillars first in spoken summary.
    preferred_ids = (
        "identity",
        "notification_priority",
        "hardware_ux",
        "long_term_memory",
        "hands_free_os_agent",
        "frontier_ai",
        "self_help",
    )
    by_id = {e.id: e for e in CAPABILITIES if e.active}
    speak_bits: list[str] = []
    for cid in preferred_ids:
        entry = by_id.get(cid)
        if entry is None:
            continue
        if cat and cat.lower() not in {"", "all", "*"} and entry.category != cat.lower():
            continue
        speak_bits.append(f"{entry.title}: «{entry.example_voice}»")
        if len(speak_bits) >= 5:
            break
    if not speak_bits:
        for item in voice_examples[:4]:
            speak_bits.append(f"{item['title']}: «{item['example_voice']}»")

    registry = _registry()
    sync = sync_tools_with_registry(registry.list_names())

    return {
        "ok": True,
        "action": "get_system_capabilities",
        "category": cat or "all",
        "categories": list(CAPABILITY_CATEGORIES),
        "vision": AETHER_VISION_MANIFESTO,
        "value_proposition": VALUE_PROPOSITION,
        "pillars": [
            "hands-free background OS for wearables/earbuds",
            "notification priority + pace filter",
            "voice UX (VAD Open-Mic / Push-to-Talk / Barge-In)",
            "long-term memory",
            "two-step confirmation safety",
            "multi-channel OS agent (messaging is one pillar, not the product)",
        ],
        "capabilities": caps,
        "voice_examples": voice_examples,
        "tool_sync": sync,
        "requires_confirmation": False,
        "speak": (
            "Sou o Aether Vision — Co-Piloto de Vida Real v0.4.1 para wearables e earbuds, "
            "resolução ponta a ponta, não um gerente de WhatsApp nem assistente de agenda. "
            + VALUE_PROPOSITION
            + " Pilares com exemplos: "
            + "; ".join(speak_bits)
            + "."
        ),
        "engine": "v0.4.1 - Real Life Co-Pilot Engine",
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
        "engine": "v0.4.1 - Real Life Co-Pilot Engine",
        "backend_port": settings.port,
        "model": settings.gemini_live_model,
        "latency": latency,
        "ttft_ms": latency.get("ttft_ms"),
        "integrations": integrations,
        "introspection": build_feature_flags(),
        "vision": AETHER_VISION_MANIFESTO,
        "requires_confirmation": False,
        "speak": (
            f"Backend {__version__} ok na porta {settings.port}. "
            + (
                f"TTFT {latency['ttft_ms']:.0f} ms. "
                if isinstance(latency.get("ttft_ms"), (int, float))
                else "TTFT ainda sem amostra do LatencyTracker. "
            )
            + "Introspection e system_help_tool ativos; ferramentas registradas: "
            + str(len(sync["registered"]))
            + "."
        ),
        "source": "tool:system_help_tool",
    }
