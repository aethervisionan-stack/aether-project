"""Smoke POST /process-audio against a running local server."""

from __future__ import annotations

import io
import json
import math
import struct
import wave
from pathlib import Path

import httpx


def tiny_wav(seconds: float = 0.2, sample_rate: int = 16000) -> bytes:
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


def main() -> None:
    audio = tiny_wav()
    with httpx.Client(timeout=60.0) as client:
        health = client.get("http://127.0.0.1:8000/health")
        print("health", health.json())
        res = client.post(
            "http://127.0.0.1:8000/process-audio",
            files={"audio": ("tone.wav", audio, "audio/wav")},
            data={"locale": "pt-BR", "client_id": "smoke"},
        )
        print("status", res.status_code)
        body = res.json()
        summary = {
            "transcript": body.get("transcript"),
            "response_text": body.get("response_text"),
            "audio_mime_type": body.get("audio_mime_type"),
            "audio_url": body.get("audio_url"),
            "meta": body.get("meta"),
            "hallucination_flags": body.get("consenso", {}).get("hallucination_flags"),
            "audio_b64_len": len(body.get("audio_base64") or ""),
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        out = Path("data/smoke_last.json")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
