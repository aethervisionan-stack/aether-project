"""Pluggable speech-to-text providers."""

from app.config import Settings, SttProvider
from app.services.stt.base import SttProviderProtocol
from app.services.stt.mock import MockWhisperStt
from app.services.stt.whisper import LocalWhisperStt, OpenAIWhisperStt


def build_stt_provider(settings: Settings) -> SttProviderProtocol:
    provider: SttProvider = settings.effective_stt_provider()
    if provider == "openai":
        return OpenAIWhisperStt(settings)
    if provider == "local":
        return LocalWhisperStt(settings)
    return MockWhisperStt(settings)


__all__ = [
    "SttProviderProtocol",
    "MockWhisperStt",
    "OpenAIWhisperStt",
    "LocalWhisperStt",
    "build_stt_provider",
]
