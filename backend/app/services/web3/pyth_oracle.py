"""
Pyth Network oracle stub (Hermes HTTP API).

Interfaces for price feeds used by future trading / DePIN agents.
Decoupled from the voice pipeline — never called from /process-audio.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field

from app.config import Settings


class PriceFeedId(BaseModel):
    """Pyth price feed identifier (hex)."""

    id: str
    symbol: str = ""


class PriceQuote(BaseModel):
    feed_id: str
    symbol: str = ""
    price: float
    conf: float = 0.0
    expo: int = 0
    publish_time: int = 0
    raw: dict[str, object] = Field(default_factory=dict)


@runtime_checkable
class OracleClient(Protocol):
    async def get_price(self, feed_id: str) -> PriceQuote: ...

    async def get_prices(self, feed_ids: list[str]) -> list[PriceQuote]: ...

    async def latest_for_symbol(self, symbol: str) -> PriceQuote | None: ...


class PythOracleClient:
    """
    Pyth Hermes client stub.

    Configure PYTH_HERMES_URL (default https://hermes.pyth.network).
    Phase 2+: GET /v2/updates/price/latest?ids[]=...
    """

    name = "pyth-hermes"

    # Common Solana-market symbols → placeholder feed ids (replace with live ids)
    KNOWN_FEEDS: dict[str, str] = {
        "SOL/USD": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
        "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
        "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    }

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base_url = settings.pyth_hermes_url.rstrip("/")

    @property
    def hermes_url(self) -> str:
        return self._base_url

    async def get_price(self, feed_id: str) -> PriceQuote:
        """Fetch a single price feed. Stub returns a zero quote."""
        symbol = next((s for s, fid in self.KNOWN_FEEDS.items() if fid == feed_id), "")
        return PriceQuote(
            feed_id=feed_id,
            symbol=symbol,
            price=0.0,
            conf=0.0,
            expo=0,
            publish_time=0,
            raw={"stub": True, "hermes": self._base_url},
        )

    async def get_prices(self, feed_ids: list[str]) -> list[PriceQuote]:
        return [await self.get_price(fid) for fid in feed_ids]

    async def latest_for_symbol(self, symbol: str) -> PriceQuote | None:
        feed_id = self.KNOWN_FEEDS.get(symbol.upper()) or self.KNOWN_FEEDS.get(symbol)
        if not feed_id:
            return None
        return await self.get_price(feed_id)

    def resolve_feed(self, symbol: str) -> PriceFeedId | None:
        feed_id = self.KNOWN_FEEDS.get(symbol.upper()) or self.KNOWN_FEEDS.get(symbol)
        if not feed_id:
            return None
        return PriceFeedId(id=feed_id, symbol=symbol)
