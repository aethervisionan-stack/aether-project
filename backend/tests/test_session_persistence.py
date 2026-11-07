"""Unit tests for SQLite SessionLogs + AuditTrail and history endpoints."""

from __future__ import annotations

import io
import math
import struct
import wave
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import AuditTrail, SessionLog
from app.db.session import get_session_factory, init_db, reset_db_caches
from app.db.store import consolidated_metrics, list_recent_sessions, persist_process_audio
from app.main import app
from app.models.schemas import (
    ConsensoResult,
    LatencyBreakdown,
    ProcessAudioMeta,
    ProcessAudioResponse,
    ToolInvocation,
)


def _tiny_wav(seconds: float = 0.15, sample_rate: int = 16000) -> bytes:
    n = int(sample_rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n):
            sample = int(6000 * math.sin(2 * math.pi * 440 * i / sample_rate))
            frames.extend(struct.pack("<h", sample))
        wf.writeframes(bytes(frames))
    return buf.getvalue()


def _sample_response(
    *,
    request_id: str = "req-test-1",
    tools: list[ToolInvocation] | None = None,
) -> ProcessAudioResponse:
    tool_list = tools or [
        ToolInvocation(
            name="get_system_metrics",
            arguments={},
            approved=True,
            executed=True,
            result_preview="cpu=12%",
            duration_ms=5,
        ),
        ToolInvocation(
            name="run_allowlisted_command",
            arguments={"command_key": "rm_rf_root"},
            approved=False,
            executed=False,
            blocked_reason="dangerous_intent",
            duration_ms=2,
        ),
    ]
    return ProcessAudioResponse(
        transcript="qual o status da cpu",
        response_text="CPU em 12%.",
        consenso=ConsensoResult(
            approved=True,
            agreement_ratio=0.9,
            final_text="CPU em 12%.",
            votes=[],
            duration_ms=12,
        ),
        audio_base64="AAAA",
        audio_mime_type="audio/wav",
        tools=tool_list,
        latency=LatencyBreakdown(
            stt_ms=10,
            agent_ms=20,
            consenso_ms=12,
            tts_ms=30,
            total_ms=72,
        ),
        meta=ProcessAudioMeta(
            request_id=request_id,
            pipeline_mode="mock",
            use_mock_audio=True,
            stt_provider="mock",
            tts_provider="mock",
            consenso_enabled=True,
            tools_invoked=True,
            tools_executed_count=1,
        ),
    )


@pytest.fixture()
def memory_db(tmp_path, monkeypatch: pytest.MonkeyPatch) -> str:
    """Isolated on-disk SQLite URL for store-level tests."""
    db_path = tmp_path / "unit_aether_vision.db"
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    from app.config import get_settings

    get_settings.cache_clear()
    reset_db_caches()
    url = f"sqlite:///{db_path.as_posix()}"
    init_db(url)
    yield url
    reset_db_caches()
    get_settings.cache_clear()


@pytest.fixture()
def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "http_aether_vision.db"
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    from app.config import get_settings
    from app.deps import get_pipeline

    get_settings.cache_clear()
    get_pipeline.cache_clear()
    reset_db_caches()
    init_db()
    with TestClient(app) as test_client:
        yield test_client
    reset_db_caches()
    get_settings.cache_clear()
    get_pipeline.cache_clear()


def test_sqlite_write_session_and_audit(memory_db: str) -> None:
    response = _sample_response(request_id="persist-1")
    row_id = persist_process_audio(response, client_id="hud-1", sqlite_url=memory_db)
    assert row_id is not None

    factory = get_session_factory(memory_db)
    with factory() as session:
        log = session.get(SessionLog, row_id)
        assert log is not None
        assert log.transcription == "qual o status da cpu"
        assert log.agent_response == "CPU em 12%."
        assert log.consensus_score == pytest.approx(0.9)
        assert log.latency_stt_ms == 10
        assert log.latency_agent_ms == 20
        assert log.latency_consenso_ms == 12
        assert log.latency_tts_ms == 30
        assert isinstance(log.tools_invoked, list)
        assert len(log.tools_invoked) == 2
        assert log.timestamp.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc)

        audits = session.scalars(
            select(AuditTrail).where(AuditTrail.request_id == "persist-1")
        ).all()
        assert len(audits) == 2
        decisions = {a.tool_name: a.decision for a in audits}
        assert decisions["get_system_metrics"] == "approve"
        assert decisions["run_allowlisted_command"] == "reject"


def test_list_recent_and_metrics(memory_db: str) -> None:
    persist_process_audio(_sample_response(request_id="m-1"), client_id="a", sqlite_url=memory_db)
    persist_process_audio(_sample_response(request_id="m-2"), client_id="b", sqlite_url=memory_db)

    items = list_recent_sessions(limit=10, sqlite_url=memory_db)
    assert len(items) == 2
    assert items[0]["request_id"] in {"m-1", "m-2"}
    assert "latency_ms" in items[0]
    assert items[0]["latency_ms"]["stt"] == 10

    filtered = list_recent_sessions(limit=10, client_id="a", sqlite_url=memory_db)
    assert len(filtered) == 1
    assert filtered[0]["client_id"] == "a"

    metrics = consolidated_metrics(sqlite_url=memory_db)
    assert metrics["session_count"] == 2
    assert metrics["latency_ms"]["avg_stt"] == pytest.approx(10.0)
    assert metrics["consensus"]["avg_score"] == pytest.approx(0.9)
    assert metrics["audit"]["approve"] == 2
    assert metrics["audit"]["reject"] == 2
    assert metrics["tokens"]["tracked"] is False


def test_history_and_metrics_endpoints(client: TestClient) -> None:
    wav = _tiny_wav()
    res = client.post(
        "/process-audio",
        files={"audio": ("t.wav", wav, "audio/wav")},
        data={"locale": "pt-BR", "client_id": "history-test"},
    )
    assert res.status_code == 200

    hist = client.get("/api/history", params={"limit": 20, "client_id": "history-test"})
    assert hist.status_code == 200
    body = hist.json()
    assert body["count"] >= 1
    assert body["items"][0]["client_id"] == "history-test"
    assert "transcription" in body["items"][0]
    assert "latency_ms" in body["items"][0]

    hist2 = client.get("/history", params={"limit": 5})
    assert hist2.status_code == 200

    metrics = client.get("/api/metrics")
    assert metrics.status_code == 200
    m = metrics.json()
    assert m["session_count"] >= 1
    assert "latency_ms" in m
    assert "tokens" in m

    metrics2 = client.get("/metrics")
    assert metrics2.status_code == 200
