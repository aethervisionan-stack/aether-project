"""Aether Vision persona / engine identity blocks for Live prompts."""

from app.persona.real_life_copilot import (
    ENGINE_ACTIVATION_BANNER,
    ENGINE_ID,
    ENGINE_VERSION,
    REAL_LIFE_COPILOT_INSTRUCTION,
    build_real_life_copilot_block,
    build_tool_orchestration_hint,
)

__all__ = [
    "ENGINE_ACTIVATION_BANNER",
    "ENGINE_ID",
    "ENGINE_VERSION",
    "REAL_LIFE_COPILOT_INSTRUCTION",
    "build_real_life_copilot_block",
    "build_tool_orchestration_hint",
]
