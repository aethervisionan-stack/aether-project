"""HTTP routes for Google OAuth connect / callback / status."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse

from app.auth.google_oauth import get_google_oauth_service
from app.config import get_settings

router = APIRouter(prefix="/auth/google", tags=["auth-google"])


@router.get("/status")
async def google_auth_status(profile_id: str = "local") -> dict[str, Any]:
    return get_google_oauth_service().status(profile_id)


@router.get("/start")
async def google_auth_start(
    profile_id: str = "local",
    redirect: bool = Query(default=True),
) -> Any:
    service = get_google_oauth_service()
    if not service.configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and "
                "GOOGLE_OAUTH_CLIENT_SECRET (or GOOGLE_OAUTH_CLIENT_SECRETS_FILE) "
                "in backend/.env — never invent secret values."
            ),
        )
    try:
        payload = service.authorization_url(profile_id=profile_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)[:300]) from exc
    if redirect:
        return RedirectResponse(url=payload["authorization_url"], status_code=302)
    return payload


@router.get("/callback")
async def google_auth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> HTMLResponse:
    if error:
        return HTMLResponse(content=_page("Google OAuth error", f"<p>{error}</p>"), status_code=400)
    if not code:
        return HTMLResponse(
            content=_page("Missing code", "<p>OAuth callback missing <code>code</code>.</p>"),
            status_code=400,
        )
    service = get_google_oauth_service()
    try:
        result = service.exchange_code(code=code, state=state)
    except Exception as exc:  # noqa: BLE001
        return HTMLResponse(content=_page("Token exchange failed", f"<p>{exc}</p>"), status_code=400)
    email = result.get("email") or "(unknown)"
    refresh = "yes" if result.get("has_refresh_token") else "no"
    body = (
        f"<p>Connected as <strong>{email}</strong>.</p>"
        f"<p>refresh_token stored (encrypted): <code>{refresh}</code></p>"
        f"<p>profile: <code>{result.get('profile_id')}</code></p>"
        "<p>You can close this tab and return to the Aether HUD.</p>"
    )
    return HTMLResponse(content=_page("Google connected", body))


@router.delete("/disconnect")
async def google_auth_disconnect(profile_id: str = "local") -> dict[str, Any]:
    removed = get_google_oauth_service().disconnect(profile_id)
    return {"ok": True, "disconnected": removed, "profile_id": profile_id}


@router.get("/config")
async def google_auth_config() -> dict[str, Any]:
    settings = get_settings()
    service = get_google_oauth_service()
    return {
        "oauth_configured": service.configured(),
        "redirect_uri": settings.google_oauth_redirect_uri,
        "maps_api_key_configured": bool(
            (settings.google_maps_api_key or "").strip()
            and "placeholder" not in (settings.google_maps_api_key or "").lower()
        ),
        "scopes": list(service.status().get("scopes_requested") or []),
        "start": "/auth/google/start",
        "status": "/auth/google/status",
    }


def _page(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>{title}</title>
<style>
body{{font-family:system-ui,sans-serif;background:#0B0B0C;color:#F4F7F8;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}}
main{{max-width:28rem;padding:2rem;border:1px solid #222;border-radius:12px;background:#121316}}
a{{color:#00F0FF}}
</style></head><body><main><h1>{title}</h1>{body}</main></body></html>"""
