"""Copilot / companionship mode guidance for Live system + decision pipeline."""

from __future__ import annotations

from enum import Enum
from typing import Any


class CopilotMode(str, Enum):
    ASSISTANT = "assistant"
    COPILOT = "copilot"


COPILOT_GUIDANCE = (
    "Mode: Real-Life Co-Pilot / Companionship. Strategic end-to-end resolution — "
    "not a task/scheduling assistant. Fluid natural conversation with active listening, "
    "but stay proactive: anticipate bottlenecks, risks, and next steps. "
    "Do not require rigid command syntax. Mirror energy; ask at most one light clarifying "
    "question when needed. Non-trivial replies follow Diagnóstico Inicial → Plano Passo a "
    "Passo → Orquestração de Ferramentas → Resultado Esperado. No 'Em que posso ajudar?'."
)

ASSISTANT_GUIDANCE = (
    "Mode: Real-Life Co-Pilot (Assistant). Direct, assertive JARVIS/HUD tone. "
    "Prefer actionable end-to-end resolution with Tool Registry orchestration. "
    "Structure: Diagnóstico → Plano → Ferramentas → Resultado. No redundant greetings."
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
