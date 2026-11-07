"""Web3 stubs stay importable and decoupled from the voice route."""

from __future__ import annotations

import pytest

from app.config import Settings
from app.services.web3 import HeliusClient, JupiterSwapClient, PythOracleClient
from app.services.web3.jupiter_swap import SwapQuoteRequest


@pytest.mark.asyncio
async def test_helius_stub_unconfigured() -> None:
    client = HeliusClient(Settings(helius_rpc_url="", solana_rpc_url=""))
    assert client.configured is False
    assert await client.get_health() == "unconfigured"


@pytest.mark.asyncio
async def test_helius_stub_configured() -> None:
    client = HeliusClient(Settings(helius_rpc_url="https://mainnet.helius-rpc.com/?api-key=x"))
    assert await client.get_health() == "stub-ok"
    assert await client.get_balance("So11111111111111111111111111111111111111112") == 0


@pytest.mark.asyncio
async def test_pyth_stub_quote() -> None:
    oracle = PythOracleClient(Settings())
    quote = await oracle.latest_for_symbol("SOL/USD")
    assert quote is not None
    assert quote.raw.get("stub") is True


@pytest.mark.asyncio
async def test_jupiter_stub_quote() -> None:
    jup = JupiterSwapClient(Settings())
    quote = await jup.get_quote(
        SwapQuoteRequest(
            input_mint="So11111111111111111111111111111111111111112",
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            amount=1_000_000,
        )
    )
    assert quote.in_amount == 1_000_000
    assert quote.raw.get("stub") is True
