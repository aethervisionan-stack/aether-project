"""High-fidelity TTS via OpenAI (pluggable; mock remains default)."""

from __future__ import annotations

import base64
import time
from typing import Any

from app.config import Settings
from app.models.schemas import TtsResult
from app.services.resilience import (
    RecoverableProviderError,
    classify_provider_failure,
    retry_async,
    transient_network_error,
)


class OpenAITts:
    name = "openai-tts"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def synthesize(self, text: str) -> TtsResult:
        if not self._settings.openai_api_key:
            raise RecoverableProviderError(
                "tts",
                "invalid_api_key: OPENAI_API_KEY missing (USE_MOCK_AUDIO=false)",
                provider=self.name,
            )

        started = time.perf_counter()

        async def _call() -> bytes:
            try:
                from openai import AsyncOpenAI
            except ImportError as exc:  # pragma: no cover
                raise RecoverableProviderError(
                    "tts",
                    f"openai_package_missing: {exc}",
                    provider=self.name,
                ) from exc

            client = AsyncOpenAI(api_key=self._settings.openai_api_key)
            try:
                response: Any = await client.audio.speech.create(
                    model=self._settings.openai_tts_model,
                    voice=self._settings.openai_tts_voice,  # type: ignore[arg-type]
                    input=text,
                    response_format="wav",
                )
                return response.content
            except Exception as exc:  # noqa: BLE001
                raise transient_network_error("openai-tts", exc) from exc

        try:
            audio = await retry_async(
                _call,
                attempts=self._settings.retry_attempts,
                backoff_ms=self._settings.retry_backoff_ms,
            )
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("tts", self.name, exc) from exc

        elapsed = int((time.perf_counter() - started) * 1000)
        return TtsResult(
            audio_base64=base64.b64encode(audio).decode("ascii"),
            mime_type="audio/wav",
            sample_rate=self._settings.tts_sample_rate,
            provider=self.name,
            duration_ms=elapsed,
            character_count=len(text),
        )
