"""FastAPI entrypoint — Aether Vision Gemini Live bridge."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.billing import routes as billing_routes
from app.config import get_settings
from app.memory import routes as memory_routes
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
        "Stripe subscription + Solana 70/30 tokenomics under `/billing`. "
        "Long-term memory / prefs under `/memory`. "
        "Frontier tools under `/tools`. CoT + multimodal sidecars on `/ws/live`."
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


@app.get("/verify-subscription")
async def verify_subscription_alias(session_id: str):
    """Alias for `/billing/verify-subscription` (Vite: `/api/verify-subscription`)."""
    return await billing_routes.verify_subscription(session_id)


@app.get("/health")
async def health() -> dict[str, object]:
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
        "frontier": {
            "cot": True,
            "tools": True,
            "multimodal": True,
            "memory_runtime": True,
            "token_streaming": True,
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
    }


logger.info(
    "Aether Vision Live ready model=%s cors=%s stripe=%s solana=%s",
    settings.gemini_live_model,
    settings.cors_origin_list,
    settings.has_stripe(),
    "live_prepared" if settings.solana_live_transfers_enabled() else "stub",
)
