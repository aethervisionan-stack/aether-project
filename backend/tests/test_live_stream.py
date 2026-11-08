"""WebSocket /ws/live — route wiring + protocol framing (mocked Gemini Live)."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from google.genai import types

from app.config import Settings
from app.main import app
from app.routes import live_stream
from app.services import gemini_live as live_svc


@dataclass
class FakeServerContent:
    interrupted: bool = False
    turn_complete: bool = False
    generation_complete: bool = False
    input_transcription: Any = None
    output_transcription: Any = None


@dataclass
class FakeLiveMessage:
    server_content: FakeServerContent | None = None
    _data: bytes | None = None
    _text: str | None = None

    @property
    def data(self) -> bytes | None:
        return self._data

    @property
    def text(self) -> str | None:
        return self._text


class FakeLiveSession:
    """Minimal AsyncSession stand-in for uplink/downlink framing tests."""

    def __init__(self) -> None:
        self.sent_audio: list[bytes] = []
        self.sent_controls: list[dict[str, Any]] = []
        self.closed = False
        self._activity_starts = 0
        self._queue: asyncio.Queue[FakeLiveMessage | None] = asyncio.Queue()

    def enqueue(self, *messages: FakeLiveMessage) -> None:
        for msg in messages:
            self._queue.put_nowait(msg)

    async def send_realtime_input(self, **kwargs: Any) -> None:
        if "audio" in kwargs:
            blob = kwargs["audio"]
            data = getattr(blob, "data", None)
            if data is None and isinstance(blob, dict):
                data = blob.get("data")
            if isinstance(data, (bytes, bytearray)):
                self.sent_audio.append(bytes(data))
            self.sent_controls.append({"audio": True})
            return
        if "activity_start" in kwargs:
            self._activity_starts += 1
            self.sent_controls.append({"activity_start": True})
            return
        if "audio_stream_end" in kwargs:
            self.sent_controls.append({"audio_stream_end": True})
            return
        self.sent_controls.append(dict(kwargs))

    async def receive(self) -> AsyncIterator[FakeLiveMessage]:
        # Mirrors SDK: yield until turn_complete, then return (caller loops).
        while True:
            msg = await self._queue.get()
            if msg is None:
                return
            yield msg
            if msg.server_content and msg.server_content.turn_complete:
                return

    async def close(self) -> None:
        self.closed = True
        self._queue.put_nowait(None)

@pytest.fixture(autouse=True)
def _restore_live_factory() -> Any:
    previous = live_stream.get_live_session_factory()
    yield
    live_stream.set_live_session_factory(previous)


def test_build_live_connect_config_audio_only() -> None:
    cfg = live_svc.build_live_connect_config(types)
    assert cfg.response_modalities == [types.Modality.AUDIO]
    assert live_svc.GEMINI_LIVE_MODEL == "gemini-2.5-flash"
    instruction = live_svc.live_system_instruction()
    assert "Aether Vision" in instruction
    assert "TTS" in instruction or "voz" in instruction.lower()


def test_live_ws_listed_on_root() -> None:
    with TestClient(app) as client:
        res = client.get("/")
        assert res.status_code == 200
        body = res.json()
        assert "live_ws" in body
        assert "/ws/live" in body["live_ws"]


def test_live_ws_missing_key_sends_error_json() -> None:
    """Without injectable factory, missing key closes with structured error."""

    @asynccontextmanager
    async def boom(_settings: Settings) -> AsyncIterator[Any]:
        raise RuntimeError("missing_gemini_api_key")
        yield  # pragma: no cover

    live_stream.set_live_session_factory(boom)
    with TestClient(app) as client:
        with client.websocket_connect("/ws/live") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "error"
            assert msg["code"] == "missing_gemini_api_key"


def test_live_ws_ready_and_pcm_roundtrip() -> None:
    session = FakeLiveSession()
    # Gemini replies with 24 kHz PCM after we send uplink audio
    reply_pcm = b"\x01\x00\x02\x00\x03\x00\x04\x00"
    session.enqueue(
        FakeLiveMessage(
            _data=reply_pcm,
            server_content=FakeServerContent(turn_complete=False),
        ),
        FakeLiveMessage(
            server_content=FakeServerContent(turn_complete=True),
        ),
    )

    @asynccontextmanager
    async def factory(_settings: Settings) -> AsyncIterator[FakeLiveSession]:
        yield session

    live_stream.set_live_session_factory(factory)

    with TestClient(app) as client:
        with client.websocket_connect("/ws/live") as ws:
            ready = ws.receive_json()
            assert ready["type"] == "ready"
            assert ready["model"] == "gemini-2.5-flash"
            assert ready["input_rate"] == 16_000
            assert ready["output_rate"] == 24_000
            assert ready["response_modality"] == "AUDIO"

            uplink = b"\x10\x00\x20\x00"
            ws.send_bytes(uplink)

            # Downlink: binary PCM then turn_complete JSON
            binary = ws.receive_bytes()
            assert binary == reply_pcm
            done = ws.receive_json()
            assert done["type"] == "turn_complete"

            ws.send_text(json.dumps({"type": "close"}))

    assert session.sent_audio == [uplink]
    assert session.closed is True


def test_live_ws_interrupt_control_and_ping() -> None:
    session = FakeLiveSession()
    # Do not enqueue Gemini turns — avoids racing control replies with downlink.

    @asynccontextmanager
    async def factory(_settings: Settings) -> AsyncIterator[FakeLiveSession]:
        yield session

    live_stream.set_live_session_factory(factory)

    with TestClient(app) as client:
        with client.websocket_connect("/ws/live") as ws:
            assert ws.receive_json()["type"] == "ready"

            ws.send_text(json.dumps({"type": "ping"}))
            assert ws.receive_json()["type"] == "pong"

            ws.send_text(json.dumps({"type": "interrupt"}))
            interrupted = ws.receive_json()
            assert interrupted["type"] == "interrupted"
            assert session._activity_starts == 1

            ws.send_text(json.dumps({"type": "audio_stream_end"}))
            ws.send_text(json.dumps({"type": "close"}))

    assert any(c.get("audio_stream_end") for c in session.sent_controls)


def test_live_ws_forwards_gemini_interrupted_flag() -> None:
    session = FakeLiveSession()
    session.enqueue(
        FakeLiveMessage(
            server_content=FakeServerContent(interrupted=True, turn_complete=True),
        ),
    )

    @asynccontextmanager
    async def factory(_settings: Settings) -> AsyncIterator[FakeLiveSession]:
        yield session

    live_stream.set_live_session_factory(factory)

    with TestClient(app) as client:
        with client.websocket_connect("/ws/live") as ws:
            assert ws.receive_json()["type"] == "ready"
            # Downlink may emit interrupted then turn_complete (order preserved)
            first = ws.receive_json()
            second = ws.receive_json()
            types_seen = {first["type"], second["type"]}
            assert "interrupted" in types_seen
            assert "turn_complete" in types_seen
            ws.send_text(json.dumps({"type": "close"}))


def test_extract_helpers() -> None:
    msg = MagicMock()
    msg.data = b"\x00\x01"
    msg.server_content.interrupted = True
    msg.server_content.turn_complete = False
    msg.server_content.generation_complete = False
    msg.server_content.input_transcription = None
    msg.server_content.output_transcription = None
    assert live_svc.extract_audio_bytes(msg) == b"\x00\x01"
    flags = live_svc.extract_server_flags(msg)
    assert flags["interrupted"] is True
    assert flags["turn_complete"] is False
