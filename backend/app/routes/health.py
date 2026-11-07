"""Health / readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app import __version__
from app.config import Settings
from app.deps import get_app_settings
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_app_settings)) -> HealthResponse:
    depin_ready = bool(settings.solana_rpc_url and settings.aether_agent_wallet)
    return HealthResponse(
        status="ok",
        version=__version__,
        pipeline_mode=settings.pipeline_mode,
        stt_provider=settings.effective_stt_provider(),
        tts_provider=settings.effective_tts_provider(),
        consenso_enabled=settings.consenso_enabled,
        depin_ready=depin_ready,
    )
