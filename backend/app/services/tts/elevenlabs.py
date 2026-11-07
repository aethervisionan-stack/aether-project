"""ElevenLabs TTS adapter (pluggable; requires ELEVENLABS_API_KEY)."""

from __future__ import annotations

import base64
import time

import httpx

from app.config import Settings
from app.models.schemas import TtsResult
from app.services.resilience import (
    RecoverableProviderError,
    classify_provider_failure,
    retry_async,
    transient_network_error,
)


class ElevenLabsTts:
    name = "elevenlabs-tts"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def synthesize(self, text: str) -> TtsResult:
        if not self._settings.elevenlabs_api_key:
            raise RecoverableProviderError(
                "tts",
                "invalid_api_key: ELEVENLABS_API_KEY missing (USE_MOCK_AUDIO=false)",
                provider=self.name,
            )

        started = time.perf_counter()
        voice_id = self._settings.elevenlabs_voice_id
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": self._settings.elevenlabs_api_key,
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": self._settings.elevenlabs_model_id,
        }
        params = {"output_format": self._settings.elevenlabs_output_format}

        async def _call() -> bytes:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        url,
                        headers=headers,
                        params=params,
                        json=payload,
                    )
                    response.raise_for_status()
                    return response.content
            except Exception as exc:  # noqa: BLE001
                raise transient_network_error("elevenlabs-tts", exc) from exc

        try:
            audio = await retry_async(
                _call,
                attempts=self._settings.retry_attempts,
                backoff_ms=self._settings.retry_backoff_ms,
            )
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("tts", self.name, exc) from exc

        elapsed = int((time.perf_counter() - started) * 1000)
        mime = (
            "audio/mpeg"
            if "mp3" in self._settings.elevenlabs_output_format
            else "audio/wav"
        )
        return TtsResult(
            audio_base64=base64.b64encode(audio).decode("ascii"),
            mime_type=mime,
            sample_rate=self._settings.tts_sample_rate,
            provider=self.name,
            duration_ms=elapsed,
            character_count=len(text),
        )
