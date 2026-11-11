"""FastAPI entrypoint — Aether Vision Gemini Live bridge."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import ENGINE_NAME, ENGINE_VERSION, __version__
from app.auth import routes as google_auth_routes
from app.billing import routes as billing_routes
from app.config import get_settings
from app.introspection.manifest import build_feature_flags
from app.introspection.telemetry import get_latency_telemetry
from app.memory import routes as memory_routes
from app.os_bridge.mock import get_os_bridge
from app.persona.real_life_copilot import ENGINE_ACTIVATION_BANNER
from app.tools import routes as tools_routes
from app.websocket import live as live_ws

settings = get_settings()
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("aether.main")

app = FastAPI(
    title="Aether Vision Live API",
    description=(
        "Modular FastAPI bridge: browser WebSocket `/ws/live` ↔ "
        "Google GenAI Live (`gemini-3.8-live`) for HUD/spatial audio. "
        f"Persona: {ENGINE_ACTIVATION_BANNER} — Strategic Real-Life Co-Pilot. "
        "Stripe subscription + Solana 70/30 tokenomics under `/billing`. "
        "Long-term memory / prefs under `/memory`. "
        "Frontier tools under `/tools`. CoT + multimodal sidecars on `/ws/live`. "
        "Hands-free OS agent: messaging/email/telephony/system + two-step confirm. "
        "Google OAuth: Gmail/Calendar/Drive + Maps tools under `/auth/google`. "
        "Introspection: dynamic self-knowledge + system_help_tool."
    ),
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(live_ws.router)
app.include_router(billing_routes.router)
app.include_router(memory_routes.router)
app.include_router(tools_routes.router)
app.include_router(google_auth_routes.router)


@app.get("/verify-subscription")
async def verify_subscription_alias(session_id: str):
    """Alias for `/billing/verify-subscription` (Vite: `/api/verify-subscription`)."""
    return await billing_routes.verify_subscription(session_id)


@app.get("/health")
async def health() -> dict[str, object]:
    feature_unlock = settings.local_feature_unlock()
    return {
        "status": "ok",
        "service": "aether-vision-live",
        "version": __version__,
        "model": settings.gemini_live_model,
        "api_key_configured": settings.has_api_key(),
        "stripe_configured": settings.has_stripe(),
        "solana_mode": (
            "live_prepared"
            if settings.solana_live_transfers_enabled()
            else "stub"
        ),
        "ws": "/ws/live",
        "billing": "/billing/config",
        "memory": "/memory/profile",
        "memory_enabled": settings.memory_enabled,
        "tools": "/tools/catalog",
        "bypass_subscription_check": settings.subscription_check_bypassed(),
        "feature_unlock": feature_unlock,
        "unlocked_surfaces": settings.unlocked_surfaces(),
        "frontier": {
            "cot": True,
            "tools": True,
            "multimodal": True,
            "memory_runtime": True,
            "token_streaming": True,
            "real_life_copilot": True,
            "engine": ENGINE_ACTIVATION_BANNER,
            "engine_version": ENGINE_VERSION,
            "engine_name": ENGINE_NAME,
        },
        "mobility": {
            "copilot_mode": True,
            "notifications": True,
            "productivity": True,
            "geo_nav": True,
            "audio_profile": True,
            "priority_manager": True,
            "vad_open_mic": True,
            "push_to_talk": True,
            "barge_in": True,
        },
        "hands_free": {
            "os_agent": True,
            "messaging_tool": True,
            "email_calendar_tool": True,
            "telephony_tool": True,
            "system_control_tool": True,
            "two_step_confirm": True,
            "notification_listener": True,
            "os_bridge": get_os_bridge().status().get("platform", "mock"),
            "google_drive_tool": True,
            "google_maps_tool": True,
        },
        "google": {
            "oauth_configured": settings.google_oauth_configured(),
            "maps_api_key_configured": settings.google_maps_configured(),
            "auth_start": "/auth/google/start",
            "auth_status": "/auth/google/status",
            "os_bridge": get_os_bridge().status().get("google"),
        },
        "introspection": {
            **build_feature_flags(),
            "latency": get_latency_telemetry(),
        },
        "unlocked_routes": [
            "/health",
            "/ws/live",
            "/billing/config",
            "/billing/entitlement",
            "/billing/dev-unlock",
            "/memory/profile",
            "/tools/catalog",
            "/tools/invoke",
            "/tools/confirm",
            "/tools/pending",
            "/tools/listener/poll",
            "/tools/listener/ingest",
            "/tools/os-bridge",
            "/auth/google/start",
            "/auth/google/callback",
            "/auth/google/status",
            "/auth/google/config",
        ],
    }


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "aether-vision-live",
        "version": __version__,
        "health": "/health",
        "docs": "/docs",
        "websocket": "/ws/live",
        "billing": "/billing/config",
        "memory": "/memory/profile",
        "tools": "/tools/catalog",
        "google_auth": "/auth/google/status",
    }


logger.info("Activated %s", ENGINE_ACTIVATION_BANNER)
logger.info(
    "Aether Vision Live ready version=%s engine=%s model=%s cors=%s stripe=%s solana=%s",
    __version__,
    ENGINE_ACTIVATION_BANNER,
    settings.gemini_live_model,
    settings.cors_origin_list,
    settings.has_stripe(),
    "live_prepared" if settings.solana_live_transfers_enabled() else "stub",
)
