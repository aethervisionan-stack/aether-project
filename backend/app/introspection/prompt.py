"""Generate Live system-prompt blocks from the capabilities manifest (SoT)."""

from __future__ import annotations

from typing import Any, Iterable

from app import __version__
from app.introspection.manifest import CAPABILITIES, sync_tools_with_registry


def build_communication_guidelines() -> str:
    """Earbud-TTS friendly help style — inject beside self-knowledge."""
    from app.persona.real_life_copilot import ENGINE_ACTIVATION_BANNER

    return (
        f"Communication guidelines ({ENGINE_ACTIVATION_BANNER}):\n"
        "- When the user asks what you can do, the project vision, value proposition, "
        "or available tools: you MUST first invoke system_help_tool "
        "(get_system_capabilities and/or get_system_health). Do not answer from memory alone.\n"
        "- After the tool returns, answer from that data + the manifesto — never a shallow "
        "'WhatsApp manager' pitch. Cover Strategic Real-Life Co-Pilot / end-to-end "
        "resolution, hands-free OS for wearables/earbuds, notification priority/pace, "
        "voice UX (VAD/Barge-In), long-term memory, and two-step confirmation safety.\n"
        "- Always give at least one immediate practical voice example per pillar you mention.\n"
        "- Tone: direct, assertive, cinematic JARVIS/HUD. No redundant greetings; never "
        "'Em que posso ajudar?'. Structure non-trivial replies as Diagnóstico Inicial → "
        "Plano Passo a Passo → Execução com Ferramentas → Resultado Esperado.\n"
        "- Prefer chained/parallel Tool Registry calls for root-cause resolution before "
        "answering. For irreversible OS actions: preview + wait for confirm words."
    )


def build_self_knowledge_block(
    *,
    registered_tools: Iterable[str] | None = None,
    health_flags: dict[str, Any] | None = None,
) -> str:
    """
    Structured self-knowledge section for the main AI system prompt.

    Synchronized with Tool Registry + optional /health-style flags so the model
    never relies on a stale hardcoded essay.
    """
    registered = list(registered_tools) if registered_tools is not None else None
    sync = (
        sync_tools_with_registry(registered)
        if registered is not None
        else None
    )
    active_tools = sync["active"] if sync else None

    from app.persona.real_life_copilot import ENGINE_ACTIVATION_BANNER

    lines: list[str] = [
        "=== Aether Vision self-knowledge (live capabilities) ===",
        f"Backend version: {__version__}. Engine: {ENGINE_ACTIVATION_BANNER}.",
        "Role: Strategic Real-Life Co-Pilot — end-to-end resolution for wearables/"
        "earbuds (not a task/scheduling assistant). Hands-free OS agent + "
        "autonomous tool orchestration.",
        "Manifesto (never flatten to a single app): real-life root-cause resolution; "
        "notification priority/pace filter; voice UX with VAD Open-Mic + Barge-In; "
        "long-term memory; two-step confirm safety; messaging is one pillar among "
        "several — not the product definition.",
        "MANDATORY: if the user asks about project vision, what you can do, value "
        "proposition, available tools, or system health — you MUST invoke "
        "system_help_tool (get_system_capabilities and/or get_system_health) before "
        "answering. Do not improvise a simplified WhatsApp-manager answer.",
    ]

    for entry in CAPABILITIES:
        if not entry.active:
            continue
        # Skip help meta-entry in the spoken feature map (still available via tool).
        if entry.id == "self_help":
            continue
        # If a tool set is declared, require at least one registered tool (or none declared).
        if active_tools is not None and entry.tools:
            if not any(t in active_tools for t in entry.tools):
                continue
        # Soft-gate on health flags when provided (nested dotted paths).
        if health_flags is not None and entry.health_flags:
            if not _any_flag_true(health_flags, entry.health_flags):
                # Identity always stays; others may drop if explicitly false.
                if entry.category != "identity":
                    # Missing keys count as enabled (optimistic); only drop on False.
                    if _any_flag_explicitly_false(health_flags, entry.health_flags):
                        continue

        ver = f" (v{entry.version})" if entry.version else ""
        tool_bit = ""
        if entry.tools:
            shown = [
                t
                for t in entry.tools
                if active_tools is None or t in active_tools or t == "system_help_tool"
            ]
            if shown:
                tool_bit = f" Tools: {', '.join(shown)}."
        hud_bit = f" HUD: {', '.join(entry.hud_surfaces)}." if entry.hud_surfaces else ""
        lines.append(
            f"- {entry.title}{ver}: {entry.description}{tool_bit}{hud_bit} "
            f'Example: «{entry.example_voice}»'
        )

    if sync is not None:
        lines.append(
            "Active Tool Registry: " + (", ".join(sync["registered"]) or "(none)") + "."
        )
        if sync["missing_from_registry"]:
            lines.append(
                "Note: manifest tools not yet registered: "
                + ", ".join(sync["missing_from_registry"])
                + "."
            )

    lines.append(
        "REQUIRED tool for vision / capabilities / value / tools / health questions: "
        "system_help_tool (get_system_capabilities / get_system_health) — read-only, "
        "no confirm. Speak from tool results with practical voice examples."
    )
    return "\n".join(lines)


def _dig(flags: dict[str, Any], path: str) -> Any:
    cur: Any = flags
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _any_flag_true(flags: dict[str, Any], paths: tuple[str, ...]) -> bool:
    for path in paths:
        val = _dig(flags, path)
        if val is None:
            return True  # unknown → treat as active
        if val is True:
            return True
    return False


def _any_flag_explicitly_false(flags: dict[str, Any], paths: tuple[str, ...]) -> bool:
    vals = [_dig(flags, p) for p in paths]
    present = [v for v in vals if v is not None]
    if not present:
        return False
    return all(v is False for v in present)
