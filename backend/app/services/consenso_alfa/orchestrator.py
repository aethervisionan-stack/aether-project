"""Consenso Alfa orchestrator — quorum over validator agents."""

from __future__ import annotations

import asyncio
import json
import logging
import time

from app.config import Settings
from app.models.schemas import AgentVote, ConsensoAgentLatency, ConsensoResult
from app.services.consenso_alfa.agents import (
    ConsistencyAgent,
    FactualGroundingAgent,
    SafetyToneAgent,
)
from app.services.consenso_alfa.fallback import QUORUM_REJECTED_FALLBACK_PT
from app.services.consenso_alfa.protocol import ValidationContext, ValidatorAgent

logger = logging.getLogger("aether.consenso_alfa")

_ROLE_LABELS: dict[str, str] = {
    "factual_grounding": "Grounding",
    "safety_tone": "Safety/Tone",
    "consistency": "Consistency",
}


def _log_event(event: str, **fields: object) -> None:
    """Structured single-line JSON logs for real-time flow inspection."""
    payload = {"event": event, **fields}
    logger.info("%s", json.dumps(payload, ensure_ascii=False, default=str))


class ConsensoAlfa:
    """
    Multi-agent validation layer that runs *before* TTS.

    Phase 1 ships heuristic validators with clear interfaces so later
    phases can swap in LLM / DePIN-attested agents without changing routes.
    """

    def __init__(
        self,
        settings: Settings,
        agents: list[ValidatorAgent] | None = None,
    ) -> None:
        self._settings = settings
        self._agents: list[ValidatorAgent] = agents or [
            FactualGroundingAgent(),
            SafetyToneAgent(),
            ConsistencyAgent(),
        ]

    async def validate(
        self,
        *,
        user_transcript: str,
        draft_response: str,
        locale: str = "pt-BR",
        request_id: str | None = None,
    ) -> ConsensoResult:
        if not self._settings.consenso_enabled:
            _log_event(
                "consenso.skipped",
                request_id=request_id,
                reason="CONSENSO_ENABLED=false",
            )
            return ConsensoResult(
                approved=True,
                agreement_ratio=1.0,
                final_text=draft_response,
                votes=[],
                hallucination_flags=[],
                duration_ms=0,
                skipped=True,
            )

        started = time.perf_counter()
        context = ValidationContext(
            user_transcript=user_transcript,
            draft_response=draft_response,
            locale=locale,
        )
        timeout = self._settings.consenso_timeout_ms / 1000.0

        _log_event(
            "consenso.start",
            request_id=request_id,
            agents=[a.agent_id for a in self._agents],
            roles=[a.role for a in self._agents],
            transcript_chars=len(user_transcript),
            draft_chars=len(draft_response),
            timeout_ms=self._settings.consenso_timeout_ms,
            min_agents=self._settings.consenso_min_agents,
            agreement_threshold=self._settings.consenso_agreement_threshold,
        )

        async def _run(agent: ValidatorAgent) -> AgentVote:
            agent_started = time.perf_counter()
            _log_event(
                "consenso.agent.start",
                request_id=request_id,
                agent_id=agent.agent_id,
                role=agent.role,
            )
            try:
                vote = await asyncio.wait_for(agent.validate(context), timeout=timeout)
            except Exception as exc:  # noqa: BLE001
                elapsed = int((time.perf_counter() - agent_started) * 1000)
                _log_event(
                    "consenso.agent.error",
                    request_id=request_id,
                    agent_id=agent.agent_id,
                    role=agent.role,
                    error=type(exc).__name__,
                    detail=str(exc),
                    duration_ms=elapsed,
                )
                raise
            _log_event(
                "consenso.agent.done",
                request_id=request_id,
                agent_id=vote.agent_id,
                role=vote.agent_role,
                approved=vote.approved,
                score=vote.score,
                rationale=vote.rationale,
                has_revision=bool(vote.revised_text),
                duration_ms=vote.duration_ms,
            )
            return vote

        results = await asyncio.gather(
            *[_run(agent) for agent in self._agents],
            return_exceptions=True,
        )

        votes: list[AgentVote] = []
        flags: list[str] = []
        for agent, result in zip(self._agents, results, strict=True):
            if isinstance(result, Exception):
                votes.append(
                    AgentVote(
                        agent_id=agent.agent_id,
                        agent_role=agent.role,
                        approved=False,
                        score=0.0,
                        rationale=f"timeout_or_error:{type(result).__name__}",
                    )
                )
                flags.append(f"{agent.agent_id}:error")
                continue
            votes.append(result)
            if not result.approved:
                flags.append(f"{agent.agent_id}:{result.rationale}")

        approvals = sum(1 for v in votes if v.approved)
        ratio = approvals / len(votes) if votes else 0.0
        min_agents = min(self._settings.consenso_min_agents, len(votes) or 1)
        approved = (
            approvals >= min_agents
            and ratio >= self._settings.consenso_agreement_threshold
        )

        # Prefer a safety/consistency revision when present (only if quorum passes).
        final_text = draft_response
        for vote in votes:
            if vote.revised_text:
                final_text = vote.revised_text
                break

        if not approved:
            # Safe fallback — never speak an unvalidated draft.
            final_text = QUORUM_REJECTED_FALLBACK_PT
            flags.append("quorum_rejected")

        elapsed = int((time.perf_counter() - started) * 1000)
        agent_latencies = [
            ConsensoAgentLatency(
                agent_id=v.agent_id,
                agent_role=v.agent_role,
                duration_ms=v.duration_ms,
                label=_ROLE_LABELS.get(v.agent_role, v.agent_role),
            )
            for v in votes
        ]
        latency_by_role = {a.agent_role: a.duration_ms for a in agent_latencies}
        _log_event(
            "consenso.done",
            request_id=request_id,
            approved=approved,
            agreement_ratio=round(ratio, 3),
            approvals=approvals,
            agent_count=len(votes),
            hallucination_flags=flags,
            final_chars=len(final_text.strip()),
            used_fallback=not approved,
            duration_ms=elapsed,
            agent_latencies_ms=latency_by_role,
            grounding_ms=latency_by_role.get("factual_grounding", 0),
            safety_tone_ms=latency_by_role.get("safety_tone", 0),
            consistency_ms=latency_by_role.get("consistency", 0),
        )
        return ConsensoResult(
            approved=approved,
            agreement_ratio=round(ratio, 3),
            final_text=final_text.strip(),
            votes=votes,
            hallucination_flags=flags,
            duration_ms=elapsed,
            skipped=False,
            agent_latencies=agent_latencies,
        )
