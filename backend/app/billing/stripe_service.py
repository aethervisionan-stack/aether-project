"""Stripe Checkout, subscription lifecycle, receipts."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Literal

import stripe

from app.config import Settings

logger = logging.getLogger("aether.billing.stripe")

BillingInterval = Literal["month", "year"]


class StripeNotConfiguredError(RuntimeError):
    pass


def _configure(settings: Settings) -> None:
    if not settings.has_stripe():
        raise StripeNotConfiguredError(
            "STRIPE_SECRET_KEY is not set (or is a placeholder). "
            "Add a real sk_test_/sk_live_ key, or set BILLING_DEV_UNLOCK=true "
            "for mock Checkout only in non-live environments."
        )
    stripe.api_key = settings.stripe_secret_key.strip()


def expected_price(settings: Settings, interval: BillingInterval = "month") -> dict[str, Any]:
    iv = (interval or "month").strip().lower()
    if iv not in {"month", "year"}:
        iv = "month"
    if iv == "year":
        currency = (settings.stripe_annual_currency or settings.stripe_currency or "usd").strip().lower()
        unit_amount_cents = int(settings.stripe_annual_unit_amount_cents)
        price_id = (
            settings.stripe_price_id_annual.strip()
            or settings.stripe_annual_price_id.strip()
        )
        temp_test = False
    else:
        currency = (settings.stripe_currency or "usd").strip().lower()
        unit_amount_cents = int(settings.stripe_unit_amount_cents)
        price_id = (
            settings.stripe_price_id_monthly.strip() or settings.stripe_price_id.strip()
        )
        temp_test = bool(settings.stripe_force_unit_amount) and unit_amount_cents <= 1
    return {
        "interval": iv,
        "currency": currency,
        "unit_amount_cents": unit_amount_cents,
        "price_id": price_id or None,
        "temp_test": temp_test,
    }


def create_mock_checkout_session(
    settings: Settings,
    interval: BillingInterval = "month",
) -> dict[str, Any]:
    price = expected_price(settings, interval)
    session_id = f"cs_test_mock_{uuid.uuid4().hex[:20]}"
    success = settings.stripe_success_url.replace("{CHECKOUT_SESSION_ID}", session_id)
    return {
        "id": session_id,
        "url": success,
        "checkout_url": success,
        "interval": price["interval"],
        "currency": price["currency"],
        "unit_amount_cents": price["unit_amount_cents"],
        "temp_test": price["temp_test"],
        "mock": True,
        "publishable_key_configured": False,
    }


def create_checkout_session(
    settings: Settings,
    interval: BillingInterval = "month",
) -> dict[str, Any]:
    if not settings.has_stripe():
        if settings.stripe_mock_checkout_enabled():
            return create_mock_checkout_session(settings, interval)
        raise StripeNotConfiguredError(
            "STRIPE_SECRET_KEY missing and BILLING_DEV_UNLOCK is false."
        )

    _configure(settings)
    price = expected_price(settings, interval)
    iv = price["interval"]
    use_dynamic = settings.stripe_force_unit_amount or not (price.get("price_id") or "")
    if use_dynamic:
        line_items = [
            {
                "price_data": {
                    "currency": price["currency"],
                    "unit_amount": price["unit_amount_cents"],
                    "recurring": {"interval": iv},
                    "product_data": {
                        "name": "Aether Vision",
                        "description": f"{'Annual' if iv == 'year' else 'Monthly'} subscription",
                    },
                },
                "quantity": 1,
            }
        ]
    else:
        line_items = [{"price": price["price_id"], "quantity": 1}]

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=line_items,
        success_url=settings.stripe_success_url,
        cancel_url=settings.stripe_cancel_url,
        allow_promotion_codes=True,
        billing_address_collection="auto",
        locale="auto",
        metadata={
            "billing_interval": iv,
            "expected_currency": price["currency"],
            "expected_unit_amount_cents": str(price["unit_amount_cents"]),
        },
    )
    checkout_url = session.url
    if not checkout_url:
        raise RuntimeError("Stripe Checkout Session missing hosted url")
    return {
        "id": session.id,
        "url": checkout_url,
        "checkout_url": checkout_url,
        "interval": iv,
        "currency": price["currency"],
        "unit_amount_cents": price["unit_amount_cents"],
        "temp_test": price["temp_test"],
        "mock": False,
        "stripe_mode": settings.stripe_mode(),
        "publishable_key_configured": settings.publishable_key_public() is not None,
    }


def construct_webhook_event(
    settings: Settings,
    payload: bytes,
    sig_header: str | None,
) -> stripe.Event:
    _configure(settings)
    secret = settings.stripe_webhook_secret.strip()
    if not secret:
        raise StripeNotConfiguredError("STRIPE_WEBHOOK_SECRET is not set.")
    return stripe.Webhook.construct_event(payload, sig_header or "", secret)


def retrieve_checkout_session(settings: Settings, session_id: str) -> Any:
    _configure(settings)
    return stripe.checkout.Session.retrieve(session_id)


def cancel_subscription(
    settings: Settings,
    *,
    subscription_id: str | None = None,
    customer_id: str | None = None,
    at_period_end: bool = True,
) -> dict[str, Any]:
    _configure(settings)
    sub_id = (subscription_id or "").strip()
    if not sub_id and customer_id:
        subs = stripe.Subscription.list(customer=customer_id.strip(), status="active", limit=1)
        data = subs.get("data") if isinstance(subs, dict) else getattr(subs, "data", None)
        if data:
            first = data[0]
            sub_id = str(first.get("id") if isinstance(first, dict) else getattr(first, "id", ""))
    if not sub_id:
        raise ValueError("subscription_id or active customer subscription required")
    if at_period_end:
        sub = stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        sid = sub.get("id") if isinstance(sub, dict) else getattr(sub, "id", sub_id)
        return {"subscription_id": sid, "status": "cancel_scheduled", "cancel_at_period_end": True}
    sub = stripe.Subscription.cancel(sub_id)
    sid = sub.get("id") if isinstance(sub, dict) else getattr(sub, "id", sub_id)
    return {"subscription_id": sid, "status": "canceled", "cancel_at_period_end": False}


def invoice_receipt_summary(invoice: Any) -> dict[str, Any]:
    if isinstance(invoice, dict):
        inv_id = invoice.get("id")
        amount_paid = invoice.get("amount_paid")
        currency = invoice.get("currency")
        status = invoice.get("status")
        created = invoice.get("created")
        customer = invoice.get("customer")
        subscription = invoice.get("subscription")
        hosted = invoice.get("hosted_invoice_url")
        pdf = invoice.get("invoice_pdf")
    else:
        inv_id = getattr(invoice, "id", None)
        amount_paid = getattr(invoice, "amount_paid", None)
        currency = getattr(invoice, "currency", None)
        status = getattr(invoice, "status", None)
        created = getattr(invoice, "created", None)
        customer = getattr(invoice, "customer", None)
        subscription = getattr(invoice, "subscription", None)
        hosted = getattr(invoice, "hosted_invoice_url", None)
        pdf = getattr(invoice, "invoice_pdf", None)
    return {
        "invoice_id": inv_id,
        "amount_paid_cents": amount_paid,
        "currency": currency,
        "status": status,
        "created": created,
        "customer_id": customer,
        "subscription_id": subscription,
        "hosted_invoice_url": hosted,
        "invoice_pdf": pdf,
        "source": "stripe",
    }


def list_receipts(
    settings: Settings,
    *,
    customer_id: str,
    limit: int = 12,
) -> list[dict[str, Any]]:
    _configure(settings)
    cid = (customer_id or "").strip()
    if not cid:
        return []
    invoices = stripe.Invoice.list(customer=cid, limit=min(max(limit, 1), 24))
    data = invoices.get("data") if isinstance(invoices, dict) else getattr(invoices, "data", [])
    return [invoice_receipt_summary(inv) for inv in (data or [])]


def session_amount_major(session: Any) -> float:
    try:
        total = session.get("amount_total") if isinstance(session, dict) else getattr(session, "amount_total", None)
        if total is not None:
            return float(total) / 100.0
    except Exception:
        pass
    return 0.0


def session_amount_usd(session: Any) -> float:
    return session_amount_major(session)


def session_matches_expected_price(
    settings: Settings,
    session: Any,
    interval: BillingInterval = "month",
) -> dict[str, Any]:
    expected = expected_price(settings, interval)
    if isinstance(session, dict):
        amount_total = session.get("amount_total")
        currency = (session.get("currency") or "").lower()
        payment_status = session.get("payment_status")
        status = session.get("status")
        session_id = session.get("id")
        meta = session.get("metadata") or {}
    else:
        amount_total = getattr(session, "amount_total", None)
        currency = (getattr(session, "currency", None) or "").lower()
        payment_status = getattr(session, "payment_status", None)
        status = getattr(session, "status", None)
        session_id = getattr(session, "id", None)
        meta = getattr(session, "metadata", None) or {}

    iv = (meta.get("billing_interval") if isinstance(meta, dict) else None) or interval
    if iv in {"month", "year"} and iv != expected["interval"]:
        expected = expected_price(settings, iv)

    paid_ok = payment_status in {None, "paid", "no_payment_required"} or status == "complete"
    amount_ok = amount_total is not None and int(amount_total) == int(expected["unit_amount_cents"])
    currency_ok = currency == expected["currency"]
    return {
        "session_id": session_id,
        "matched": bool(amount_ok and currency_ok),
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
