"""
DePIN / Solana integration seam (Phase 2+).

Phase 1 keeps this module as a no-op interface so the voice pipeline
never hard-couples to wallets, RPC, or on-chain attestation.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from app.config import Settings


class DepinAttestation(BaseModel):
    """Placeholder shape for future on-chain / DePIN proofs."""

    network: str = ""
    agent_wallet: str = ""
    proof: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


@runtime_checkable
class DepinAttestor(Protocol):
    async def attest(self, *, request_id: str, response_text: str) -> DepinAttestation | None:
        ...


class NullDepinAttestor:
    """Default Phase 1 attestor — always returns None."""

    async def attest(self, *, request_id: str, response_text: str) -> DepinAttestation | None:
        _ = (request_id, response_text)
        return None


def build_depin_attestor(settings: Settings) -> DepinAttestor:
    # When RPC + wallet are configured in a later phase, swap in a real client here.
    if settings.solana_rpc_url and settings.aether_agent_wallet:
        return NullDepinAttestor()
    return NullDepinAttestor()
