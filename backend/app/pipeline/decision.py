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
from app.memory.context import build_runtime_guidance, preferences_summary
from app.memory.store import Preferences, get_memory_store
from app.multimodal.ingest import MultimodalBuffer
from app.reasoning.classifier import Complexity, classify_complexity
from app.reasoning.cot import PlanningResult, plan_and_correct
from app.tools.registry import ToolContext, ToolRegistry, ToolResult, get_tool_registry

logger = logging.getLogger("aether.pipeline.decision")


@dataclass
class DecisionContext:
    profile_id: str
    user_text: str
    multimodal: MultimodalBuffer | None = None
    settings: Settings | None = None
    auto_tools: bool = True


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

    # Simple turns: memory guidance only — no CoT / tools (protect TTFT / voice).
    if complexity is Complexity.SIMPLE:
        planning = plan_and_correct(text)  # returns skipped
        injection = guidance
        if ctx.multimodal:
            mm = ctx.multimodal.context_snippet()
            if mm:
                injection = (injection + "\n" + mm).strip()
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
        )

    planning = plan_and_correct(text)
    tool_results: list[ToolResult] = []
    registry: ToolRegistry = get_tool_registry()
    if ctx.auto_tools and planning.recommended_tools:
        tool_ctx = ToolContext(profile_id=ctx.profile_id, settings=settings, source="pipeline")
        for name in planning.recommended_tools[:3]:
            args: dict[str, Any] = {}
            if name == "run_test_routine":
                lower = text.lower()
                if "memory" in lower:
                    args = {"routine": "memory_snapshot"}
                elif "latency" in lower or "ping" in lower:
                    args = {"routine": "latency_targets"}
                else:
                    args = {"routine": "health"}
            elif name == "memory_payload":
                args = {"action": "get"}
            result = await registry.invoke(name, args, ctx=tool_ctx)
            tool_results.append(result)

    parts: list[str] = []
    if guidance:
        parts.append(guidance)
    plan_block = planning.context_block()
    if plan_block:
        parts.append(plan_block)
    for tr in tool_results:
        parts.append(tr.context_line())
    if ctx.multimodal:
        mm = ctx.multimodal.context_snippet()
        if mm:
            parts.append(mm)

    injection = "\n".join(p for p in parts if p).strip()
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
    )
    logger.info(
        "decision turn=%s complexity=%s tools=%s ms=%.1f",
        turn_id,
        complexity.value,
        [t.name for t in tool_results],
        outcome.elapsed_ms,
    )
    return outcome
