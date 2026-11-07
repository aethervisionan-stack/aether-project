"""Synthetic WAV TTS for local tests without paid TTS APIs."""

from __future__ import annotations

import asyncio
import base64
import io
import math
import struct
import time
import wave

from app.config import Settings
from app.models.schemas import TtsResult


def _tone_wav(
    text: str,
    *,
    sample_rate: int,
    seconds: float = 0.55,
) -> bytes:
    """Generate a short clean mono WAV tone modulated by text length."""
    frequency = 420.0 + min(180.0, len(text) * 1.5)
    n_samples = int(sample_rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n_samples):
            # Soft attack/release envelope for headphone comfort.
            t = i / sample_rate
            env = min(1.0, t * 12.0) * min(1.0, (seconds - t) * 12.0)
            sample = int(16000 * env * math.sin(2.0 * math.pi * frequency * t))
            frames.extend(struct.pack("<h", sample))
        wf.writeframes(bytes(frames))
    return buf.getvalue()


class MockTts:
    name = "mock-tts"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def synthesize(self, text: str) -> TtsResult:
        started = time.perf_counter()
        await asyncio.sleep(0.03)
        audio = _tone_wav(text, sample_rate=self._settings.tts_sample_rate)
        elapsed = int((time.perf_counter() - started) * 1000)
        return TtsResult(
            audio_base64=base64.b64encode(audio).decode("ascii"),
            mime_type="audio/wav",
            sample_rate=self._settings.tts_sample_rate,
            provider=self.name,
            duration_ms=elapsed,
            character_count=len(text),
        )
