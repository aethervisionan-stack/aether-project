"""Real-provider mode: empty OPENAI_API_KEY must not silent-mock Whisper."""

from __future__ import annotations

import io
import math
import struct
import wave

import pytest

from app.config import Settings
from app.core.memory import AdaptiveMemory
from app.services.agent import ResponseAgent
from app.services.consenso_alfa import ConsensoAlfa
from app.services.pipeline import AudioPipeline
from app.services.stt.whisper import OpenAIWhisperStt
from app.services.tts.provider import OpenAITts


def _tiny_wav(seconds: float = 0.15, sample_rate: int = 16000) -> bytes:
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
async def test_empty_openai_key_safe_fallback_no_mock_transcript(tmp_path) -> None:
    settings = Settings(
        use_mock_audio=False,
        openai_api_key="",
        stt_provider="openai",
        tts_provider="openai",
        openai_tts_model="tts-1",
        memory_enabled=True,
        chroma_persist_dir=str(tmp_path / "chroma"),
        tts_audio_dir=str(tmp_path / "tts"),
    )
    memory = AdaptiveMemory(settings)
    pipeline = AudioPipeline(
        settings=settings,
        stt=OpenAIWhisperStt(settings),
        tts=OpenAITts(settings),
        consenso=ConsensoAlfa(settings),
        agent=ResponseAgent(settings),
        memory=memory,
    )
    result = await pipeline.process(
        _tiny_wav(),
        filename="t.wav",
        content_type="audio/wav",
        client_id="test-client",
    )
    assert result.meta.used_safe_fallback is True
    assert result.transcript == ""
    assert result.audio_base64
    assert "missing_openai" in " ".join(result.consenso.hallucination_flags) or (
        result.meta.fallback_reason and "OPENAI_API_KEY" in result.meta.fallback_reason
    )


@pytest.mark.asyncio
async def test_memory_roundtrip(tmp_path) -> None:
    settings = Settings(
        chroma_persist_dir=str(tmp_path / "chroma"),
        memory_enabled=True,
    )
    memory = AdaptiveMemory(settings)
    if not memory.available:
        pytest.skip(f"chromadb unavailable: {memory.init_error}")
    memory.remember_preference("Prefere respostas curtas.", client_id="dna-1", key="brevity")
    memory.remember_interaction(
        transcript="olá aether",
        response="Olá! Em que posso ajudar?",
        client_id="dna-1",
        request_id="req-1",
    )
    hits = memory.search_context("olá", client_id="dna-1")
    assert hits
    block = memory.format_context_block(hits)
    assert "Client DNA" in block or "past_interactions" in block or "user_preferences" in block
