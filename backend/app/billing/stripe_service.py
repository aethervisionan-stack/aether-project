"""Stripe Checkout session helpers for monthly Aether Vision subscriptions."""

from __future__ import annotations

import logging
from typing import Any

import stripe

from app.config import Settings

logger = logging.getLogger("aether.billing.stripe")


class StripeNotConfiguredError(RuntimeError):
    pass


def expected_price(settings: Settings) -> dict[str, Any]:
    """Canonical Checkout amount used for create + verify (TEMP TEST aware)."""
    return {
        "currency": (settings.stripe_currency or "brl").strip().lower(),
        "unit_amount_cents": int(settings.stripe_unit_amount_cents),
        # TEMP TEST marker for operators restoring official pricing.
        "temp_test": bool(settings.stripe_force_unit_amount)
        and int(settings.stripe_unit_amount_cents) == 1
        and (settings.stripe_currency or "").strip().lower() == "brl",
    }


def _configure(settings: Settings) -> None:
    if not settings.has_stripe():
        raise StripeNotConfiguredError(
            "STRIPE_SECRET_KEY is not set. Add it to backend/.env or use "
            "BILLING_DEV_UNLOCK for local simulation."
        )
    stripe.api_key = settings.stripe_secret_key.strip()


def create_checkout_session(settings: Settings) -> dict[str, Any]:
    """Create a Stripe Checkout Session (subscription mode) and return url + id."""
    _configure(settings)
    price = expected_price(settings)

    use_dynamic = settings.stripe_force_unit_amount or not settings.stripe_price_id.strip()
    line_items: list[dict[str, Any]]
    if use_dynamic:
        if settings.stripe_price_id.strip() and settings.stripe_force_unit_amount:
            logger.warning(
                "TEMP TEST: ignoring STRIPE_PRICE_ID — using dynamic %s %s",
                price["unit_amount_cents"],
                price["currency"],
            )
        line_items = [
            {
                "price_data": {
                    "currency": price["currency"],
                    "unit_amount": price["unit_amount_cents"],
                    "recurring": {"interval": "month"},
                    "product_data": {
                        "name": "Aether Vision",
                        "description": (
                            "TEMP TEST R$0,01"
                            if price["temp_test"]
                            else "Monthly HUD + Live copiloto access"
                        ),
                    },
                },
                "quantity": 1,
            }
        ]
    else:
        line_items = [
            {
                "price": settings.stripe_price_id.strip(),
                "quantity": 1,
            }
        ]

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=line_items,
        success_url=settings.stripe_success_url,
        cancel_url=settings.stripe_cancel_url,
        allow_promotion_codes=True,
        billing_address_collection="auto",
        metadata={
            "product": "aether_vision_monthly",
            "treasury_share": "0.70",
            "burn_share": "0.30",
            "expected_currency": price["currency"],
            "expected_unit_amount_cents": str(price["unit_amount_cents"]),
            "temp_test": "true" if price["temp_test"] else "false",
        },
    )
    logger.info(
        "stripe checkout session created id=%s amount=%s %s temp_test=%s",
        session.id,
        price["unit_amount_cents"],
        price["currency"],
        price["temp_test"],
    )
    return {
        "id": session.id,
        "url": session.url,
        "currency": price["currency"],
        "unit_amount_cents": price["unit_amount_cents"],
        "temp_test": price["temp_test"],
        "publishable_key_configured": bool(settings.stripe_publishable_key.strip()),
    }


def construct_webhook_event(
    settings: Settings,
    payload: bytes,
    sig_header: str | None,
) -> stripe.Event:
    _configure(settings)
    secret = settings.stripe_webhook_secret.strip()
    if not secret:
        raise StripeNotConfiguredError(
            "STRIPE_WEBHOOK_SECRET is not set — cannot verify webhooks."
        )
    return stripe.Webhook.construct_event(payload, sig_header or "", secret)


def session_amount_major(session: Any) -> float:
    """Best-effort major-unit amount (e.g. BRL/USD) from a Checkout Session."""
    try:
        if isinstance(session, dict):
            total = session.get("amount_total")
        else:
            total = getattr(session, "amount_total", None)
        if total is not None:
            return float(total) / 100.0
    except Exception:
        pass
    return 0.0


# Back-compat alias used by routes/Solana scaling.
def session_amount_usd(session: Any) -> float:
    return session_amount_major(session)


def session_matches_expected_price(settings: Settings, session: Any) -> dict[str, Any]:
    """
    Compare paid Checkout Session totals to configured TEMP/official price.

    Returns a verification payload for `/billing/verify-subscription`.
    """
    expected = expected_price(settings)
    if isinstance(session, dict):
        amount_total = session.get("amount_total")
        currency = (session.get("currency") or "").lower()
        payment_status = session.get("payment_status")
        status = session.get("status")
        session_id = session.get("id")
    else:
        amount_total = getattr(session, "amount_total", None)
        currency = (getattr(session, "currency", None) or "").lower()
        payment_status = getattr(session, "payment_status", None)
        status = getattr(session, "status", None)
        session_id = getattr(session, "id", None)

    paid_ok = payment_status in {None, "paid", "no_payment_required"} or status == "complete"
    amount_ok = amount_total is not None and int(amount_total) == int(
        expected["unit_amount_cents"]
    )
    currency_ok = currency == expected["currency"]
    matched = bool(amount_ok and currency_ok)

    return {
        "session_id": session_id,
        "matched": matched,
        "paid_ok": bool(paid_ok),
        "expected": expected,
        "actual": {
            "amount_total_cents": amount_total,
            "currency": currency or None,
            "payment_status": payment_status,
            "status": status,
        },
        "temp_test": expected["temp_test"],
    }


def retrieve_checkout_session(settings: Settings, session_id: str) -> Any:
    _configure(settings)
    return stripe.checkout.Session.retrieve(session_id)
