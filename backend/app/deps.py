"""FastAPI dependency wiring — keeps providers swappable."""

from __future__ import annotations

from functools import lru_cache

from app.config import Settings, get_settings
from app.services.agent import ResponseAgent
from app.services.consenso_alfa import ConsensoAlfa
from app.services.pipeline import AudioPipeline
from app.services.stt import build_stt_provider
from app.services.tts import build_tts_provider


@lru_cache
def get_pipeline() -> AudioPipeline:
    settings = get_settings()
    return AudioPipeline(
        settings=settings,
        stt=build_stt_provider(settings),
        tts=build_tts_provider(settings),
        consenso=ConsensoAlfa(settings),
        agent=ResponseAgent(),
    )


def get_app_settings() -> Settings:
    return get_settings()
