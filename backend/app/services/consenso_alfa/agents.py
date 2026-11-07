"""Built-in Consenso Alfa validators (Phase 1 — heuristic, no LLM required)."""

from __future__ import annotations

import asyncio
import re
import time

from app.models.schemas import AgentVote
from app.services.consenso_alfa.protocol import ValidationContext

_HALLUCINATION_MARKERS = (
    "como ia generativa eu",
    "não tenho acesso a dados em tempo real",
    "como um modelo de linguagem",
    "em minha base de conhecimento até",
)

_UNSAFE_PATTERNS = (
    r"\b(senha|password|private[_ ]?key|seed phrase|mnemonic)\b",
    r"\btransferir\s+todo\s+o\s+saldo\b",
)


class FactualGroundingAgent:
    """Checks that the draft stays anchored to the user transcript."""

    agent_id = "alfa-grounding"
    role = "factual_grounding"

    async def validate(self, context: ValidationContext) -> AgentVote:
        started = time.perf_counter()
        await asyncio.sleep(0.01)
        draft = context.draft_response.strip()
        transcript = context.user_transcript.strip()

        flags: list[str] = []
        score = 1.0
        if not draft:
            flags.append("empty_response")
            score = 0.0
        if any(marker in draft.lower() for marker in _HALLUCINATION_MARKERS):
            flags.append("generic_llm_disclaimer")
            score -= 0.35
        if transcript and len(draft) > 40 and transcript.lower()[:24] not in draft.lower():
            # Soft preference: acknowledge the user ask without inventing unrelated claims.
            if "aether" not in draft.lower() and "assistente" not in draft.lower():
                flags.append("weak_grounding")
                score -= 0.15

        score = max(0.0, min(1.0, score))
        approved = score >= 0.55 and "empty_response" not in flags
        elapsed = int((time.perf_counter() - started) * 1000)
        return AgentVote(
            agent_id=self.agent_id,
            agent_role=self.role,
            approved=approved,
            score=score,
            rationale="; ".join(flags) if flags else "grounded",
            revised_text=None,
            duration_ms=elapsed,
        )


class SafetyToneAgent:
    """Blocks unsafe / credential-seeking phrasing and keeps corporate tone."""

    agent_id = "alfa-safety"
    role = "safety_tone"

    async def validate(self, context: ValidationContext) -> AgentVote:
        started = time.perf_counter()
        await asyncio.sleep(0.01)
        draft = context.draft_response
        flags: list[str] = []
        score = 1.0

        for pattern in _UNSAFE_PATTERNS:
            if re.search(pattern, draft, flags=re.IGNORECASE):
                flags.append(f"unsafe:{pattern}")
                score -= 0.5

        if len(draft) > 600:
            flags.append("verbose")
            score -= 0.1

        # Prefer calm corporate phrasing for headset playback.
        revised = draft
        if draft and not draft.endswith((".", "!", "?")):
            revised = draft.rstrip() + "."

        score = max(0.0, min(1.0, score))
        approved = score >= 0.6
        elapsed = int((time.perf_counter() - started) * 1000)
        return AgentVote(
            agent_id=self.agent_id,
            agent_role=self.role,
            approved=approved,
            score=score,
            rationale="; ".join(flags) if flags else "safe_tone",
            revised_text=revised if revised != draft else None,
            duration_ms=elapsed,
        )


class ConsistencyAgent:
    """Ensures draft is coherent and not empty after STT noise."""

    agent_id = "alfa-consistency"
    role = "consistency"

    async def validate(self, context: ValidationContext) -> AgentVote:
        started = time.perf_counter()
        await asyncio.sleep(0.01)
        draft = context.draft_response.strip()
        transcript = context.user_transcript.strip()
        flags: list[str] = []
        score = 1.0

        if not transcript:
            flags.append("empty_transcript")
            score -= 0.4
        if draft.count("...") >= 3:
            flags.append("ellipsis_spam")
            score -= 0.2
        if re.search(r"(.)\1{6,}", draft):
            flags.append("character_run")
            score -= 0.3

        score = max(0.0, min(1.0, score))
        approved = score >= 0.5
        fallback = (
            "Não consegui validar o áudio com confiança. "
            "Pode repetir o pedido pelo headset?"
        )
        elapsed = int((time.perf_counter() - started) * 1000)
        return AgentVote(
            agent_id=self.agent_id,
            agent_role=self.role,
            approved=approved,
            score=score,
            rationale="; ".join(flags) if flags else "consistent",
            revised_text=fallback if not approved and not draft else None,
            duration_ms=elapsed,
        )
