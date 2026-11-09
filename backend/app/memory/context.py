"""Build Live system instructions that include a compact learned-prefs summary."""

from __future__ import annotations

from typing import Any

from app.config import AETHER_SYSTEM_INSTRUCTION
from app.memory.store import Preferences


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


def build_system_instruction(prefs: Preferences | dict[str, Any] | None = None) -> str:
    """
    Base Aether HUD persona + optional learned preference block.

    Keeps replies short; preferences adapt tone/depth without breaking HUD style.
    """
    base = AETHER_SYSTEM_INSTRUCTION.strip()
    summary = preferences_summary(prefs)
    if not summary:
        return base

    adapt = (
        "Learned user preferences (adapt quietly; still reply in 1–3 short HUD sentences): "
        f"{summary}. "
        "If language is set, prefer that language. "
        "If technical_level=advanced, use precise terms; if simple, avoid jargon."
    )
    return f"{base}\n{adapt}"
