"""Pluggable text-to-speech providers (Gemini + local mock)."""

from app.config import Settings, TtsProvider
from app.services.tts.base import TtsProviderProtocol
from app.services.tts.gemini import GeminiTts
from app.services.tts.mock import MockTts


def build_tts_provider(settings: Settings) -> TtsProviderProtocol:
    provider: TtsProvider = settings.effective_tts_provider()
    if provider == "gemini":
        return GeminiTts(settings)
    return MockTts(settings)


__all__ = [
    "TtsProviderProtocol",
    "MockTts",
    "GeminiTts",
    "build_tts_provider",
]
