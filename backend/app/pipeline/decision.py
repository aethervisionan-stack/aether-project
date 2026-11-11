"""
Runtime decision pipeline that consolidates long-term memory into turn handling.

Unlike session-start system_instruction injection alone, this path loads prefs,
runs CoT for complex turns, optionally invokes recommended tools, and returns a
compact context payload the Live bridge can push as text — without blocking PCM.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.config import Settings, get_settings
from app.introspection.intent import help_tool_action, is_self_knowledge_intent
from app.memory.context import build_runtime_guidance, preferences_summary
from app.memory.store import Preferences, get_memory_store
from app.mobility.state import MobilitySessionState
from app.multimodal.ingest import MultimodalBuffer
from app.persona.real_life_copilot import (
    REGISTRY_TOOL_NAMES,
    response_structure_reminder,
)
from app.reasoning.classifier import Complexity, classify_complexity
from app.reasoning.cot import PlanningResult, plan_and_correct
from app.tools.registry import ToolContext, ToolRegistry, ToolResult, get_tool_registry

logger = logging.getLogger("aether.pipeline.decision")


def _default_tool_args(name: str, text: str) -> dict[str, Any]:
    """Safe default args for autonomous parallel orchestration (no irreversible sends)."""
    lower = text.lower()
    if name == "run_test_routine":
        if "memory" in lower:
            return {"routine": "memory_snapshot"}
        if "latency" in lower or "ping" in lower:
            return {"routine": "latency_targets"}
        return {"routine": "health"}
    if name == "memory_payload":
        return {"action": "get"}
    if name == "messaging_tool":
        return {"action": "read", "app": "whatsapp", "limit": 5}
    if name == "email_calendar_tool":
        return {"action": "agenda", "day": "today"}
    if name == "google_drive_tool":
        return {"action": "search", "query": "aether", "limit": 5}
    if name == "google_maps_tool":
        return {"action": "geolocate"}
    if name == "telephony_tool":
        return {"action": "incoming"}
    if name == "system_control_tool":
        if "volume" in lower or "som" in lower:
            return {"action": "volume", "level": 50}
        if "alarm" in lower or "alarme" in lower or "timer" in lower:
            return {"action": "timer", "minutes": 5, "label": "aether"}
        return {"action": "battery"}
    if name == "system_help_tool":
        return {"action": help_tool_action(text)}
    if name == "solana_treasury_query":
        return {}
    if name == "onchain_lookup":
        # Requires an address — skip empty invoke; CoT still lists the tool for Live.
        return {"address": "", "method": "getBalance"}
    return {}


@dataclass
class DecisionContext:
    profile_id: str
    user_text: str
    multimodal: MultimodalBuffer | None = None
    settings: Settings | None = None
    auto_tools: bool = True
    mobility: MobilitySessionState | None = None


@dataclass
class DecisionOutcome:
    turn_id: str
    complexity: Complexity
    planning: PlanningResult
    preferences: dict[str, Any]
    preference_summary: str
    runtime_guidance: str
    tool_results: list[ToolResult] = field(default_factory=list)
    injection_text: str = ""
    elapsed_ms: float = 0.0
    skipped_heavy: bool = False
    mobility_mode: str | None = None

    def to_event(self) -> dict[str, Any]:
        return {
            "type": "decision",
            "turn_id": self.turn_id,
            "complexity": self.complexity.value,
            "skipped_heavy": self.skipped_heavy,
            "preference_summary": self.preference_summary,
            "plan": self.planning.to_dict() if not self.planning.skipped else {"skipped": True},
            "tools": [t.to_dict() for t in self.tool_results],
            "elapsed_ms": self.elapsed_ms,
            "mobility_mode": self.mobility_mode,
        }


async def run_decision_pipeline(ctx: DecisionContext) -> DecisionOutcome:
    started = time.perf_counter()
    turn_id = uuid.uuid4().hex[:10]
    settings = ctx.settings or get_settings()
    text = (ctx.user_text or "").strip()
    complexity = classify_complexity(text)

    prefs_dict: dict[str, Any] = {}
    pref_summary = ""
    guidance = ""
    if settings.memory_enabled:
        store = get_memory_store()
        snap = store.snapshot(ctx.profile_id)
        prefs_dict = snap.get("preferences") or {}
        prefs = Preferences.from_dict(prefs_dict if isinstance(prefs_dict, dict) else {})
        pref_summary = preferences_summary(prefs)
        guidance = build_runtime_guidance(prefs)

    mobility_blocks: list[str] = []
    mobility_mode: str | None = None
    if ctx.mobility is not None:
        mobility_mode = ctx.mobility.copilot_mode.value
        mobility_blocks = ctx.mobility.runtime_blocks()

    def _compose_injection(*extra: str) -> str:
        parts = [guidance, *mobility_blocks, *[e for e in extra if e]]
        return "\n".join(p for p in parts if p).strip()

    # Simple turns: memory + mobility guidance only — no CoT / tools (protect TTFT / voice).
    if complexity is Complexity.SIMPLE:
        planning = plan_and_correct(text)  # returns skipped
        mm = ""
        if ctx.multimodal:
            mm = ctx.multimodal.context_snippet() or ""
        injection = _compose_injection(mm)
        return DecisionOutcome(
            turn_id=turn_id,
            complexity=complexity,
            planning=planning,
            preferences=prefs_dict if isinstance(prefs_dict, dict) else {},
            preference_summary=pref_summary,
            runtime_guidance=guidance,
            injection_text=injection,
            elapsed_ms=(time.perf_counter() - started) * 1000.0,
            skipped_heavy=True,
            mobility_mode=mobility_mode,
        )

    planning = plan_and_correct(text)
    # Force system_help_tool on self-knowledge / vision / value / tools asks.
    if is_self_knowledge_intent(text) and "system_help_tool" not in planning.recommended_tools:
        planning.recommended_tools = ["system_help_tool", *planning.recommended_tools]
    tool_results: list[ToolResult] = []
    registry: ToolRegistry = get_tool_registry()
    if ctx.auto_tools and planning.recommended_tools:
        tool_ctx = ToolContext(profile_id=ctx.profile_id, settings=settings, source="pipeline")
        # Prefer parallel/chained calls across the full 9-tool registry for root-cause.
        names = [
            n
            for n in planning.recommended_tools
            if (n in REGISTRY_TOOL_NAMES or registry.has(n))
            and n != "onchain_lookup"  # needs address — Live/model supplies it
        ][:9]
        if names:
            calls = [(n, _default_tool_args(n, text)) for n in names]
            tool_results = await registry.invoke_many(calls, ctx=tool_ctx, limit=9)

    plan_block = planning.context_block()
    tool_lines = [tr.context_line() for tr in tool_results]
    mm = ""
    if ctx.multimodal:
        mm = ctx.multimodal.context_snippet() or ""
    injection = _compose_injection(
        response_structure_reminder(),
        plan_block,
        *tool_lines,
        mm,
    )
    outcome = DecisionOutcome(
        turn_id=turn_id,
        complexity=complexity,
        planning=planning,
        preferences=prefs_dict if isinstance(prefs_dict, dict) else {},
        preference_summary=pref_summary,
        runtime_guidance=guidance,
        tool_results=tool_results,
        injection_text=injection,
        elapsed_ms=(time.perf_counter() - started) * 1000.0,
        skipped_heavy=False,
        mobility_mode=mobility_mode,
    )
    logger.info(
        "decision turn=%s complexity=%s tools=%s ms=%.1f",
        turn_id,
        complexity.value,
        [t.name for t in tool_results],
        outcome.elapsed_ms,
    )
    return outcome
