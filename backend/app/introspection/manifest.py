"""
Single source of truth for Aether Vision capabilities.

Keep this synchronized with:
- Tool Registry names (`app.tools.registry`)
- `/health` feature flags (`app.main.health`)
- Active HUD surfaces (MemoryInspector, LatencyTracker, VAD/PTT/Barge-In)
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from app import __version__

CapabilityCategory = Literal[
    "identity",
    "hands_free",
    "notifications",
    "hardware",
    "memory",
    "frontier",
    "billing",
    "help",
]


@dataclass(frozen=True)
class CapabilityEntry:
    id: str
    category: CapabilityCategory
    title: str
    version: str | None
    description: str
    example_voice: str
    tools: tuple[str, ...] = ()
    hud_surfaces: tuple[str, ...] = ()
    health_flags: tuple[str, ...] = ()
    active: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Ordered feature map injected into the Live system prompt.
CAPABILITIES: tuple[CapabilityEntry, ...] = (
    CapabilityEntry(
        id="identity",
        category="identity",
        title="Identity & purpose",
        version=__version__,
        description=(
            "Aether Vision is a Strategic Real-Life Co-Pilot (engine v0.4.1) for "
            "wearables and earbuds — end-to-end resolution, not a task/scheduling "
            "assistant or WhatsApp manager. Value: diagnose → plan → orchestrate "
            "tools → expected outcome, with notification priority/pace filtering, "
            "VAD/Barge-In voice UX, long-term memory, and two-step confirmation safety."
        ),
        example_voice="Aether, o que você consegue fazer agora?",
        tools=(),
        hud_surfaces=("HUD",),
        health_flags=("status",),
    ),
    CapabilityEntry(
        id="hands_free_os_agent",
        category="hands_free",
        title="Hands-Free OS Agent",
        version="0.4.0",
        description=(
            "Full OS agent over messaging (WhatsApp/Telegram/SMS/Instagram), email, "
            "calendar, telephony, and device controls. Messaging is one channel — "
            "not the product. Irreversible send/schedule/call/delete actions use "
            "two-step voice confirm (preview → Sim / Pode enviar / Yes)."
        ),
        example_voice="Resume as últimas mensagens do WhatsApp do Carlos.",
        tools=(
            "messaging_tool",
            "email_calendar_tool",
            "telephony_tool",
            "system_control_tool",
        ),
        hud_surfaces=("DevToolsPanel", "ConfirmationLoop"),
        health_flags=(
            "hands_free.os_agent",
            "hands_free.messaging_tool",
            "hands_free.email_calendar_tool",
            "hands_free.telephony_tool",
            "hands_free.system_control_tool",
            "hands_free.two_step_confirm",
        ),
    ),
    CapabilityEntry(
        id="notification_priority",
        category="notifications",
        title="Notification control & priority",
        version=None,
        description=(
            "Background smart filter by relevance plus user motion/pace — "
            "interrupts only when worth speaking."
        ),
        example_voice="Só me interrompa se for mensagem importante enquanto eu estiver andando.",
        tools=(),
        hud_surfaces=("NotificationListener", "NotificationPriority"),
        health_flags=(
            "mobility.notifications",
            "mobility.priority_manager",
            "hands_free.notification_listener",
        ),
    ),
    CapabilityEntry(
        id="hardware_ux",
        category="hardware",
        title="Hardware & UX",
        version=None,
        description=(
            "Earbuds / smart glasses: VAD Open-Mic (no wake words), Push-to-Talk, and Barge-In."
        ),
        example_voice="Fica em open-mic e me deixa interromper quando eu falar.",
        tools=(),
        hud_surfaces=("VadController", "PushToTalk", "BargeInController", "MobilityPanel"),
        health_flags=(
            "mobility.vad_open_mic",
            "mobility.push_to_talk",
            "mobility.barge_in",
            "mobility.audio_profile",
        ),
    ),
    CapabilityEntry(
        id="long_term_memory",
        category="memory",
        title="Long-term memory",
        version=None,
        description=(
            "Continuous preference learning; view and edit via MemoryInspector in the HUD."
        ),
        example_voice="Lembra que eu prefiro respostas curtas em português.",
        tools=("memory_payload",),
        hud_surfaces=("MemoryInspector",),
        health_flags=("memory_enabled", "frontier.memory_runtime"),
    ),
    CapabilityEntry(
        id="frontier_ai",
        category="frontier",
        title="Frontier AI",
        version=None,
        description=(
            "Async Chain-of-Thought, modular Tool Registry, and ultra-low-latency "
            "multimodal pipeline (LatencyTracker)."
        ),
        example_voice="Roda o teste de latência e me fala o TTFT.",
        tools=(
            "solana_treasury_query",
            "onchain_lookup",
            "run_test_routine",
            "system_help_tool",
        ),
        hud_surfaces=("LatencyTracker", "DevToolsPanel", "FrameCapture"),
        health_flags=(
            "frontier.cot",
            "frontier.tools",
            "frontier.multimodal",
            "frontier.token_streaming",
        ),
    ),
    CapabilityEntry(
        id="self_help",
        category="help",
        title="Self-awareness & help",
        version=None,
        description=(
            "Ask what Aether can do or check live health/integrations via system_help_tool "
            "(read-only; no confirm step)."
        ),
        example_voice="Quais ferramentas estão ativas agora?",
        tools=("system_help_tool",),
        hud_surfaces=("DevToolsPanel",),
        health_flags=("introspection.self_knowledge", "introspection.system_help_tool"),
    ),
)

CAPABILITY_CATEGORIES: tuple[str, ...] = tuple(
    dict.fromkeys(entry.category for entry in CAPABILITIES)
)


def list_capability_summaries(*, active_only: bool = True) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for entry in CAPABILITIES:
        if active_only and not entry.active:
            continue
        out.append(entry.to_dict())
    return out


def capabilities_for_category(
    category: str | None,
    *,
    active_only: bool = True,
) -> list[dict[str, Any]]:
    if not category or category.strip().lower() in {"", "all", "*"}:
        return list_capability_summaries(active_only=active_only)
    wanted = category.strip().lower()
    return [
        e.to_dict()
        for e in CAPABILITIES
        if e.category == wanted and (e.active or not active_only)
    ]


def active_tool_names_from_manifest() -> list[str]:
    names: list[str] = []
    for entry in CAPABILITIES:
        if not entry.active:
            continue
        for tool in entry.tools:
            if tool not in names:
                names.append(tool)
    return names


def build_feature_flags() -> dict[str, Any]:
    """Compact flags for /health — mirrors active HUD + registry-backed features."""
    return {
        "self_knowledge": True,
        "system_help_tool": True,
        "capabilities_manifest": True,
        "version": __version__,
        "categories": list(CAPABILITY_CATEGORIES),
        "active_tools": active_tool_names_from_manifest(),
    }


def sync_tools_with_registry(registered: list[str] | set[str] | tuple[str, ...]) -> dict[str, Any]:
    """
    Diff manifest-declared tools vs live Tool Registry.

    Prompt generation prefers registry ∩ manifest so stale essay text cannot
    advertise tools that are not actually registered.
    """
    reg = set(registered)
    declared = set(active_tool_names_from_manifest())
    return {
        "registered": sorted(reg),
        "declared": sorted(declared),
        "active": sorted(reg & declared),
        "missing_from_registry": sorted(declared - reg),
        "extra_in_registry": sorted(reg - declared),
    }
