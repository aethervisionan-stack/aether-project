"""Build Live system instructions + runtime decision guidance from learned prefs."""

from __future__ import annotations

from typing import Any, Iterable

from app.config import AETHER_SYSTEM_INSTRUCTION
from app.introspection.prompt import (
    build_communication_guidelines,
    build_self_knowledge_block,
)
from app.memory.store import Preferences
from app.mobility.copilot import CopilotMode, build_copilot_guidance, parse_copilot_mode


def preferences_summary(prefs: Preferences | dict[str, Any] | None) -> str:
    if prefs is None:
        return ""
    if isinstance(prefs, dict):
        prefs = Preferences.from_dict(prefs)

    parts: list[str] = []
    if prefs.tone:
        parts.append(f"tone={prefs.tone}")
    if prefs.style:
        parts.append(f"style={prefs.style}")
    if prefs.technical_level:
        parts.append(f"technical_level={prefs.technical_level}")
    if prefs.language:
        parts.append(f"language={prefs.language}")
    if prefs.frequent_commands:
        cmds = ", ".join(prefs.frequent_commands[:5])
        parts.append(f"frequent=[{cmds}]")
    if prefs.notes.strip():
        parts.append(f"notes={prefs.notes.strip()[:160]}")
    return "; ".join(parts)


def build_system_instruction(
    prefs: Preferences | dict[str, Any] | None = None,
    *,
    copilot_mode: CopilotMode | str | None = None,
    mobility_extra: str | None = None,
    registered_tools: Iterable[str] | None = None,
    health_flags: dict[str, Any] | None = None,
    include_self_knowledge: bool = True,
) -> str:
    """
    Base Aether HUD persona + optional learned preference block + mobility modes
    + dynamic self-knowledge (capabilities manifest ∩ Tool Registry).

    Keeps replies short; preferences adapt tone/depth without breaking HUD style.
    """
    base = AETHER_SYSTEM_INSTRUCTION.strip()
    parts: list[str] = [base]
    if include_self_knowledge:
        tools = list(registered_tools) if registered_tools is not None else None
        if tools is None:
            try:
                from app.tools.registry import get_tool_registry

                tools = get_tool_registry().list_names()
            except Exception:
                tools = None
        parts.append(
            build_self_knowledge_block(
                registered_tools=tools,
                health_flags=health_flags,
            )
        )
        parts.append(build_communication_guidelines())
    summary = preferences_summary(prefs)
    if summary:
        adapt = (
            "Learned user preferences (adapt quietly; still reply in 1–3 short HUD sentences): "
            f"{summary}. "
            "If language is set, prefer that language. "
            "If technical_level=advanced, use precise terms; if simple, avoid jargon."
        )
        parts.append(adapt)
    if copilot_mode is not None:
        parts.append(build_copilot_guidance(parse_copilot_mode(copilot_mode)))
    if mobility_extra and mobility_extra.strip():
        parts.append(mobility_extra.strip())
    return "\n".join(parts)


def build_runtime_guidance(prefs: Preferences | dict[str, Any] | None = None) -> str:
    """
    Per-turn decision guidance for the AI pipeline (not only session-start inject).

    Influences tone, technical level, and operational choices at runtime.
    """
    if prefs is None:
        return ""
    if isinstance(prefs, dict):
        prefs = Preferences.from_dict(prefs)

    lines: list[str] = ["Runtime user profile (apply now to tone, depth, and decisions):"]
    tone = (prefs.tone or "direct").lower()
    style = (prefs.style or "concise").lower()
    level = (prefs.technical_level or "balanced").lower()

    if tone == "warm":
        lines.append("- Tone: warm but still glanceable; no filler.")
    elif tone == "formal":
        lines.append("- Tone: formal, precise, no slang.")
    else:
        lines.append("- Tone: direct and actionable.")

    if style == "technical":
        lines.append("- Style: technical precision; name APIs/RPC fields when relevant.")
    elif style == "detailed":
        lines.append("- Style: slightly more detail, still ≤3 short sentences.")
    else:
        lines.append("- Style: concise HUD lines.")

    if level == "advanced":
        lines.append("- Technical level: advanced — assume stack familiarity.")
    elif level == "simple":
        lines.append("- Technical level: simple — avoid jargon; explain outcomes.")
    else:
        lines.append("- Technical level: balanced.")

    if prefs.language:
        lines.append(f"- Prefer language: {prefs.language}.")
    if prefs.frequent_commands:
        lines.append("- Frequent intents: " + ", ".join(prefs.frequent_commands[:5]) + ".")
    if prefs.notes.strip():
        lines.append(f"- Notes: {prefs.notes.strip()[:200]}")
    return "\n".join(lines)
