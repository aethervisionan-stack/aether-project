"""
Treasury SOL balance via Solana JSON-RPC with resilient public fallbacks.

Browser clients often get 403/CORS from public RPCs — Gen-1 HUD should call
`GET /billing/treasury-balance` (this module) instead of hitting RPC directly.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from app.config import Settings

logger = logging.getLogger("aether.billing.treasury_rpc")

OFFICIAL_TREASURY_WALLET = "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa"
LAMPORTS_PER_SOL = 1_000_000_000

# Ordered fallbacks for mainnet treasury display (no API keys required).
_DEFAULT_FALLBACKS = (
    "https://rpc.ankr.com/solana",
    "https://solana-rpc.publicnode.com",
    "https://api.mainnet-beta.solana.com",
)


def treasury_rpc_candidates(settings: Settings) -> list[str]:
    """Build unique RPC URL list: preferred env → fallbacks."""
    preferred: list[str] = []
    for raw in (
        settings.treasury_rpc_url,
        settings.solana_rpc_url,
        *_DEFAULT_FALLBACKS,
    ):
        url = (raw or "").strip()
        if not url:
            continue
        # Skip dedicated-devnet URLs when querying the official mainnet treasury
        # unless the operator explicitly set TREASURY_RPC_URL to that value.
        if url not in preferred:
            preferred.append(url)
    return preferred


def _rpc_get_balance(rpc_url: str, wallet: str, timeout_s: float = 6.0) -> dict[str, Any]:
    payload = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [wallet],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        rpc_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "aether-vision-treasury/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            status = getattr(resp, "status", 200)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:200]
        return {
            "ok": False,
            "rpc": rpc_url,
            "error": f"RPC HTTP {exc.code}",
            "detail": detail,
        }
    except Exception as exc:  # noqa: BLE001 — surface as soft HUD failure
        return {
            "ok": False,
            "rpc": rpc_url,
            "error": str(exc) or exc.__class__.__name__,
        }

    if status >= 400:
        return {"ok": False, "rpc": rpc_url, "error": f"RPC HTTP {status}"}

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {"ok": False, "rpc": rpc_url, "error": "invalid JSON from RPC"}

    if isinstance(data, dict) and data.get("error"):
        err = data["error"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        return {"ok": False, "rpc": rpc_url, "error": msg or "RPC error"}

    lamports = None
    if isinstance(data, dict):
        result = data.get("result")
        if isinstance(result, dict) and "value" in result:
            lamports = result.get("value")
        elif isinstance(result, (int, float)):
            lamports = result

    try:
        lamports_i = int(lamports)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return {"ok": False, "rpc": rpc_url, "error": "missing balance value"}

    return {
        "ok": True,
        "rpc": rpc_url,
        "lamports": lamports_i,
        "sol": lamports_i / LAMPORTS_PER_SOL,
    }


def fetch_treasury_balance(settings: Settings) -> dict[str, Any]:
    """
    Query official treasury wallet SOL balance with RPC fallbacks.

    Never raises for HUD use — always returns a structured payload.
    """
    wallet = (settings.treasury_wallet_address or "").strip() or OFFICIAL_TREASURY_WALLET
    # Always pin Gen-1 display to the official pubkey unless explicitly overridden
    # to the same value in env (operators may set TREASURY_WALLET_ADDRESS).
    if wallet != OFFICIAL_TREASURY_WALLET:
        # Still allow override, but log once-level info for operators.
        logger.info("treasury balance using configured wallet=%s", wallet[:8] + "…")

    attempts: list[dict[str, Any]] = []
    for rpc in treasury_rpc_candidates(settings):
        # Prefer mainnet-capable endpoints for the official mainnet treasury.
        # Devnet-only URLs still tried last if listed explicitly first in env.
        result = _rpc_get_balance(rpc, wallet)
        attempts.append(
            {
                "rpc": rpc,
                "ok": bool(result.get("ok")),
                "error": result.get("error"),
            }
        )
        if result.get("ok"):
            return {
                "ok": True,
                "online": True,
                "wallet": wallet,
                "rpc": result["rpc"],
                "lamports": result["lamports"],
                "sol": result["sol"],
                "attempts": attempts,
            }

    last_err = attempts[-1]["error"] if attempts else "no RPC candidates"
    logger.warning("treasury balance failed after %s attempts: %s", len(attempts), last_err)
    return {
        "ok": False,
        "online": False,
        "wallet": wallet,
        "rpc": attempts[-1]["rpc"] if attempts else "",
        "lamports": None,
        "sol": None,
        "error": last_err,
        "attempts": attempts,
    }
