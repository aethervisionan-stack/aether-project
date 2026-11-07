"""Consenso Alfa orchestrator — quorum over validator agents."""

from __future__ import annotations

import asyncio
import logging
import time

from app.config import Settings
from app.models.schemas import AgentVote, ConsensoResult
from app.services.consenso_alfa.agents import (
    ConsistencyAgent,
    FactualGroundingAgent,
    SafetyToneAgent,
)
from app.services.consenso_alfa.protocol import ValidationContext, ValidatorAgent

logger = logging.getLogger(__name__)


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
    ) -> ConsensoResult:
        if not self._settings.consenso_enabled:
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

        async def _run(agent: ValidatorAgent) -> AgentVote:
            return await asyncio.wait_for(agent.validate(context), timeout=timeout)

        results = await asyncio.gather(
            *[_run(agent) for agent in self._agents],
            return_exceptions=True,
        )

        votes: list[AgentVote] = []
        flags: list[str] = []
        for agent, result in zip(self._agents, results, strict=True):
            if isinstance(result, Exception):
                logger.warning("consenso agent %s failed: %s", agent.agent_id, result)
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

        # Prefer a safety/consistency revision when present.
        final_text = draft_response
        for vote in votes:
            if vote.revised_text:
                final_text = vote.revised_text
                break

        if not approved:
            final_text = (
                "Consenso Alfa não validou a resposta com segurança suficiente. "
                "Pode reformular o pedido pelo fone Bluetooth?"
            )
            flags.append("quorum_rejected")

        elapsed = int((time.perf_counter() - started) * 1000)
        return ConsensoResult(
            approved=approved,
            agreement_ratio=round(ratio, 3),
            final_text=final_text.strip(),
            votes=votes,
            hallucination_flags=flags,
            duration_ms=elapsed,
            skipped=False,
        )
