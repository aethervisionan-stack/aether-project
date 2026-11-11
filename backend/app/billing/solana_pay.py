"""Solana Pay middleware — verify USDC / SOL transfers to the treasury wallet."""

from __future__ import annotations

import hashlib
import json
import logging
import time
import urllib.error
import urllib.request
import uuid
from typing import Any
from urllib.parse import quote

from app.config import Settings

logger = logging.getLogger("aether.billing.solana_pay")

LAMPORTS_PER_SOL = 1_000_000_000
USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
USDC_DECIMALS = 6


def usdc_mint_for_rpc(rpc_url: str, override: str = "") -> str:
    if override.strip():
        return override.strip()
    if "devnet" in (rpc_url or "").lower():
        return USDC_MINT_DEVNET
    return USDC_MINT_MAINNET


def new_payment_reference() -> str:
    return f"avpay_{uuid.uuid4().hex}"


def build_transfer_request(
    settings: Settings,
    *,
    asset: str = "USDC",
    amount: float | None = None,
    subscriber_hint: str | None = None,
    label: str = "Aether Vision",
    message: str = "Subscription",
) -> dict[str, Any]:
    asset_u = (asset or "USDC").strip().upper()
    if asset_u not in {"USDC", "SOL"}:
        raise ValueError("asset must be USDC or SOL")
    treasury = (settings.treasury_wallet_address or "").strip()
    if not treasury:
        raise ValueError("TREASURY_WALLET_ADDRESS is required for Solana Pay")
    if amount is None:
        amount = (
            float(settings.solana_pay_amount_usdc)
            if asset_u == "USDC"
            else float(settings.solana_pay_amount_sol)
        )
    amount_f = max(0.0, float(amount))
    reference = new_payment_reference()
    mint = (
        usdc_mint_for_rpc(settings.solana_rpc_url, settings.solana_usdc_mint)
        if asset_u == "USDC"
        else None
    )
    params = [
        f"amount={amount_f}",
        f"reference={reference}",
        f"label={quote(label, safe='')}",
        f"message={quote(message, safe='')}",
    ]
    if mint:
        params.append(f"spl-token={mint}")
    link = f"solana:{treasury}?{'&'.join(params)}"
    created_at = time.time()
    return {
        "reference": reference,
        "recipient": treasury,
        "asset": asset_u,
        "amount": amount_f,
        "mint": mint,
        "decimals": USDC_DECIMALS if asset_u == "USDC" else 9,
        "link": link,
        "label": label,
        "message": message,
        "subscriber_hint": (subscriber_hint or "").strip() or None,
        "created_at": created_at,
        "expires_at": created_at + float(settings.solana_pay_ttl_seconds),
        "rpc": settings.solana_rpc_url.strip() or "https://api.mainnet-beta.solana.com",
        "status": "pending",
    }


def _rpc_call(rpc_url: str, method: str, params: list[Any], timeout_s: float = 12.0) -> dict[str, Any]:
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(
        "utf-8"
    )
    req = urllib.request.Request(
        rpc_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "aether-vision-solana-pay/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:240]
        return {"ok": False, "error": f"RPC HTTP {exc.code}", "detail": detail}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc) or exc.__class__.__name__}
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {"ok": False, "error": "invalid JSON from RPC"}
    if isinstance(data, dict) and data.get("error"):
        err = data["error"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        return {"ok": False, "error": msg or "RPC error"}
    return {"ok": True, "result": data.get("result") if isinstance(data, dict) else data}


def verify_transfer_on_chain(
    settings: Settings,
    *,
    reference: str,
    recipient: str,
    asset: str,
    amount: float,
    mint: str | None = None,
    signature: str | None = None,
) -> dict[str, Any]:
    rpc = (settings.solana_rpc_url or "").strip() or "https://api.mainnet-beta.solana.com"
    asset_u = (asset or "USDC").strip().upper()
    expected_amount = max(0.0, float(amount))
    ref = (reference or "").strip()
    treasury = (recipient or settings.treasury_wallet_address or "").strip()
    if not treasury:
        return {"ok": False, "verified": False, "error": "missing treasury recipient"}
    mint_addr = mint or (
        usdc_mint_for_rpc(rpc, settings.solana_usdc_mint) if asset_u == "USDC" else None
    )
    signatures: list[str] = []
    if signature and signature.strip():
        signatures = [signature.strip()]
    else:
        sig_resp = _rpc_call(
            rpc,
            "getSignaturesForAddress",
            [treasury, {"limit": int(settings.solana_pay_scan_limit)}],
        )
        if not sig_resp.get("ok"):
            return {
                "ok": False,
                "verified": False,
                "error": sig_resp.get("error") or "signature scan failed",
                "rpc": rpc,
            }
        result = sig_resp.get("result") or []
        if isinstance(result, list):
            for item in result:
                if isinstance(item, dict) and item.get("signature"):
                    signatures.append(str(item["signature"]))
    inspected = 0
    for sig in signatures:
        inspected += 1
        tx_resp = _rpc_call(
            rpc,
            "getTransaction",
            [sig, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
        )
        if not tx_resp.get("ok") or not tx_resp.get("result"):
            continue
        match = _match_transaction(
            tx_resp["result"],
            treasury=treasury,
            asset=asset_u,
            expected_amount=expected_amount,
            mint=mint_addr,
            reference=ref,
        )
        if match.get("matched"):
            return {
                "ok": True,
                "verified": True,
                "signature": sig,
                "rpc": rpc,
                "asset": asset_u,
                "amount": match.get("amount"),
                "reference": ref,
                "recipient": treasury,
                "inspected": inspected,
                "match": match,
            }
    return {
        "ok": True,
        "verified": False,
        "rpc": rpc,
        "asset": asset_u,
        "reference": ref,
        "recipient": treasury,
        "inspected": inspected,
        "message": "No matching treasury transfer found yet — retry after confirmation.",
    }


def _match_transaction(
    tx: dict[str, Any],
    *,
    treasury: str,
    asset: str,
    expected_amount: float,
    mint: str | None,
    reference: str,
) -> dict[str, Any]:
    meta = tx.get("meta") if isinstance(tx, dict) else None
    if not isinstance(meta, dict) or meta.get("err"):
        return {"matched": False, "reason": "tx_failed"}
    log_messages = meta.get("logMessages") or []
    ref_seen = bool(reference) and reference in " ".join(str(m) for m in log_messages)
    tolerance = max(expected_amount * 0.01, 1e-9 if asset == "SOL" else 0.000001)
    if asset == "SOL":
        message = (tx.get("transaction") or {}).get("message") or {}
        account_keys = message.get("accountKeys") or []
        keys: list[str] = []
        for k in account_keys:
            keys.append(str(k.get("pubkey") or "") if isinstance(k, dict) else str(k))
        try:
            idx = keys.index(treasury)
        except ValueError:
            return {"matched": False, "reason": "treasury_not_in_keys"}
        pre = meta.get("preBalances") or []
        post = meta.get("postBalances") or []
        if idx >= len(pre) or idx >= len(post):
            return {"matched": False, "reason": "balance_arrays_short"}
        delta_sol = (int(post[idx]) - int(pre[idx])) / LAMPORTS_PER_SOL
        if delta_sol + 1e-12 >= expected_amount - tolerance:
            return {
                "matched": True,
                "amount": delta_sol,
                "unit": "SOL",
                "reference_seen": ref_seen,
            }
        return {"matched": False, "reason": "sol_amount_low", "amount": delta_sol}
    pre_map = _token_amount_map(meta.get("preTokenBalances") or [], owner=treasury, mint=mint)
    post_map = _token_amount_map(meta.get("postTokenBalances") or [], owner=treasury, mint=mint)
    delta = 0.0
    for acct, post_amt in post_map.items():
        delta += post_amt - pre_map.get(acct, 0.0)
    if not post_map and not pre_map:
        parsed_amount = _parse_spl_transfer_amount(tx, treasury=treasury, mint=mint)
        if parsed_amount is not None:
            delta = parsed_amount
    if delta + 1e-12 >= expected_amount - tolerance:
        return {
            "matched": True,
            "amount": delta,
            "unit": "USDC",
            "mint": mint,
            "reference_seen": ref_seen,
        }
    return {"matched": False, "reason": "usdc_amount_low", "amount": delta, "mint": mint}


def _token_amount_map(balances: list[Any], *, owner: str, mint: str | None) -> dict[str, float]:
    out: dict[str, float] = {}
    for entry in balances:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("owner") or "") != owner:
            continue
        if mint and str(entry.get("mint") or "") != mint:
            continue
        ui = entry.get("uiTokenAmount") if isinstance(entry.get("uiTokenAmount"), dict) else {}
        try:
            amt = float(ui.get("uiAmount") if ui.get("uiAmount") is not None else 0)
        except (TypeError, ValueError):
            amt = 0.0
        out[str(entry.get("accountIndex"))] = amt
    return out


def _parse_spl_transfer_amount(
    tx: dict[str, Any], *, treasury: str, mint: str | None
) -> float | None:
    message = (tx.get("transaction") or {}).get("message") or {}
    instructions = list(message.get("instructions") or [])
    meta = tx.get("meta") or {}
    for group in meta.get("innerInstructions") or []:
        if isinstance(group, dict):
            instructions.extend(group.get("instructions") or [])
    for ix in instructions:
        if not isinstance(ix, dict):
            continue
        parsed = ix.get("parsed")
        if not isinstance(parsed, dict):
            continue
        if parsed.get("type") not in {"transfer", "transferChecked"}:
            continue
        info = parsed.get("info") or {}
        if not isinstance(info, dict):
            continue
        if mint and info.get("mint") and str(info.get("mint")) != mint:
            continue
        token_amount = info.get("tokenAmount") if isinstance(info.get("tokenAmount"), dict) else None
        try:
            if token_amount and token_amount.get("uiAmount") is not None:
                return float(token_amount["uiAmount"])
            if info.get("amount") is not None:
                return float(info["amount"]) / (10 ** USDC_DECIMALS)
        except (TypeError, ValueError):
            continue
        _ = treasury
    return None


def webhook_payload_digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()[:16]


def decode_helius_or_generic_webhook(payload: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    if not isinstance(payload, dict):
        return events
    if payload.get("signature") or payload.get("reference"):
        events.append(
            {
                "signature": payload.get("signature"),
                "reference": payload.get("reference"),
                "asset": payload.get("asset") or payload.get("token") or "SOL",
                "amount": payload.get("amount"),
                "recipient": payload.get("recipient") or payload.get("to"),
            }
        )
    txs = payload.get("transactions") or payload.get("events") or []
    if isinstance(txs, list):
        for item in txs:
            if isinstance(item, dict):
                events.append(
                    {
                        "signature": item.get("signature")
                        or item.get("transaction")
                        or item.get("txid"),
                        "reference": item.get("reference"),
                        "asset": item.get("asset") or "SOL",
                        "amount": item.get("amount"),
                        "recipient": item.get("recipient") or item.get("feePayer"),
                    }
                )
    return events
