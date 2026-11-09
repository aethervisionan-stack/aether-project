"""HTTP routes: Stripe Checkout, webhook, entitlement status, Solana job kickoff."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

from app.billing.entitlements import get_entitlement_store
from app.billing.solana_distribution import distribute_subscription_proceeds
from app.billing.stripe_service import (
    StripeNotConfiguredError,
    construct_webhook_event,
    create_checkout_session,
    expected_price,
    retrieve_checkout_session,
    session_amount_usd,
    session_matches_expected_price,
)
from app.config import get_settings

logger = logging.getLogger("aether.billing.routes")

router = APIRouter(prefix="/billing", tags=["billing"])


class DevUnlockBody(BaseModel):
    label: str = Field(default="local-dev")


class EntitlementQuery(BaseModel):
    subscriber_id: str


@router.get("/config")
async def billing_config() -> dict[str, Any]:
    """Public billing config for the client widget (no secrets)."""
    settings = get_settings()
    price = expected_price(settings)
    return {
        "stripe_configured": settings.has_stripe(),
        "mock_checkout": settings.stripe_mock_checkout_enabled(),
        "publishable_key": settings.stripe_publishable_key.strip() or None,
        "dev_unlock_enabled": bool(settings.billing_dev_unlock) and not settings.has_stripe(),
        "solana_mode": (
            "live_prepared"
            if settings.solana_live_transfers_enabled()
            else "stub"
        ),
        "treasury_share": 0.70,
        "burn_share": 0.30,
        "unit_amount_cents": price["unit_amount_cents"],
        "currency": price["currency"],
        "interval": "month",
        # TEMP TEST: true while BRL 0,01 force-unit-amount is active.
        "temp_test": price["temp_test"],
    }


@router.post("/checkout")
async def start_checkout(background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Create a Stripe Checkout Session (or local mock) and return the hosted URL."""
    settings = get_settings()
    try:
        result = create_checkout_session(settings)
    except StripeNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("checkout session failed")
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc}") from exc

    # Mock path: simulate webhook unlock immediately so AI/HUD tests work without Stripe.
    if result.get("mock"):
        mock_session = {
            "id": result["id"],
            "amount_total": result["unit_amount_cents"],
            "currency": result["currency"],
            "payment_status": "paid",
            "status": "complete",
            "customer_email": None,
            "customer_details": {},
        }
        await _handle_checkout_completed(mock_session, background_tasks)
    return result


@router.get("/entitlement")
async def entitlement_status(subscriber_id: str) -> dict[str, Any]:
    store = get_entitlement_store()
    return store.status(subscriber_id)


@router.get("/verify-subscription")
async def verify_subscription(session_id: str) -> dict[str, Any]:
    """
    Verify a Checkout Session amount/currency against configured TEMP/official price.

    Also exposed as the Gen-1 price check used after Stripe return / before trusting unlock.
    Proxied as `/api/billing/verify-subscription`.
    """
    settings = get_settings()
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id required")

    # Dev / mock / offline path: entitlement already granted under this id.
    store = get_entitlement_store()
    ent = store.status(session_id.strip())
    source = str(ent.get("source") or "")
    if ent.get("active") and (
        source.startswith("dev") or source.startswith("mock") or session_id.startswith("cs_test_mock_")
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
                "Stripe not configured. TEMP expected price is listed under expected; "
                "use Simulate unlock or set STRIPE_SECRET_KEY to verify live sessions."
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


@router.post("/dev-unlock")
async def dev_unlock(
    body: DevUnlockBody,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Local-only simulate successful payment when Stripe keys are missing.

    Disabled automatically once STRIPE_SECRET_KEY is set, unless
    BILLING_DEV_UNLOCK remains true *and* stripe is unset (see config).
    """
    settings = get_settings()
    if settings.has_stripe() or not settings.billing_dev_unlock:
        raise HTTPException(
            status_code=403,
            detail="Dev unlock disabled (Stripe configured or BILLING_DEV_UNLOCK=false).",
        )

    subscriber_id = f"dev_{uuid.uuid4().hex[:12]}"
    store = get_entitlement_store()
    expires = time.time() + 31 * 24 * 3600
    amount_usd = settings.stripe_unit_amount_cents / 100.0

    # Grant immediately, then run tokenomics in background.
    store.grant(
        subscriber_id=subscriber_id,
        source="dev_unlock",
        expires_at=expires,
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
        "source": "dev_unlock",
        "expires_at": expires,
    }


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
        email=existing.email if existing else None,
        stripe_session_id=existing.stripe_session_id if existing else None,
        stripe_customer_id=existing.stripe_customer_id if existing else None,
        expires_at=existing.expires_at if existing else None,
        metadata=meta,
    )


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    """
    Stripe webhook — on `checkout.session.completed` unlock access and enqueue
    the 70/30 Solana distribution job.
    """
    settings = get_settings()
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    # Local/dev: accept unsigned JSON mock events when Stripe is not configured.
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

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await _handle_checkout_completed(session, background_tasks)
    elif event["type"] in {"customer.subscription.deleted", "customer.subscription.paused"}:
        # Gen-1: log only — full revoke UX comes later.
        logger.info("stripe subscription lifecycle event type=%s", event["type"])
    else:
        logger.debug("ignored stripe event type=%s", event["type"])

    return {"status": "ok"}


async def _handle_checkout_completed(
    session: Any,
    background_tasks: BackgroundTasks,
) -> None:
    settings = get_settings()
    store = get_entitlement_store()

    session_id = str(session.get("id") or "")
    customer_id = str(session.get("customer") or "") or None
    email = None
    details = session.get("customer_details") or {}
    if isinstance(details, dict):
        email = details.get("email")
    email = email or session.get("customer_email")

    subscriber_id = customer_id or session_id or f"stripe_{uuid.uuid4().hex[:12]}"
    is_mock = str(session_id).startswith("cs_test_mock_")
    price_check = session_matches_expected_price(settings, session)
    if not price_check["matched"] and not is_mock:
        logger.warning(
            "checkout amount mismatch (still unlocking Gen-1) expected=%s actual=%s",
            price_check["expected"],
            price_check["actual"],
        )

    amount_major = session_amount_usd(session)
    if amount_major <= 0:
        amount_major = settings.stripe_unit_amount_cents / 100.0

    expires_at = time.time() + 31 * 24 * 3600

    # Instant HUD unlock for Gen-1 (AI access) after payment confirmation.
    store.grant(
        subscriber_id=subscriber_id,
        source="mock_stripe" if is_mock else "stripe",
        email=email,
        stripe_session_id=session_id or None,
        stripe_customer_id=customer_id,
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
        "checkout completed — entitlement active subscriber_id=%s session=%s",
        subscriber_id,
        session_id,
    )
