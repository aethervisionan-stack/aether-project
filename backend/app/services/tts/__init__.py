"""Pluggable text-to-speech providers."""

from app.config import Settings, TtsProvider
from app.services.tts.base import TtsProviderProtocol
from app.services.tts.mock import MockTts
from app.services.tts.provider import OpenAITts


def build_tts_provider(settings: Settings) -> TtsProviderProtocol:
    provider: TtsProvider = settings.effective_tts_provider()
    if provider == "openai":
        return OpenAITts(settings)
    return MockTts(settings)


__all__ = [
    "TtsProviderProtocol",
    "MockTts",
    "OpenAITts",
    "build_tts_provider",
]
