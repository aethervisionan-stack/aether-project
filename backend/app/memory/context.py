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
from app.persona.real_life_copilot import ENGINE_ACTIVATION_BANNER


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
        parts.append(f"habits=[{cmds}]")
    if prefs.notes.strip():
        parts.append(f"standing_notes={prefs.notes.strip()[:200]}")
    return "; ".join(parts)


def _personalization_block(prefs: Preferences) -> str:
    """
    Imperative memory block so Gemini Live actually personalizes each reply
    from learned tone, habits, and standing notes — without announcing it.
    """
    tone = (prefs.tone or "direct").lower()
    style = (prefs.style or "concise").lower()
    level = (prefs.technical_level or "balanced").lower()

    tone_line = {
        "warm": "speak warmly and personably while staying useful",
        "formal": "keep a polished, formal register — no slang",
    }.get(tone, "be direct, clear, and actionable")

    style_line = {
        "technical": "favor precise technical wording; name tools/APIs when relevant",
        "detailed": "add enough context and reasoning for a complete spoken answer",
    }.get(style, "stay crisp for earbuds, but never cut substance on complex asks")

    level_line = {
        "advanced": "assume stack familiarity; skip baby-steps",
        "simple": "avoid jargon; explain outcomes in plain language",
    }.get(level, "balance clarity with depth")

    lines = [
        "=== Long-term memory (apply on EVERY reply — do not wait to be asked) ===",
        f"Voice fit: {tone_line}. Delivery: {style_line}. Depth: {level_line}.",
    ]
    if prefs.language:
        lines.append(
            f"Language lock: prefer {prefs.language} unless the user clearly switches."
        )
    if prefs.frequent_commands:
        habits = ", ".join(prefs.frequent_commands[:6])
        lines.append(
            f"Known habits / frequent intents: {habits}. "
            "When the ask is ambiguous, bias toward these patterns."
        )
    if prefs.notes.strip():
        lines.append(
            f"Standing notes about this user (honor silently): {prefs.notes.strip()[:280]}"
        )
    lines.append(
        "Personalize naturally: mirror their vocabulary and priorities. "
        "Never say 'based on your preferences' or recite this block aloud."
    )
    return "\n".join(lines)


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
    Real Life Co-Pilot Engine (v0.4.1) + learned preference personalization +
    mobility + dynamic self-knowledge (capabilities manifest ∩ Tool Registry).
    """
    base = AETHER_SYSTEM_INSTRUCTION.strip()
    parts: list[str] = [base, f"Active engine: {ENGINE_ACTIVATION_BANNER}."]
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
    if prefs is not None:
        if isinstance(prefs, dict):
            prefs = Preferences.from_dict(prefs)
        # Always inject a directive block when a profile exists — even defaults —
        # so Live treats personalization as a first-class duty.
        parts.append(_personalization_block(prefs))
    if copilot_mode is not None:
        parts.append(build_copilot_guidance(parse_copilot_mode(copilot_mode)))
    if mobility_extra and mobility_extra.strip():
        parts.append(mobility_extra.strip())
    return "\n".join(parts)


def build_runtime_guidance(prefs: Preferences | dict[str, Any] | None = None) -> str:
    """
    Per-turn decision guidance for the AI pipeline (not only session-start inject).

    Influences tone, technical level, habits, and operational choices at runtime.
    """
    if prefs is None:
        return ""
    if isinstance(prefs, dict):
        prefs = Preferences.from_dict(prefs)

    lines: list[str] = [
        "Runtime memory (fold into this turn's spoken answer — silent, mandatory):",
    ]
    tone = (prefs.tone or "direct").lower()
    style = (prefs.style or "concise").lower()
    level = (prefs.technical_level or "balanced").lower()

    if tone == "warm":
        lines.append("- Tone: warm, human, still purposeful.")
    elif tone == "formal":
        lines.append("- Tone: formal and precise; no slang.")
    else:
        lines.append("- Tone: direct and actionable.")

    if style == "technical":
        lines.append("- Style: technical precision; name tools/APIs when relevant.")
    elif style == "detailed":
        lines.append("- Style: complete spoken answer with enough context to act.")
    else:
        lines.append("- Style: crisp earbud delivery; expand when the ask is complex.")

    if level == "advanced":
        lines.append("- Technical level: advanced — assume familiarity.")
    elif level == "simple":
        lines.append("- Technical level: simple — plain outcomes, no jargon.")
    else:
        lines.append("- Technical level: balanced.")

    if prefs.language:
        lines.append(f"- Prefer language: {prefs.language}.")
    if prefs.frequent_commands:
        lines.append(
            "- Habit bias (use when ambiguous): "
            + ", ".join(prefs.frequent_commands[:6])
            + "."
        )
    if prefs.notes.strip():
        lines.append(f"- Standing notes: {prefs.notes.strip()[:240]}")
    lines.append(
        "- Do not announce memory use; just answer as if you already know this person."
    )
    return "\n".join(lines)
