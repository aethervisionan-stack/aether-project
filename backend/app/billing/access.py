"""Production access gate — advanced Tool Registry requires payment_status=active."""
from __future__ import annotations

from typing import Any

from fastapi import Header, HTTPException, Query

from app.billing.entitlements import get_entitlement_store
from app.config import Settings, get_settings

ACTIVE_PAYMENT_STATUS = "active"


def production_bypass_allowed(settings: Settings | None = None) -> bool:
    cfg = settings or get_settings()
    return bool(cfg.subscription_check_bypassed() or cfg.billing_dev_tools_enabled())


def entitlement_is_active(status: dict[str, Any]) -> bool:
    if not status.get("active"):
        return False
    payment_status = status.get("payment_status")
    if payment_status is None:
        return True
    return str(payment_status).strip().lower() == ACTIVE_PAYMENT_STATUS


def resolve_access(*, subscriber_id: str | None = None, settings: Settings | None = None) -> dict[str, Any]:
    cfg = settings or get_settings()
    sid = (subscriber_id or "").strip()
    if production_bypass_allowed(cfg):
        return {
            "allowed": True,
            "reason": "dev_bypass",
            "subscriber_id": sid or "dev_bypass",
            "payment_status": ACTIVE_PAYMENT_STATUS if sid else "dev_bypass",
            "bypassed": True,
        }
    if not sid:
        return {
            "allowed": False,
            "reason": "missing_subscriber_id",
            "subscriber_id": "",
            "payment_status": "inactive",
            "bypassed": False,
        }
    store = get_entitlement_store()
    status = store.status(sid)
    if entitlement_is_active(status):
        return {
            "allowed": True,
            "reason": "entitlement_active",
            "subscriber_id": status.get("subscriber_id") or sid,
            "payment_status": status.get("payment_status") or ACTIVE_PAYMENT_STATUS,
            "bypassed": False,
            "entitlement": status,
        }
    return {
        "allowed": False,
        "reason": "payment_required",
        "subscriber_id": status.get("subscriber_id") or sid,
        "payment_status": status.get("payment_status") or "inactive",
        "bypassed": False,
        "entitlement": status,
    }


def require_active_payment(
    subscriber_id: str = Query(default="", alias="subscriber_id"),
    x_subscriber_id: str | None = Header(default=None, alias="X-Subscriber-Id"),
) -> dict[str, Any]:
    sid = (subscriber_id or x_subscriber_id or "").strip()
    access = resolve_access(subscriber_id=sid)
    if access["allowed"]:
        return access
    raise HTTPException(
        status_code=402,
        detail={
            "error": "payment_required",
            "message": (
                "Advanced Tool Registry requires payment_status=active. "
                "Pass subscriber_id / X-Subscriber-Id, or enable BILLING_DEV_UNLOCK for local testing only."
            ),
            "payment_status": access.get("payment_status"),
            "reason": access.get("reason"),
        },
    )
