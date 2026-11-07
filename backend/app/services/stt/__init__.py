"""Pluggable speech-to-text providers (Gemini + local mock)."""

from app.config import Settings, SttProvider
from app.services.stt.base import SttProviderProtocol
from app.services.stt.gemini import GeminiStt
from app.services.stt.mock import MockWhisperStt


def build_stt_provider(settings: Settings) -> SttProviderProtocol:
    provider: SttProvider = settings.effective_stt_provider()
    if provider == "gemini":
        return GeminiStt(settings)
    return MockWhisperStt(settings)


__all__ = [
    "SttProviderProtocol",
    "MockWhisperStt",
    "GeminiStt",
    "build_stt_provider",
]
