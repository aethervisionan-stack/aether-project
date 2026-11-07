"""Consenso Alfa quorum rejection must yield the safe spoken fallback."""

from __future__ import annotations

import pytest

from app.config import Settings
from app.models.schemas import AgentVote
from app.services.consenso_alfa.fallback import QUORUM_REJECTED_FALLBACK_PT
from app.services.consenso_alfa.orchestrator import ConsensoAlfa
from app.services.consenso_alfa.protocol import ValidationContext


class AlwaysRejectAgent:
    agent_id = "rejector"
    role = "rejector"

    async def validate(self, context: ValidationContext) -> AgentVote:
        _ = context
        return AgentVote(
            agent_id=self.agent_id,
            agent_role=self.role,
            approved=False,
            score=0.0,
            rationale="forced_reject",
        )


@pytest.mark.asyncio
async def test_consenso_quorum_reject_uses_safe_fallback() -> None:
    settings = Settings(
        consenso_enabled=True,
        consenso_min_agents=2,
        consenso_agreement_threshold=0.66,
    )
    consenso = ConsensoAlfa(
        settings,
        agents=[AlwaysRejectAgent(), AlwaysRejectAgent(), AlwaysRejectAgent()],
    )
    result = await consenso.validate(
        user_transcript="olá aether",
        draft_response="resposta inventada sem validação",
        request_id="test-reject",
    )
    assert result.approved is False
    assert result.final_text == QUORUM_REJECTED_FALLBACK_PT
    assert "quorum_rejected" in result.hallucination_flags
