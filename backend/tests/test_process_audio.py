"""Smoke tests for the mock pipeline (no heavy models)."""

from __future__ import annotations

import io
import math
import struct
import wave

import pytest
from fastapi.testclient import TestClient

from app.main import app


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


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["pipeline_mode"] == "mock"
    assert body["consenso_enabled"] is True
    assert "openai_api_key_configured" in body
    assert "has_valid_openai_key" in body
    assert isinstance(body["has_valid_openai_key"], bool)
    assert "gemini_api_key_configured" in body
    assert "has_valid_gemini_key" in body
    assert "cognitive_provider" in body
    assert body["api_port"] == 8000
    assert "env_file" in body
    assert body["env_file"].replace("\\", "/").endswith("backend/.env")


def test_process_audio_mock(client: TestClient) -> None:
    audio = _tiny_wav()
    res = client.post(
        "/process-audio",
        files={"audio": ("headset.wav", audio, "audio/wav")},
        data={"locale": "pt-BR"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["transcript"]
    assert body["response_text"]
    assert body["audio_base64"]
    assert body["audio_mime_type"] == "audio/wav"
    assert "consenso" in body
    assert isinstance(body["consenso"]["votes"], list)
    assert body["latency"]["total_ms"] >= 0
    assert body["meta"]["request_id"]


def test_process_audio_empty(client: TestClient) -> None:
    res = client.post(
        "/process-audio",
        files={"audio": ("empty.wav", b"", "audio/wav")},
    )
    assert res.status_code == 400
    body = res.json()
    assert body["retryable"] is False
