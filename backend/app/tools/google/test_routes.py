"""GET test routes for live Gmail / Calendar / Drive / Maps (authenticated session).

Vite proxies `/api/*` → FastAPI `/*`, so browser/E2E can call:
  http://127.0.0.1:5173/api/tools/gmail/test
  http://127.0.0.1:8000/tools/gmail/test
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.tools.google import calendar_ops, drive_ops, gmail_ops, maps_ops
from app.tools.google.clients import api_error_payload, credentials_for, require_creds

router = APIRouter(prefix="/tools", tags=["google-tools-test"])


def _auth_required(profile_id: str) -> Any:
    try:
        return require_creds(profile_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=401,
            detail={
                "ok": False,
                "error": str(exc),
                "auth_login": "/auth/google/login",
                "auth_start": "/auth/google/start",
                "hint": "Complete OAuth, then retry this test route with the same profile_id",
            },
        ) from exc


@router.get("/gmail/test")
async def test_gmail(
    profile_id: str = Query(default="local"),
    limit: int = Query(default=5, ge=1, le=20),
) -> dict[str, Any]:
    """Real Gmail list (unread/priority) using the encrypted session token."""
    creds = _auth_required(profile_id)
    try:
        payload = await asyncio.to_thread(gmail_ops.list_priority_email, creds, limit=limit)
    except Exception as exc:  # noqa: BLE001
        return api_error_payload(exc, tool="gmail", action="test")
    return {
        "ok": bool(payload.get("ok")),
        "service": "gmail",
        "profile_id": profile_id,
        "mock": False,
        "authenticated": True,
        "result": payload,
    }


@router.get("/calendar/test")
async def test_calendar(
    profile_id: str = Query(default="local"),
    day: str = Query(default="today"),
) -> dict[str, Any]:
    """Real Calendar agenda query for the authenticated profile."""
    creds = _auth_required(profile_id)
    try:
        payload = await asyncio.to_thread(calendar_ops.query_agenda, creds, day=day)
    except Exception as exc:  # noqa: BLE001
        return api_error_payload(exc, tool="calendar", action="test")
    return {
        "ok": bool(payload.get("ok")),
        "service": "calendar",
        "profile_id": profile_id,
        "mock": False,
        "authenticated": True,
        "result": payload,
    }


@router.get("/drive/test")
async def test_drive(
    profile_id: str = Query(default="local"),
    query: str = Query(default=""),
    limit: int = Query(default=5, ge=1, le=20),
) -> dict[str, Any]:
    """Real Drive search (empty query → recent non-trashed files)."""
    creds = _auth_required(profile_id)
    try:
        payload = await asyncio.to_thread(
            drive_ops.search_files, creds, query=query, limit=limit
        )
    except Exception as exc:  # noqa: BLE001
        return api_error_payload(exc, tool="drive", action="test")
    return {
        "ok": bool(payload.get("ok")),
        "service": "drive",
        "profile_id": profile_id,
        "mock": False,
        "authenticated": True,
        "result": payload,
    }


@router.get("/maps/test")
async def test_maps(
    origin: str = Query(default="Times Square, New York, NY"),
    destination: str = Query(default="Central Park, New York, NY"),
) -> dict[str, Any]:
    """Real Maps Directions call (API key; OAuth session not required)."""
    settings = get_settings()
    if not settings.google_maps_configured():
        raise HTTPException(
            status_code=503,
            detail={
                "ok": False,
                "error": "GOOGLE_MAPS_API_KEY not configured",
                "hint": "Set a Maps Platform key in backend/.env (never invent values)",
            },
        )
    try:
        payload = await asyncio.to_thread(
            maps_ops.directions,
            origin=origin,
            destination=destination,
            mode="driving",
            settings=settings,
        )
    except Exception as exc:  # noqa: BLE001
        return api_error_payload(exc, tool="maps", action="test")
    return {
        "ok": bool(payload.get("ok")),
        "service": "maps",
        "mock": False,
        "api_key_configured": True,
        "oauth_required": False,
        "result": payload,
    }


@router.get("/google/test")
async def test_google_bundle(profile_id: str = Query(default="local")) -> dict[str, Any]:
    """Aggregate readiness probe (does not call Google until session/key present)."""
    settings = get_settings()
    creds = credentials_for(profile_id)
    return {
        "ok": True,
        "profile_id": profile_id,
        "oauth_configured": settings.google_oauth_configured(),
        "session_authenticated": creds is not None,
        "maps_api_key_configured": settings.google_maps_configured(),
        "endpoints": {
            "gmail": "/tools/gmail/test",
            "calendar": "/tools/calendar/test",
            "drive": "/tools/drive/test",
            "maps": "/tools/maps/test",
            "login": "/auth/google/login",
        },
        "vite_proxy_aliases": {
            "gmail": "/api/tools/gmail/test",
            "calendar": "/api/tools/calendar/test",
            "drive": "/api/tools/drive/test",
            "maps": "/api/tools/maps/test",
        },
    }
