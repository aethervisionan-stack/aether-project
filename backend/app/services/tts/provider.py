"""High-fidelity TTS via OpenAI (pluggable; mock remains default)."""

from __future__ import annotations

import base64
import time
from typing import Any

from app.config import Settings
from app.models.schemas import TtsResult
from app.services.resilience import retry_async, transient_network_error


class OpenAITts:
    name = "openai-tts"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        if not settings.openai_api_key:
            raise RuntimeError(
                "TTS_PROVIDER=openai requires OPENAI_API_KEY. "
                "Use TTS_PROVIDER=mock or PIPELINE_MODE=mock for local tests."
            )

    async def synthesize(self, text: str) -> TtsResult:
        started = time.perf_counter()

        async def _call() -> bytes:
            try:
                from openai import AsyncOpenAI
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError("Install openai package for TTS_PROVIDER=openai") from exc

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

        audio = await retry_async(
            _call,
            attempts=self._settings.retry_attempts,
            backoff_ms=self._settings.retry_backoff_ms,
        )
        elapsed = int((time.perf_counter() - started) * 1000)
        return TtsResult(
            audio_base64=base64.b64encode(audio).decode("ascii"),
            mime_type="audio/wav",
            sample_rate=self._settings.tts_sample_rate,
            provider=self.name,
            duration_ms=elapsed,
            character_count=len(text),
        )
