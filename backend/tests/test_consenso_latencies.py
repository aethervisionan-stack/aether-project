"""Consenso Alfa per-agent latency must appear in logs payload + response."""

from __future__ import annotations

import io
import math
import struct
import wave

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


def test_process_audio_includes_consenso_agent_latencies() -> None:
    client = TestClient(app)
    res = client.post(
        "/process-audio",
        files={"audio": ("headset.wav", _tiny_wav(), "audio/wav")},
        data={"locale": "pt-BR"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    latencies = body["consenso"]["agent_latencies"]
    assert len(latencies) >= 3
    roles = {a["agent_role"] for a in latencies}
    assert "factual_grounding" in roles
    assert "safety_tone" in roles
    assert "consistency" in roles
    for item in latencies:
        assert item["duration_ms"] >= 0
        assert item["label"]

    latency = body["latency"]
    assert "consenso_grounding_ms" in latency
    assert "consenso_safety_tone_ms" in latency
    assert "consenso_consistency_ms" in latency
    assert latency["consenso_agents_ms"]["factual_grounding"] >= 0
