"""Stripe Checkout session helpers for monthly Aether Vision subscriptions."""

from __future__ import annotations

import logging
from typing import Any

import stripe

from app.config import Settings

logger = logging.getLogger("aether.billing.stripe")


class StripeNotConfiguredError(RuntimeError):
    pass


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

    line_items: list[dict[str, Any]]
    if settings.stripe_price_id.strip():
        line_items = [
            {
                "price": settings.stripe_price_id.strip(),
                "quantity": 1,
            }
        ]
    else:
        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(settings.stripe_unit_amount_cents),
                    "recurring": {"interval": "month"},
                    "product_data": {
                        "name": "Aether Vision",
                        "description": "Monthly HUD + Live copiloto access",
                    },
                },
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
        },
    )
    logger.info("stripe checkout session created id=%s", session.id)
    return {
        "id": session.id,
        "url": session.url,
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


def session_amount_usd(session: Any) -> float:
    """Best-effort USD amount from a Checkout Session object."""
    try:
        total = getattr(session, "amount_total", None)
        if total is not None:
            return float(total) / 100.0
    except Exception:
        pass
    return 0.0
