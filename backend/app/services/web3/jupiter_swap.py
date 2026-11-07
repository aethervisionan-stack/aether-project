"""
Jupiter aggregator swap stub (quote + swap transaction build).

Interfaces for token quotes and swap txs on Solana. Not wired to the voice
pipeline — future agent tools may call these after Consenso Alfa approval.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from app.config import Settings


class SwapQuoteRequest(BaseModel):
    input_mint: str
    output_mint: str
    amount: int = Field(ge=1, description="Atomic units of input mint")
    slippage_bps: int = Field(default=50, ge=0, le=10_000)


class SwapQuote(BaseModel):
    input_mint: str
    output_mint: str
    in_amount: int
    out_amount: int
    other_amount_threshold: int = 0
    price_impact_pct: float = 0.0
    route_plan: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class SwapTransactionRequest(BaseModel):
    quote: SwapQuote
    user_public_key: str
    wrap_and_unwrap_sol: bool = True
    dynamic_compute_unit_limit: bool = True


class SwapTransaction(BaseModel):
    swap_transaction_b64: str
    last_valid_block_height: int | None = None
    prioritization_fee_lamports: int | None = None


@runtime_checkable
class SwapClient(Protocol):
    async def get_quote(self, request: SwapQuoteRequest) -> SwapQuote: ...

    async def build_swap_transaction(
        self,
        request: SwapTransactionRequest,
    ) -> SwapTransaction: ...


class JupiterSwapClient:
    """
    Jupiter v6 quote/swap stub.

    Configure JUPITER_QUOTE_API_URL (default https://quote-api.jup.ag/v6).
    Phase 2+: GET /quote → POST /swap — still outside /process-audio.
    """

    name = "jupiter-v6"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base_url = settings.jupiter_quote_api_url.rstrip("/")

    @property
    def api_url(self) -> str:
        return self._base_url

    async def get_quote(self, request: SwapQuoteRequest) -> SwapQuote:
        """Return a stub quote (1:1 out_amount) — no network I/O yet."""
        return SwapQuote(
            input_mint=request.input_mint,
            output_mint=request.output_mint,
            in_amount=request.amount,
            out_amount=request.amount,
            other_amount_threshold=request.amount,
            price_impact_pct=0.0,
            route_plan=[],
            raw={
                "stub": True,
                "api": self._base_url,
                "slippage_bps": request.slippage_bps,
            },
        )

    async def build_swap_transaction(
        self,
        request: SwapTransactionRequest,
    ) -> SwapTransaction:
        """Build a swap tx from a quote. Stub raises until Phase 2 wiring."""
        _ = request
        raise NotImplementedError(
            "JupiterSwapClient.build_swap_transaction is a Phase 2+ stub — "
            "not calling Jupiter /swap yet."
        )

    async def quote_and_describe(self, request: SwapQuoteRequest) -> dict[str, Any]:
        """Helper for future agent tools: quote → human-readable summary dict."""
        quote = await self.get_quote(request)
        return {
            "input_mint": quote.input_mint,
            "output_mint": quote.output_mint,
            "in_amount": quote.in_amount,
            "out_amount": quote.out_amount,
            "price_impact_pct": quote.price_impact_pct,
            "stub": True,
        }
