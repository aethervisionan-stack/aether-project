"""USE_MOCK_AUDIO switching and recoverable provider fallbacks."""

from __future__ import annotations

import io
import math
import struct
import wave

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.models.schemas import SttResult, TtsResult
from app.services.agent_service import AgentService
from app.services.consenso_alfa import ConsensoAlfa
from app.services.pipeline import AudioPipeline
from app.services.resilience import RecoverableProviderError
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


def test_use_mock_audio_true_forces_mock_providers() -> None:
    s = Settings(use_mock_audio=True, stt_provider="gemini", tts_provider="gemini")
    assert s.effective_stt_provider() == "mock"
    assert s.effective_tts_provider() == "mock"


def test_use_mock_audio_false_defaults_to_gemini() -> None:
    s = Settings(use_mock_audio=False, stt_provider="mock", tts_provider="mock")
    assert s.effective_stt_provider() == "gemini"
    assert s.effective_tts_provider() == "gemini"

    s2 = Settings(
        use_mock_audio=False,
        stt_provider="gemini",
        tts_provider="gemini",
    )
    assert s2.effective_stt_provider() == "gemini"
    assert s2.effective_tts_provider() == "gemini"


class BoomStt:
    name = "boom-stt"

    async def transcribe(self, audio_bytes: bytes, **kwargs: object) -> SttResult:
        _ = (audio_bytes, kwargs)
        raise RecoverableProviderError(
            "stt",
            "quota_exhausted: 429 insufficient_quota",
            provider=self.name,
        )


class BoomTts:
    name = "boom-tts"

    async def synthesize(self, text: str) -> TtsResult:
        _ = text
        raise RecoverableProviderError(
            "tts",
            "invalid_api_key: 401 unauthorized",
            provider=self.name,
        )


@pytest.mark.asyncio
async def test_stt_failure_returns_safe_spoken_fallback() -> None:
    settings = Settings(use_mock_audio=False, gemini_api_key="")
    consenso = ConsensoAlfa(settings)
    pipeline = AudioPipeline(
        settings=settings,
        stt=BoomStt(),
        tts=MockTts(settings),
        consenso=consenso,
        agent_service=AgentService(settings=settings, consenso=consenso),
    )
    result = await pipeline.process(
        _tiny_wav(),
        filename="t.wav",
        content_type="audio/wav",
    )
    assert result.meta.used_safe_fallback is True
    assert result.audio_base64
    assert "modo seguro" in result.response_text.lower() or "serviço de voz" in result.response_text.lower()


@pytest.mark.asyncio
async def test_tts_failure_falls_back_to_mock_audio() -> None:
    settings = Settings(use_mock_audio=True)
    from app.services.stt.mock import MockWhisperStt

    consenso = ConsensoAlfa(settings)
    pipeline = AudioPipeline(
        settings=settings,
        stt=MockWhisperStt(settings),
        tts=BoomTts(),
        consenso=consenso,
        agent_service=AgentService(settings=settings, consenso=consenso),
    )
    result = await pipeline.process(
        _tiny_wav(),
        filename="t.wav",
        content_type="audio/wav",
    )
    assert result.meta.used_safe_fallback is True
    assert result.audio_base64
    assert result.meta.tts_provider == "mock-tts"


def test_health_exposes_use_mock_audio() -> None:
    from app.main import app

    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert "use_mock_audio" in body
    assert body["stt_provider"] == "mock"
    assert "gemini_api_key_configured" in body
    assert "has_valid_gemini_key" in body
    assert "openai_api_key_configured" not in body
    assert body["cognitive_provider"] == "gemini"
    assert body.get("api_port") == 8001
    assert str(body.get("env_file", "")).replace("\\", "/").endswith("backend/.env")
