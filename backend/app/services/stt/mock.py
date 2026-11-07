"""Mock Whisper STT for local Bluetooth UI tests without heavy models."""

from __future__ import annotations

import asyncio
import time

from app.config import Settings
from app.models.schemas import SttResult


class MockWhisperStt:
    """Deterministic STT used when PIPELINE_MODE=mock or STT_PROVIDER=mock."""

    name = "mock-whisper"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: str,
        language: str | None = None,
    ) -> SttResult:
        started = time.perf_counter()
        # Simulate a light network/CPU hop so the client can exercise latency UI.
        await asyncio.sleep(0.04)

        size = len(audio_bytes)
        if size < 256:
            text = ""
        else:
            lang = language or self._settings.whisper_language
            text = (
                "Olá Aether Vision, confirme o status do assistente de voz "
                f"para o headset Bluetooth ({lang})."
            )

        elapsed = int((time.perf_counter() - started) * 1000)
        return SttResult(
            text=text,
            language=language or self._settings.whisper_language,
            confidence=0.92 if text else 0.0,
            provider=self.name,
            duration_ms=elapsed,
            raw={
                "filename": filename,
                "content_type": content_type,
                "bytes": size,
                "mode": "mock",
            },
        )
