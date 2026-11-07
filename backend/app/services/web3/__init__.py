"""
Web3 / Solana integration stubs (Phase 2+).

These modules are intentionally decoupled from the voice pipeline.
Do not import them from STT / Consenso Alfa / TTS paths.
"""

from app.services.web3.helius_client import HeliusClient
from app.services.web3.jupiter_swap import JupiterSwapClient
from app.services.web3.pyth_oracle import PythOracleClient

__all__ = [
    "HeliusClient",
    "PythOracleClient",
    "JupiterSwapClient",
]
