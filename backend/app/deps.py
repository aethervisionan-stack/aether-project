"""FastAPI dependency wiring — keeps providers swappable."""

from __future__ import annotations

from functools import lru_cache

from app.agent.tools import ToolRegistry
from app.config import Settings, get_settings
from app.core.memory import AdaptiveMemory, get_adaptive_memory
from app.services.agent_service import AgentService
from app.services.consenso_alfa import ConsensoAlfa
from app.services.gemini_gateway import GeminiGateway
from app.services.pipeline import AudioPipeline
from app.services.stt import build_stt_provider
from app.services.tts import build_tts_provider


@lru_cache
def get_pipeline() -> AudioPipeline:
    settings = get_settings()
    memory: AdaptiveMemory | None = None
    if settings.memory_enabled:
        memory = get_adaptive_memory()
    consenso = ConsensoAlfa(settings)
    tools = ToolRegistry(settings=settings, memory=memory)
    agent_service = AgentService(
        settings=settings,
        consenso=consenso,
        tools=tools,
        memory=memory,
    )
    return AudioPipeline(
        settings=settings,
        stt=build_stt_provider(settings),
        tts=build_tts_provider(settings),
        consenso=consenso,
        agent_service=agent_service,
        memory=memory,
        gemini=GeminiGateway(settings),
    )


def get_app_settings() -> Settings:
    return get_settings()
