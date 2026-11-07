"""Real-provider mode: empty GEMINI_API_KEY must not silent-mock STT."""

from __future__ import annotations

import io
import math
import struct
import wave

import pytest

from app.config import Settings
from app.services.consenso_alfa import ConsensoAlfa
from app.services.pipeline import AudioPipeline
from app.services.stt.gemini import GeminiStt
from app.services.tts.gemini import GeminiTts
from app.services.tts.mock import MockTts


def _tiny_wav(seconds: float = 0.2, sample_rate: int = 16000) -> bytes:
    n = int(sample_rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n):
            sample = int(8000 * math.sin(2 * math.pi * 440 * i / sample_rate))
            frames.extend(struct.pack("<h", sample))
        wf.writeframes(bytes(frames))
    return buf.getvalue()


@pytest.mark.asyncio
async def test_empty_gemini_key_safe_fallback_no_mock_transcript(tmp_path) -> None:
    settings = Settings(
        use_mock_audio=False,
        gemini_api_key="",
        stt_provider="gemini",
        tts_provider="gemini",
        gemini_tts_model="gemini-2.5-flash-preview-tts",
        gemini_tts_voice="Kore",
        tts_audio_dir=str(tmp_path / "tts"),
        memory_enabled=False,
        consenso_enabled=True,
    )
    pipeline = AudioPipeline(
        settings=settings,
        stt=GeminiStt(settings),
        tts=GeminiTts(settings),
        consenso=ConsensoAlfa(settings),
    )
    result = await pipeline.process(
        _tiny_wav(),
        filename="t.wav",
        content_type="audio/wav",
        client_id="gemini-fallback",
    )
    assert result.meta.used_safe_fallback is True
    assert result.transcript == ""
    assert "missing_gemini" in " ".join(result.consenso.hallucination_flags) or (
        result.meta.fallback_reason and "GEMINI_API_KEY" in result.meta.fallback_reason
    )
    assert result.audio_base64  # mock WAV fallback still speaks safe text
    assert result.meta.cognitive_provider == "gemini"


@pytest.mark.asyncio
async def test_gemini_tts_missing_key_raises_recoverable(tmp_path) -> None:
    from app.services.resilience import RecoverableProviderError

    settings = Settings(
        gemini_api_key="",
        tts_audio_dir=str(tmp_path / "tts"),
    )
    tts = GeminiTts(settings)
    with pytest.raises(RecoverableProviderError):
        await tts.synthesize("olá")
    # Local mock still works without keys
    mock = MockTts(settings)
    out = await mock.synthesize("olá")
    assert out.audio_base64
    assert out.provider == "mock-tts"
