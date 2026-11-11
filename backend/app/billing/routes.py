"""HTTP routes: Stripe Checkout/webhooks, Solana Pay verify, entitlement status."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.billing.entitlements import (
    PAYMENT_STATUS_ACTIVE,
    PAYMENT_STATUS_CANCELED,
    PAYMENT_STATUS_PAST_DUE,
    PAYMENT_STATUS_PENDING,
    get_entitlement_store,
)
from app.billing.solana_distribution import distribute_subscription_proceeds
from app.billing.solana_pay import (
    build_transfer_request,
    decode_helius_or_generic_webhook,
    verify_transfer_on_chain,
    webhook_payload_digest,
)
from app.billing.stripe_service import (
    BillingInterval,
    StripeNotConfiguredError,
    cancel_subscription,
    construct_webhook_event,
    create_checkout_session,
    expected_price,
    invoice_receipt_summary,
    list_receipts,
    retrieve_checkout_session,
    session_amount_usd,
    session_matches_expected_price,
)
from app.billing.treasury_rpc import fetch_treasury_balance
from app.config import get_settings

logger = logging.getLogger("aether.billing.routes")

router = APIRouter(prefix="/billing", tags=["billing"])

# In-memory pending Solana Pay requests (Gen-1). Survives process lifetime only.
_PENDING_SOLANA_PAY: dict[str, dict[str, Any]] = {}


class DevUnlockBody(BaseModel):
    label: str = Field(default="local-dev")


class DevLockBody(BaseModel):
    """Local/dev reset — clear entitlement for a subscriber/session id."""

    subscriber_id: str = Field(default="")


class CheckoutBody(BaseModel):
    interval: Literal["month", "year"] = "month"
    customer_email: str | None = None


class CancelBody(BaseModel):
    subscriber_id: str = Field(default="")
    subscription_id: str = Field(default="")
    at_period_end: bool = True


class SolanaPayCreateBody(BaseModel):
    asset: Literal["USDC", "SOL"] = "USDC"
    amount: float | None = None
    subscriber_hint: str | None = None
    label: str = "Aether Vision"
    message: str = "Subscription"


class SolanaPayVerifyBody(BaseModel):
    reference: str
    signature: str | None = None
    subscriber_id: str | None = None


@router.get("/config")
async def billing_config() -> dict[str, Any]:
    """Public billing config for the client widget (no secrets)."""
    settings = get_settings()
    monthly = expected_price(settings, "month")
    annual = expected_price(settings, "year")
    feature_unlock = settings.local_feature_unlock()
    # Simulate unlock: mock path without Stripe, or full local unlock (DEV bypass only).
    simulate_unlock = feature_unlock and (
        not settings.has_stripe() or settings.subscription_check_bypassed()
    )
    return {
        "stripe_configured": settings.has_stripe(),
        "stripe_mode": settings.stripe_mode(),
        "mock_checkout": settings.stripe_mock_checkout_enabled(),
        "publishable_key": settings.publishable_key_public(),
        "dev_unlock_enabled": simulate_unlock,
        "dev_tools_enabled": settings.billing_dev_tools_enabled() or feature_unlock,
        "bypass_subscription_check": settings.subscription_check_bypassed(),
        "feature_unlock": feature_unlock,
        "unlocked_surfaces": settings.unlocked_surfaces(),
        "solana_mode": (
            "live_prepared"
            if settings.solana_live_transfers_enabled()
            else "stub"
        ),
        "solana_pay": {
            "enabled": bool(settings.treasury_wallet_address.strip()),
            "assets": ["USDC", "SOL"],
            "amount_usdc": settings.solana_pay_amount_usdc,
            "amount_sol": settings.solana_pay_amount_sol,
            "ttl_seconds": settings.solana_pay_ttl_seconds,
            "create_path": "/billing/solana/create-payment",
            "verify_path": "/billing/solana/verify",
            "webhook_path": "/billing/solana/webhook",
        },
        "treasury_share": 0.70,
        "burn_share": 0.30,
        "treasury_wallet": settings.treasury_wallet_address.strip(),
        "solana_rpc_url": settings.solana_rpc_url.strip() or "https://api.devnet.solana.com",
        "treasury_rpc_url": (
            settings.treasury_rpc_url.strip() or "https://rpc.ankr.com/solana"
        ),
        "treasury_balance_path": "/billing/treasury-balance",
        "unit_amount_cents": monthly["unit_amount_cents"],
        "currency": monthly["currency"],
        "interval": "month",
        "intervals": {
            "month": monthly,
            "year": annual,
        },
        "temp_test": monthly["temp_test"],
        "tool_registry_requires_active": True,
    }


@router.get("/treasury-balance")
async def treasury_balance() -> dict[str, Any]:
    """Proxy Solana getBalance for the official treasury wallet."""
    settings = get_settings()
    return await asyncio.to_thread(fetch_treasury_balance, settings)


@router.post("/checkout")
async def start_checkout(
    background_tasks: BackgroundTasks,
    body: CheckoutBody | None = None,
) -> dict[str, Any]:
    """Create a Stripe Checkout Session (monthly or annual) and return the hosted URL."""
    settings = get_settings()
    interval: BillingInterval = "month"
    email: str | None = None
    if body is not None:
        interval = body.interval
        email = body.customer_email
    try:
        result = create_checkout_session(
            settings,
            interval=interval,
            customer_email=email,
        )
    except StripeNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("checkout session failed")
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc}") from exc

    if result.get("mock"):
        mock_session = {
            "id": result["id"],
            "amount_total": result["unit_amount_cents"],
            "currency": result["currency"],
            "payment_status": "paid",
            "status": "complete",
            "customer_email": email,
            "customer_details": {},
            "metadata": {"interval": interval},
            "subscription": None,
        }
        await _handle_checkout_completed(mock_session, background_tasks)
    return result


@router.get("/entitlement")
async def entitlement_status(subscriber_id: str = "") -> dict[str, Any]:
    """
    Access probe. Production: returns store payment_status.
    DEV-only: BYPASS_SUBSCRIPTION_CHECK=true returns granted without DB row.
    """
    settings = get_settings()
    if settings.subscription_check_bypassed():
        sid = (subscriber_id or "").strip() or "bypass_local"
        return {
            "subscriber_id": sid,
            "active": True,
            "payment_status": PAYMENT_STATUS_ACTIVE,
            "source": "bypass_subscription_check",
            "email": None,
            "expires_at": None,
            "granted_at": None,
            "bypassed": True,
        }
    store = get_entitlement_store()
    return store.status(subscriber_id)


@router.get("/verify-subscription")
async def verify_subscription(session_id: str) -> dict[str, Any]:
    """Verify a Checkout Session amount/currency against configured price."""
    settings = get_settings()
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id required")

    store = get_entitlement_store()
    ent = store.status(session_id.strip())
    source = str(ent.get("source") or "")
    if ent.get("active") and (
        source.startswith("dev")
        or source.startswith("mock")
        or session_id.startswith("cs_test_mock_")
    ):
        price = expected_price(settings)
        return {
            "matched": True,
            "paid_ok": True,
            "source": source or "mock_entitlement",
            "entitlement": ent,
            "expected": price,
            "temp_test": price["temp_test"],
        }

    price = expected_price(settings)
    if not settings.has_stripe():
        return {
            "matched": False,
            "paid_ok": False,
            "source": "offline",
            "expected": price,
            "temp_test": price["temp_test"],
            "entitlement": ent,
            "message": (
                "Stripe not configured. Use Solana Pay, set STRIPE_SECRET_KEY, "
                "or enable BILLING_DEV_UNLOCK for local mock only."
            ),
        }

    try:
        session = retrieve_checkout_session(settings, session_id.strip())
    except StripeNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Session not found: {exc}") from exc

    verification = session_matches_expected_price(settings, session)
    verification["entitlement"] = store.status(session_id.strip())
    return verification


@router.post("/cancel")
async def cancel_sub(body: CancelBody) -> dict[str, Any]:
    """Cancel Stripe subscription (default at period end) and sync payment_status."""
    settings = get_settings()
    store = get_entitlement_store()
    sid = (body.subscriber_id or "").strip()
    sub_id = (body.subscription_id or "").strip()

    ent = store.get(sid) if sid else None
    if not sub_id and ent is not None:
        sub_id = (ent.stripe_subscription_id or "").strip()

    if not sub_id:
        raise HTTPException(
            status_code=400,
            detail="subscription_id required (or subscriber_id with known Stripe sub)",
        )

    if not settings.has_stripe():
        # Local/mock: mark canceled in store only.
        result = store.set_payment_status(
            sid or sub_id,
            PAYMENT_STATUS_CANCELED,
            metadata_patch={"cancel_local": True, "subscription_id": sub_id},
        )
        return {"ok": True, "mode": "local", "stripe": None, "entitlement": result}

    try:
        stripe_result = cancel_subscription(
            settings,
            subscription_id=sub_id,
            at_period_end=body.at_period_end,
        )
    except StripeNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("cancel subscription failed")
        raise HTTPException(status_code=502, detail=f"Stripe cancel error: {exc}") from exc

    # At period end: keep active until webhook; immediate cancel → canceled now.
    if body.at_period_end:
        patch = store.set_payment_status(
            sid or sub_id,
            PAYMENT_STATUS_ACTIVE,
            metadata_patch={
                "cancel_at_period_end": True,
                "stripe_cancel": stripe_result,
            },
        )
    else:
        patch = store.set_payment_status(
            sid or sub_id,
            PAYMENT_STATUS_CANCELED,
            metadata_patch={"stripe_cancel": stripe_result},
        )

    return {"ok": True, "mode": "stripe", "stripe": stripe_result, "entitlement": patch}


@router.get("/receipts")
async def receipts(subscriber_id: str = "", limit: int = 12) -> dict[str, Any]:
    """List Stripe invoice receipts for a subscriber (customer / subscription)."""
    settings = get_settings()
    store = get_entitlement_store()
    sid = subscriber_id.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="subscriber_id required")

    ent = store.get(sid)
    stored = []
    if ent and isinstance(ent.metadata, dict):
        stored = list(ent.metadata.get("receipts") or [])

    live: list[dict[str, Any]] = []
    if settings.has_stripe() and ent is not None:
        try:
            live = list_receipts(
                settings,
                customer_id=ent.stripe_customer_id,
                subscription_id=ent.stripe_subscription_id,
                limit=limit,
            )
        except Exception as exc:
            logger.warning("list_receipts failed: %s", exc)
            return {
                "subscriber_id": sid,
                "receipts": stored[-limit:],
                "source": "store",
                "error": str(exc),
            }

    return {
        "subscriber_id": sid,
        "receipts": live or stored[-limit:],
        "source": "stripe" if live else "store",
        "payment_status": store.status(sid).get("payment_status"),
    }


@router.post("/dev-unlock")
async def dev_unlock(
    body: DevUnlockBody,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    DEV-only simulate successful payment.

    Requires BILLING_DEV_UNLOCK (or bypass) — disabled by default in production.
    Refused when stripe_mode=live even if unlock flag is mistakenly set.
    """
    settings = get_settings()
    if settings.stripe_mode() == "live":
        raise HTTPException(
            status_code=403,
            detail="Dev unlock is blocked when STRIPE_SECRET_KEY is sk_live_.",
        )
    allow = settings.local_feature_unlock() and (
        not settings.has_stripe() or settings.subscription_check_bypassed()
    )
    if not allow:
        raise HTTPException(
            status_code=403,
            detail=(
                "Dev unlock disabled. Set BILLING_DEV_UNLOCK=true for local mock only "
                "(off by default in production)."
            ),
        )

    subscriber_id = f"dev_{uuid.uuid4().hex[:12]}"
    store = get_entitlement_store()
    expires = time.time() + 31 * 24 * 3600
    amount_usd = settings.stripe_unit_amount_cents / 100.0

    store.grant(
        subscriber_id=subscriber_id,
        source="dev_unlock",
        payment_status=PAYMENT_STATUS_ACTIVE,
        expires_at=expires,
        interval="month",
        metadata={"label": body.label, "solana_pending": True},
    )
    background_tasks.add_task(
        _run_solana_and_patch,
        settings,
        subscriber_id,
        amount_usd,
        f"dev:{subscriber_id}",
    )

    return {
        "subscriber_id": subscriber_id,
        "active": True,
        "payment_status": PAYMENT_STATUS_ACTIVE,
        "source": "dev_unlock",
        "expires_at": expires,
    }


@router.post("/dev-lock")
async def dev_lock(body: DevLockBody) -> dict[str, Any]:
    """DEV-only: revoke entitlement so the HUD returns to blocked state."""
    settings = get_settings()
    if not settings.local_feature_unlock():
        raise HTTPException(
            status_code=403,
            detail="Dev lock unavailable (BILLING_DEV_UNLOCK off).",
        )

    key = (body.subscriber_id or "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="subscriber_id required")

    store = get_entitlement_store()
    result = store.revoke(key)
    return {
        **result,
        "blocked": True,
        "message": "Subscription reset — access blocked until Subscribe again.",
    }


# --- Solana Pay -------------------------------------------------------------


@router.post("/solana/create-payment")
async def solana_create_payment(body: SolanaPayCreateBody) -> dict[str, Any]:
    """Create a Solana Pay transfer request (USDC or SOL → treasury)."""
    settings = get_settings()
    try:
        request = build_transfer_request(
            settings,
            asset=body.asset,
            amount=body.amount,
            subscriber_hint=body.subscriber_hint,
            label=body.label,
            message=body.message,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _PENDING_SOLANA_PAY[request["reference"]] = request
    # Soft-create pending entitlement so clients can poll payment_status.
    hint = (body.subscriber_hint or "").strip() or request["reference"]
    store = get_entitlement_store()
    subscriber_id = (
        hint if hint.startswith("sol_") else f"sol_{request['reference'][-12:]}"
    )
    store.grant(
        subscriber_id=subscriber_id,
        source="solana_pay_pending",
        payment_status=PAYMENT_STATUS_PENDING,
        expires_at=float(request["expires_at"]),
        metadata={"solana_pay": request, "reference": request["reference"]},
    )
    store.register_alias(request["reference"], subscriber_id)

    return {
        "ok": True,
        "payment": request,
        "subscriber_id": subscriber_id,
        "verify_path": "/billing/solana/verify",
    }


@router.post("/solana/verify")
async def solana_verify(
    body: SolanaPayVerifyBody,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Scan chain (or check provided signature) and activate entitlement on match."""
    settings = get_settings()
    ref = body.reference.strip()
    pending = _PENDING_SOLANA_PAY.get(ref)
    store = get_entitlement_store()

    if pending is None:
        # Recover from entitlement metadata if process restarted.
        ent = store.get(ref) or store.get(body.subscriber_id or "")
        meta = (ent.metadata if ent else None) or {}
        pending = meta.get("solana_pay") if isinstance(meta, dict) else None
        if not isinstance(pending, dict):
            raise HTTPException(status_code=404, detail="Unknown Solana Pay reference")

    if float(pending.get("expires_at") or 0) and time.time() > float(pending["expires_at"]):
        raise HTTPException(status_code=410, detail="Solana Pay request expired")

    result = await asyncio.to_thread(
        verify_transfer_on_chain,
        settings,
        reference=ref,
        recipient=str(pending.get("recipient") or settings.treasury_wallet_address),
        asset=str(pending.get("asset") or "USDC"),
        amount=float(pending.get("amount") or 0),
        mint=pending.get("mint"),
        signature=body.signature,
    )

    if not result.get("verified"):
        return {
            "ok": True,
            "verified": False,
            "payment_status": PAYMENT_STATUS_PENDING,
            "scan": result,
        }

    subscriber_id = (
        (body.subscriber_id or "").strip()
        or str(pending.get("subscriber_hint") or "")
        or f"sol_{ref[-12:]}"
    )
    amount = float(result.get("amount") or pending.get("amount") or 0)
    expires = time.time() + 31 * 24 * 3600
    store.grant(
        subscriber_id=subscriber_id,
        source="solana_pay",
        payment_status=PAYMENT_STATUS_ACTIVE,
        expires_at=expires,
        interval="month",
        metadata={
            "solana_pay": pending,
            "verification": {
                "signature": result.get("signature"),
                "asset": result.get("asset"),
                "amount": result.get("amount"),
            },
            "solana_pending": True,
        },
    )
    store.register_alias(ref, subscriber_id)

    background_tasks.add_task(
        _run_solana_and_patch,
        settings,
        subscriber_id,
        amount,
        result.get("signature") or ref,
    )
    _PENDING_SOLANA_PAY.pop(ref, None)

    return {
        "ok": True,
        "verified": True,
        "payment_status": PAYMENT_STATUS_ACTIVE,
        "subscriber_id": subscriber_id,
        "active": True,
        "scan": result,
    }


@router.post("/solana/webhook")
async def solana_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_solana_pay_secret: str | None = Header(default=None, alias="X-Solana-Pay-Secret"),
) -> dict[str, Any]:
    """
    Chain webhook ingress (Helius-style or generic).

    Always re-verifies on-chain before granting. Optional shared secret via
    SOLANA_PAY_WEBHOOK_SECRET / X-Solana-Pay-Secret (never invent secrets).
    """
    settings = get_settings()
    expected = settings.solana_pay_webhook_secret.strip()
    if expected:
        provided = (x_solana_pay_secret or request.headers.get("Authorization") or "").strip()
        if provided.startswith("Bearer "):
            provided = provided[7:].strip()
        if provided != expected:
            raise HTTPException(status_code=401, detail="Invalid Solana Pay webhook secret")

    raw = await request.body()
    digest = webhook_payload_digest(raw)
    try:
        import json as _json

        payload = _json.loads(raw.decode("utf-8") or "{}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    events = decode_helius_or_generic_webhook(payload if isinstance(payload, dict) else {})
    activated: list[str] = []

    for event in events:
        ref = str(event.get("reference") or "").strip()
        sig = str(event.get("signature") or "").strip() or None
        if not ref and not sig:
            continue
        # Prefer pending by reference; else try all pending with signature scan.
        candidates = [ref] if ref else list(_PENDING_SOLANA_PAY.keys())
        for candidate in candidates:
            pending = _PENDING_SOLANA_PAY.get(candidate)
            if not pending:
                continue
            body = SolanaPayVerifyBody(
                reference=candidate,
                signature=sig,
                subscriber_id=pending.get("subscriber_hint"),
            )
            outcome = await solana_verify(body, background_tasks)
            if outcome.get("verified"):
                activated.append(candidate)

    logger.info(
        "solana webhook digest=%s events=%s activated=%s",
        digest,
        len(events),
        len(activated),
    )
    return {"status": "ok", "digest": digest, "activated": activated, "events": len(events)}


async def _run_solana_and_patch(
    settings: Any,
    subscriber_id: str,
    amount_usd: float,
    payment_ref: str,
) -> None:
    store = get_entitlement_store()
    result = await distribute_subscription_proceeds(
        settings,
        amount_usd=amount_usd,
        payment_ref=payment_ref,
        subscriber_id=subscriber_id,
    )
    existing = store.get(subscriber_id)
    meta = dict(existing.metadata or {}) if existing else {}
    meta["solana"] = result
    meta.pop("solana_pending", None)
    store.grant(
        subscriber_id=subscriber_id,
        source=existing.source if existing else "dev_unlock",
        payment_status=(
            existing.payment_status if existing else PAYMENT_STATUS_ACTIVE
        ),
        email=existing.email if existing else None,
        stripe_session_id=existing.stripe_session_id if existing else None,
        stripe_customer_id=existing.stripe_customer_id if existing else None,
        stripe_subscription_id=existing.stripe_subscription_id if existing else None,
        interval=existing.interval if existing else None,
        expires_at=existing.expires_at if existing else None,
        metadata=meta,
    )


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    """
    Stripe webhook — checkout completed, invoice receipts, subscription cancel/past_due.
    """
    settings = get_settings()
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    if settings.stripe_mock_checkout_enabled() and not settings.has_stripe():
        try:
            import json as _json

            event = _json.loads(payload.decode("utf-8") or "{}")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid mock webhook JSON: {exc}") from exc
        if event.get("type") == "checkout.session.completed":
            session = (event.get("data") or {}).get("object") or {}
            await _handle_checkout_completed(session, background_tasks)
        return {"status": "ok", "mode": "mock"}

    try:
        event = construct_webhook_event(settings, payload, sig)
    except StripeNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning("webhook signature/verify failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook") from exc

    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        await _handle_checkout_completed(obj, background_tasks)
    elif etype in {"invoice.paid", "invoice.payment_succeeded"}:
        await _handle_invoice_paid(obj)
    elif etype == "customer.subscription.updated":
        await _handle_subscription_updated(obj)
    elif etype in {
        "customer.subscription.deleted",
        "customer.subscription.paused",
    }:
        await _handle_subscription_canceled(obj)
    elif etype == "invoice.payment_failed":
        await _handle_payment_failed(obj)
    else:
        logger.debug("ignored stripe event type=%s", etype)

    return {"status": "ok"}


async def _handle_checkout_completed(
    session: Any,
    background_tasks: BackgroundTasks,
) -> None:
    settings = get_settings()
    store = get_entitlement_store()

    session_id = str(session.get("id") or "")
    customer_id = str(session.get("customer") or "") or None
    subscription_id = str(session.get("subscription") or "") or None
    email = None
    details = session.get("customer_details") or {}
    if isinstance(details, dict):
        email = details.get("email")
    email = email or session.get("customer_email")

    meta = session.get("metadata") or {}
    interval = "month"
    if isinstance(meta, dict):
        interval = str(meta.get("interval") or "month").lower()
    if interval not in {"month", "year"}:
        interval = "month"

    subscriber_id = customer_id or session_id or f"stripe_{uuid.uuid4().hex[:12]}"
    is_mock = str(session_id).startswith("cs_test_mock_")
    price_check = session_matches_expected_price(settings, session)
    if not price_check["matched"] and not is_mock:
        logger.warning(
            "checkout amount mismatch (still unlocking) expected=%s actual=%s",
            price_check["expected"],
            price_check["actual"],
        )

    amount_major = session_amount_usd(session)
    if amount_major <= 0:
        amount_major = (
            settings.stripe_annual_unit_amount_cents / 100.0
            if interval == "year"
            else settings.stripe_unit_amount_cents / 100.0
        )

    expires_at = time.time() + (366 if interval == "year" else 31) * 24 * 3600

    store.grant(
        subscriber_id=subscriber_id,
        source="mock_stripe" if is_mock else "stripe",
        payment_status=PAYMENT_STATUS_ACTIVE,
        email=email,
        stripe_session_id=session_id or None,
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        interval=interval,
        expires_at=expires_at,
        metadata={
            "amount_major": amount_major,
            "currency": price_check["expected"]["currency"],
            "price_check": price_check,
            "solana_pending": True,
            "temp_test": price_check["temp_test"],
            "mock": is_mock,
        },
    )

    background_tasks.add_task(
        _run_solana_and_patch,
        settings,
        subscriber_id,
        amount_major,
        session_id or subscriber_id,
    )
    logger.info(
        "checkout completed — payment_status=active subscriber_id=%s session=%s interval=%s",
        subscriber_id,
        session_id,
        interval,
    )


async def _handle_invoice_paid(invoice: Any) -> None:
    store = get_entitlement_store()
    receipt = invoice_receipt_summary(invoice)
    customer = str(receipt.get("customer") or "") or None
    subscription = str(receipt.get("subscription") or "") or None
    key = customer or subscription
    if not key:
        return
    store.append_receipt(key, receipt)
    # Renew / confirm active on paid invoice
    period_end = None
    lines = invoice.get("lines") if isinstance(invoice, dict) else None
    if isinstance(lines, dict):
        data = lines.get("data") or []
        if data and isinstance(data[0], dict):
            period = data[0].get("period") or {}
            if isinstance(period, dict) and period.get("end"):
                period_end = float(period["end"])
    store.set_payment_status(
        key,
        PAYMENT_STATUS_ACTIVE,
        expires_at=period_end,
        metadata_patch={"last_invoice": receipt.get("id")},
    )
    logger.info("invoice paid — receipt=%s customer=%s", receipt.get("id"), customer)


async def _handle_subscription_updated(sub: Any) -> None:
    store = get_entitlement_store()
    sub_id = str(sub.get("id") or "")
    customer = str(sub.get("customer") or "")
    status = str(sub.get("status") or "").lower()
    key = customer or sub_id
    if not key:
        return
    if status in {"active", "trialing"}:
        payment_status = PAYMENT_STATUS_ACTIVE
    elif status in {"past_due", "unpaid"}:
        payment_status = PAYMENT_STATUS_PAST_DUE
    elif status in {"canceled", "incomplete_expired"}:
        payment_status = PAYMENT_STATUS_CANCELED
    else:
        payment_status = status or PAYMENT_STATUS_PENDING
    period_end = sub.get("current_period_end")
    store.set_payment_status(
        key,
        payment_status,
        expires_at=float(period_end) if period_end else None,
        metadata_patch={"stripe_subscription_status": status, "subscription_id": sub_id},
    )


async def _handle_subscription_canceled(sub: Any) -> None:
    store = get_entitlement_store()
    sub_id = str(sub.get("id") or "")
    customer = str(sub.get("customer") or "")
    key = customer or sub_id
    if not key:
        return
    store.set_payment_status(
        key,
        PAYMENT_STATUS_CANCELED,
        metadata_patch={"stripe_subscription_status": "canceled", "subscription_id": sub_id},
    )
    logger.info("subscription canceled key=%s sub=%s", key, sub_id)


async def _handle_payment_failed(invoice: Any) -> None:
    store = get_entitlement_store()
    customer = str(invoice.get("customer") or "")
    subscription = str(invoice.get("subscription") or "")
    key = customer or subscription
    if not key:
        return
    store.set_payment_status(
        key,
        PAYMENT_STATUS_PAST_DUE,
        metadata_patch={"last_failed_invoice": invoice.get("id")},
    )
