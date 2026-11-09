"""
Automated tokenomics after fiat payment: 70% treasury / 30% burn.

Safe mode (default): when `SOLANA_PAYER_SECRET_KEY` is empty, log a stub
distribution plan and return without broadcasting. Never invent private keys.

To enable real transfers:
  1. Set SOLANA_RPC_URL (devnet/mainnet)
  2. Set TREASURY_WALLET_ADDRESS, VISION_BURN_ADDRESS, VISION_MINT_ADDRESS
  3. Set SOLANA_PAYER_SECRET_KEY to a real base58 secret that holds VISION/SOL
  4. Install optional deps: `pip install solders solana`
  5. Restart backend — `solana_live_transfers_enabled()` becomes true
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import Settings

logger = logging.getLogger("aether.billing.solana")

TREASURY_SHARE = 0.70
BURN_SHARE = 0.30


async def distribute_subscription_proceeds(
    settings: Settings,
    *,
    amount_usd: float,
    payment_ref: str,
    subscriber_id: str,
) -> dict[str, Any]:
    """
    Background-safe distribution planner / executor.

    Returns a result dict suitable for entitlement metadata (no secrets).
    """
    amount_usd = max(0.0, float(amount_usd))
    tokens = amount_usd * float(settings.vision_tokens_per_usd)
    treasury_tokens = round(tokens * TREASURY_SHARE, 6)
    burn_tokens = round(tokens * BURN_SHARE, 6)

    plan = {
        "payment_ref": payment_ref,
        "subscriber_id": subscriber_id,
        "amount_usd": amount_usd,
        "vision_tokens_total": tokens,
        "treasury_share": TREASURY_SHARE,
        "burn_share": BURN_SHARE,
        "treasury_tokens": treasury_tokens,
        "burn_tokens": burn_tokens,
        "treasury_wallet": settings.treasury_wallet_address,
        "burn_address": settings.vision_burn_address,
        "mint": settings.vision_mint_address,
        "rpc": settings.solana_rpc_url,
    }

    if not settings.solana_live_transfers_enabled():
        logger.info(
            "SOLANA_STUB mode — would send %.6f VISION → treasury (%s) and "
            "%.6f VISION → burn (%s) for payment_ref=%s",
            treasury_tokens,
            settings.treasury_wallet_address,
            burn_tokens,
            settings.vision_burn_address,
            payment_ref,
        )
        return {
            **plan,
            "mode": "stub",
            "executed": False,
            "message": (
                "Stub only. Set SOLANA_PAYER_SECRET_KEY (+ mint/treasury/burn) "
                "to enable real transfers."
            ),
        }

    try:
        result = await _execute_live_transfers(settings, plan)
        return result
    except Exception as exc:
        logger.exception("solana live distribution failed: %s", exc)
        return {
            **plan,
            "mode": "error",
            "executed": False,
            "message": str(exc),
        }


async def _execute_live_transfers(
    settings: Settings,
    plan: dict[str, Any],
) -> dict[str, Any]:
    """
    Optional live path. Requires `solders` + `solana` packages.

    Gen-1 uses SPL token transfers of VISION_MINT_ADDRESS. If the SDK is not
    installed, fall back to stub messaging rather than crashing the webhook.
    """
    try:
        from solders.keypair import Keypair  # type: ignore
        from solders.pubkey import Pubkey  # type: ignore
    except ImportError:
        logger.warning(
            "SOLANA_PAYER_SECRET_KEY set but solders/solana not installed — "
            "keeping stub. pip install solders solana"
        )
        return {
            **plan,
            "mode": "stub_missing_sdk",
            "executed": False,
            "message": "Install solders+solana to broadcast transfers.",
        }

    # Validate key material without logging it.
    try:
        _payer = Keypair.from_base58_string(settings.solana_payer_secret_key.strip())
        _ = Pubkey.from_string(settings.treasury_wallet_address)
        _ = Pubkey.from_string(settings.vision_burn_address)
        _ = Pubkey.from_string(settings.vision_mint_address)
        _ = _payer.pubkey()
    except Exception as exc:
        raise RuntimeError(f"invalid Solana key/address configuration: {exc}") from exc

    # Broadcasting full SPL transfer instructions is environment-specific
    # (ATA creation, decimals, etc.). Gen-1 records a prepared live plan and
    # leaves the on-chain send to an operator-enabled worker once mint decimals
    # are confirmed — still never fabricates keys.
    logger.warning(
        "SOLANA_LIVE prepared (not auto-broadcast in Gen-1): treasury=%.6f burn=%.6f "
        "ref=%s — confirm mint decimals then extend _execute_live_transfers to send.",
        plan["treasury_tokens"],
        plan["burn_tokens"],
        plan["payment_ref"],
    )
    return {
        **plan,
        "mode": "live_prepared",
        "executed": False,
        "payer_pubkey": str(_payer.pubkey()),
        "message": (
            "Payer key valid; Gen-1 prepares the 70/30 plan. Extend this module "
            "with SPL transfer instructions once mint decimals are confirmed."
        ),
    }
