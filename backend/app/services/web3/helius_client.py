"""
Helius Solana RPC client stub.

Provides typed method interfaces for account reads, signatures, and webhooks.
No live network calls in Phase 1 — wire HELIUS_RPC_URL / HELIUS_API_KEY later.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from app.config import Settings


class SolanaRpcRequest(BaseModel):
    method: str
    params: list[Any] = Field(default_factory=list)
    id: int = 1


class SolanaRpcResponse(BaseModel):
    result: Any = None
    error: dict[str, Any] | None = None
    id: int = 1


class AccountInfo(BaseModel):
    pubkey: str
    lamports: int = 0
    owner: str = ""
    executable: bool = False
    data_b64: str | None = None


@runtime_checkable
class SolanaRpcClient(Protocol):
    async def get_health(self) -> str: ...

    async def get_balance(self, pubkey: str) -> int: ...

    async def get_account_info(self, pubkey: str) -> AccountInfo | None: ...

    async def get_latest_blockhash(self) -> str: ...

    async def send_raw_transaction(self, signed_tx_b64: str) -> str: ...


class HeliusClient:
    """
    Helius-enhanced Solana RPC stub.

    Later phases: JSON-RPC over HELIUS_RPC_URL (or solana_rpc_url fallback),
    plus DAS / webhook helpers — still outside the voice request path.
    """

    name = "helius"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._rpc_url = settings.resolved_solana_rpc()
        self._api_key = settings.helius_api_key

    @property
    def configured(self) -> bool:
        return bool(self._rpc_url)

    async def get_health(self) -> str:
        """Return RPC health string. Stub returns 'unconfigured' or 'stub-ok'."""
        if not self.configured:
            return "unconfigured"
        return "stub-ok"

    async def get_balance(self, pubkey: str) -> int:
        _ = pubkey
        self._ensure_ready()
        return 0

    async def get_account_info(self, pubkey: str) -> AccountInfo | None:
        self._ensure_ready()
        return AccountInfo(pubkey=pubkey, lamports=0)

    async def get_latest_blockhash(self) -> str:
        self._ensure_ready()
        return "11111111111111111111111111111111"

    async def send_raw_transaction(self, signed_tx_b64: str) -> str:
        _ = signed_tx_b64
        self._ensure_ready()
        raise NotImplementedError(
            "HeliusClient.send_raw_transaction is a Phase 2+ stub — not wired to RPC yet."
        )

    async def rpc(self, method: str, params: list[Any] | None = None) -> SolanaRpcResponse:
        """Generic JSON-RPC seam for future Helius calls."""
        self._ensure_ready()
        return SolanaRpcResponse(
            result={"stub": True, "method": method, "params": params or []},
            id=1,
        )

    def _ensure_ready(self) -> None:
        if not self.configured:
            raise RuntimeError(
                "Helius RPC not configured. Set HELIUS_RPC_URL (or SOLANA_RPC_URL)."
            )
