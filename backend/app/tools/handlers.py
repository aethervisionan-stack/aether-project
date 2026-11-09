"""Concrete Aether Vision ecosystem tool handlers."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.billing.treasury_rpc import (
    OFFICIAL_TREASURY_WALLET,
    fetch_treasury_balance,
)
from app.config import Settings, get_settings
from app.memory.context import preferences_summary
from app.memory.store import get_memory_store

logger = logging.getLogger("aether.tools.handlers")


async def solana_treasury_query(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del profile_id  # unused — treasury is global
    cfg = settings or get_settings()
    wallet = str(args.get("wallet") or "").strip() or OFFICIAL_TREASURY_WALLET
    # Reuse resilient RPC helper; temporarily override wallet via local call.
    result = await _balance_for_wallet(cfg, wallet)
    return {
        "ok": bool(result.get("ok")),
        "wallet": wallet,
        "sol": result.get("sol"),
        "lamports": result.get("lamports"),
        "rpc": result.get("rpc"),
        "online": result.get("online"),
        "error": result.get("error"),
        "source": "tool:solana_treasury_query",
    }


async def _balance_for_wallet(settings: Settings, wallet: str) -> dict[str, Any]:
    """Fetch balance for an arbitrary wallet using the same RPC fallbacks."""
    import asyncio
    import json
    import urllib.error
    import urllib.request

    from app.billing.treasury_rpc import LAMPORTS_PER_SOL, treasury_rpc_candidates

    def _sync() -> dict[str, Any]:
        last_err = "no rpc"
        for rpc in treasury_rpc_candidates(settings):
            payload = json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getBalance",
                    "params": [wallet],
                }
            ).encode("utf-8")
            req = urllib.request.Request(
                rpc,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "aether-vision-tools/1.0",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=6.0) as resp:
                    body = json.loads(resp.read().decode("utf-8", errors="replace"))
                value = (((body or {}).get("result") or {}).get("value"))
                if value is None:
                    last_err = "missing value"
                    continue
                lamports = int(value)
                return {
                    "ok": True,
                    "online": True,
                    "rpc": rpc,
                    "lamports": lamports,
                    "sol": lamports / LAMPORTS_PER_SOL,
                }
            except urllib.error.HTTPError as exc:
                last_err = f"HTTP {exc.code}"
            except Exception as exc:  # noqa: BLE001
                last_err = str(exc)[:120]
        return {
            "ok": False,
            "online": False,
            "rpc": "",
            "lamports": None,
            "sol": None,
            "error": last_err,
        }

    # Official treasury path is already tested — prefer it when wallet matches.
    if wallet == OFFICIAL_TREASURY_WALLET:
        return await asyncio.to_thread(fetch_treasury_balance, settings)
    return await asyncio.to_thread(_sync)


async def onchain_lookup(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del profile_id
    cfg = settings or get_settings()
    address = str(args.get("address") or "").strip()
    method = str(args.get("method") or "getBalance").strip() or "getBalance"
    if not address:
        return {"ok": False, "error": "address required"}
    if method == "getBalance":
        return await _balance_for_wallet(cfg, address)
    # Minimal account info via getBalance fields + method echo (Gen-1).
    bal = await _balance_for_wallet(cfg, address)
    return {
        "ok": bool(bal.get("ok")),
        "method": method,
        "address": address,
        "exists": bal.get("ok") and bal.get("lamports") is not None,
        "lamports": bal.get("lamports"),
        "rpc": bal.get("rpc"),
        "error": bal.get("error"),
        "source": "tool:onchain_lookup",
    }


async def run_test_routine(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    cfg = settings or get_settings()
    routine = str(args.get("routine") or "health").strip()
    now = time.time()
    if routine == "health":
        return {
            "ok": True,
            "routine": routine,
            "status": "ok",
            "model": cfg.gemini_live_model,
            "api_key_configured": cfg.has_api_key(),
            "memory_enabled": cfg.memory_enabled,
            "at": now,
        }
    if routine == "memory_snapshot":
        store = get_memory_store()
        snap = store.snapshot(profile_id)
        prefs = snap.get("preferences") or {}
        return {
            "ok": True,
            "routine": routine,
            "profile_id": profile_id,
            "history_len": len(snap.get("history") or []),
            "preference_summary": preferences_summary(prefs),
            "at": now,
        }
    if routine == "latency_targets":
        return {
            "ok": True,
            "routine": routine,
            "targets_ms": {
                "ttft_text_chunk": 350,
                "ai_cycle_hud": 1200,
                "rtt_ping": 150,
            },
            "note": "HUD LatencyTracker reports measured ms; keep spectrogram off this path.",
            "at": now,
        }
    return {"ok": False, "error": f"unknown routine: {routine}"}


async def memory_payload(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del settings
    store = get_memory_store()
    action = str(args.get("action") or "get").strip()
    if action == "get":
        snap = store.snapshot(profile_id)
        return {
            "ok": True,
            "action": action,
            "profile_id": profile_id,
            "preferences": snap.get("preferences"),
            "preference_summary": preferences_summary(snap.get("preferences") or {}),
            "history_len": len(snap.get("history") or []),
        }
    if action == "patch_prefs":
        prefs_raw = args.get("preferences")
        if not isinstance(prefs_raw, dict):
            return {"ok": False, "error": "preferences object required"}
        prefs = store.update_preferences(profile_id, preferences=prefs_raw, merge=True)
        return {
            "ok": True,
            "action": action,
            "preferences": prefs.to_dict(),
            "preference_summary": preferences_summary(prefs),
        }
    if action == "clear_history":
        snap = store.clear_history(profile_id)
        return {"ok": True, "action": action, "cleared": True, "profile_id": snap.get("profile_id")}
    return {"ok": False, "error": f"unknown action: {action}"}
