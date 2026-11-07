"""Interfaces for Consenso Alfa validator agents."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field

from app.models.schemas import AgentVote


class ValidationContext(BaseModel):
    """Input shared with every Consenso Alfa agent."""

    user_transcript: str
    draft_response: str
    locale: str = "pt-BR"
    session_hints: dict[str, str] = Field(default_factory=dict)


@runtime_checkable
class ValidatorAgent(Protocol):
    """Single validator in the Consenso Alfa quorum."""

    agent_id: str
    role: str

    async def validate(self, context: ValidationContext) -> AgentVote:
        ...
