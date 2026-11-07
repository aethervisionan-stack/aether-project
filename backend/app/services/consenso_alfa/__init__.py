"""Consenso Alfa — multi-agent validation to reduce hallucinations."""

from app.services.consenso_alfa.fallback import QUORUM_REJECTED_FALLBACK_PT
from app.services.consenso_alfa.orchestrator import ConsensoAlfa
from app.services.consenso_alfa.protocol import ValidatorAgent

__all__ = ["ConsensoAlfa", "ValidatorAgent", "QUORUM_REJECTED_FALLBACK_PT"]
