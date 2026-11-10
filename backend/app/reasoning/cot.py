"""
Lightweight Chain-of-Thought + self-correction planner.

Runs off the Live audio path (asyncio.create_task / to_thread). Decomposes
complex tasks, validates hypotheses, and emits a compact plan the decision
pipeline can inject as context — without inflating TTFT on simple turns.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any

from app.introspection.intent import is_self_knowledge_intent
from app.reasoning.classifier import Complexity, classify_complexity

logger = logging.getLogger("aether.reasoning.cot")

_QUESTION = re.compile(r"\?|^(?:how|what|why|when|where|quem|como|por\s*que|o\s*que)\b", re.I)
_ACTION = re.compile(
    r"\b(?:run|execute|invoke|query|fetch|check|test|clear|update|set|ligar|execut|consult)\b",
    re.I,
)
_CODE = re.compile(
    r"\b(?:code|function|class|module|typescript|python|api|endpoint|schema)\b",
    re.I,
)
_DATA = re.compile(
    r"\b(?:analy|data|metric|latency|balance|treasury|solana|token|rpc)\b",
    re.I,
)


@dataclass
class PlanStep:
    id: int
    goal: str
    hypothesis: str
    status: str = "planned"  # planned | validated | corrected
    correction: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PlanningResult:
    complexity: Complexity
    steps: list[PlanStep] = field(default_factory=list)
    self_corrections: list[str] = field(default_factory=list)
    recommended_tools: list[str] = field(default_factory=list)
    plan_summary: str = ""
    elapsed_ms: float = 0.0
    skipped: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "complexity": self.complexity.value,
            "steps": [s.to_dict() for s in self.steps],
            "self_corrections": list(self.self_corrections),
            "recommended_tools": list(self.recommended_tools),
            "plan_summary": self.plan_summary,
            "elapsed_ms": self.elapsed_ms,
            "skipped": self.skipped,
        }

    def context_block(self) -> str:
        """Compact block for Live injection — HUD-friendly, not a monologue."""
        if self.skipped or not self.steps:
            return ""
        lines = ["Internal plan (do not narrate step-by-step unless asked):"]
        for step in self.steps[:5]:
            corr = f" → corrected: {step.correction}" if step.correction else ""
            lines.append(f"{step.id}. {step.goal} [{step.status}]{corr}")
        if self.recommended_tools:
            lines.append("Preferred tools: " + ", ".join(self.recommended_tools[:6]))
        if self.self_corrections:
            lines.append("Self-check: " + "; ".join(self.self_corrections[:3]))
        return "\n".join(lines)


def _decompose(text: str) -> list[PlanStep]:
    steps: list[PlanStep] = []
    n = 1
    steps.append(
        PlanStep(
            id=n,
            goal="Clarify user intent and success criteria",
            hypothesis="User wants a precise, actionable HUD answer",
        )
    )
    n += 1
    if _DATA.search(text):
        steps.append(
            PlanStep(
                id=n,
                goal="Gather on-chain / telemetry facts before concluding",
                hypothesis="Numbers beat guesses for treasury/latency claims",
            )
        )
        n += 1
    if _CODE.search(text):
        steps.append(
            PlanStep(
                id=n,
                goal="Outline implementation or debug path",
                hypothesis="Modular typed changes beat speculative rewrites",
            )
        )
        n += 1
    if _ACTION.search(text):
        steps.append(
            PlanStep(
                id=n,
                goal="Identify callable tools / routines",
                hypothesis="Prefer registry tools over free-form invention",
            )
        )
        n += 1
    if _QUESTION.search(text) or len(text) > 120:
        steps.append(
            PlanStep(
                id=n,
                goal="Validate assumptions and self-correct before final reply",
                hypothesis="First draft may overclaim — verify constraints",
            )
        )
    return steps


def _recommend_tools(text: str) -> list[str]:
    tools: list[str] = []
    lower = text.lower()
    if any(k in lower for k in ("treasury", "balance", "solana", "wallet", "tokenomics")):
        tools.append("solana_treasury_query")
    if any(k in lower for k in ("on-chain", "onchain", "rpc", "mint", "tx", "transaction")):
        tools.append("onchain_lookup")
    if any(k in lower for k in ("memory", "preference", "prefs", "profile", "guideline")):
        tools.append("memory_payload")
    if any(k in lower for k in ("test", "routine", "health", "latency", "ping")):
        tools.append("run_test_routine")
    # Hands-free OS agent (safe read defaults — irreversible actions need confirm loop).
    if any(
        k in lower
        for k in ("whatsapp", "telegram", "sms", "instagram", "mensagem", "message", "dm")
    ):
        tools.append("messaging_tool")
    if any(
        k in lower
        for k in ("email", "e-mail", "agenda", "calendar", "reuni", "appointment", "schedule")
    ):
        tools.append("email_calendar_tool")
    if any(k in lower for k in ("call", "ligar", "telefone", "telephony", "chamada")):
        tools.append("telephony_tool")
    if any(
        k in lower
        for k in ("battery", "bateria", "volume", "alarme", "alarm", "timer", "media", "som")
    ):
        tools.append("system_control_tool")
    if is_self_knowledge_intent(text):
        tools.append("system_help_tool")
    return tools


def _self_correct(steps: list[PlanStep], text: str) -> tuple[list[PlanStep], list[str]]:
    corrections: list[str] = []
    for step in steps:
        # Hypotheses that skip verification on numeric/ops claims get corrected.
        if "facts" in step.goal.lower() and "guess" in step.hypothesis.lower():
            step.status = "validated"
            continue
        if "Validate" in step.goal or "self-correct" in step.goal.lower():
            step.status = "corrected"
            step.correction = "Keep reply to 1–3 HUD sentences; cite tools when used"
            corrections.append(step.correction)
        elif _ACTION.search(text) and "tool" in step.goal.lower():
            step.status = "validated"
        else:
            step.status = "validated"
    if len(text) > 220 and not any("self-correct" in c.lower() for c in corrections):
        corrections.append("Long prompt — prioritize the single most actionable outcome")
    return steps, corrections


def plan_and_correct(text: str, *, force: bool = False) -> PlanningResult:
    """
    Synchronous planner — call via asyncio.to_thread from the WS bridge.
    Returns a skipped result immediately for simple turns.
    """
    started = time.perf_counter()
    complexity = classify_complexity(text)
    if complexity is Complexity.SIMPLE and not force:
        return PlanningResult(
            complexity=complexity,
            skipped=True,
            elapsed_ms=(time.perf_counter() - started) * 1000.0,
            plan_summary="",
        )

    steps = _decompose(text)
    tools = _recommend_tools(text)
    steps, corrections = _self_correct(steps, text)
    summary = "; ".join(s.goal for s in steps[:4])
    result = PlanningResult(
        complexity=Complexity.COMPLEX,
        steps=steps,
        self_corrections=corrections,
        recommended_tools=tools,
        plan_summary=summary,
        elapsed_ms=(time.perf_counter() - started) * 1000.0,
        skipped=False,
    )
    logger.debug(
        "cot plan steps=%s tools=%s ms=%.1f",
        len(result.steps),
        result.recommended_tools,
        result.elapsed_ms,
    )
    return result
