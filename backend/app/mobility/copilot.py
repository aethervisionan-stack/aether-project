"""Copilot / companionship mode guidance for Live system + decision pipeline."""

from __future__ import annotations

from enum import Enum
from typing import Any


class CopilotMode(str, Enum):
    ASSISTANT = "assistant"
    COPILOT = "copilot"


COPILOT_GUIDANCE = (
    "Mode: Copilot / Companionship. Prefer fluid natural conversation — "
    "active listening, daily summary synthesis, short storytelling, and idea debates. "
    "Do not require rigid command syntax. Mirror the user's energy; ask at most one "
    "light clarifying question when helpful. Keep HUD answers glanceable (1–4 short sentences) "
    "unless the user clearly wants a longer story or debate."
)

ASSISTANT_GUIDANCE = (
    "Mode: Assistant. Prefer concise, actionable HUD replies. Commands and tools are welcome."
)


def build_copilot_guidance(mode: CopilotMode | str | None) -> str:
    if mode is None:
        return ASSISTANT_GUIDANCE
    value = mode.value if isinstance(mode, CopilotMode) else str(mode).strip().lower()
    if value in {CopilotMode.COPILOT.value, "companionship", "companion"}:
        return COPILOT_GUIDANCE
    return ASSISTANT_GUIDANCE


def parse_copilot_mode(raw: Any) -> CopilotMode:
    if isinstance(raw, CopilotMode):
        return raw
    value = str(raw or "").strip().lower()
    if value in {CopilotMode.COPILOT.value, "companionship", "companion"}:
        return CopilotMode.COPILOT
    return CopilotMode.ASSISTANT
