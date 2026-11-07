"""Unit tests for allowlisted tools + Consenso-gated agent loop."""

from __future__ import annotations

import io
import json
import math
import struct
import wave

import pytest

from app.agent.tools import ToolRegistry, is_allowlisted_browser_url, known_tool_names
from app.config import Settings
from app.core.memory import AdaptiveMemory, infer_semantic_tag, normalize_semantic_tag
from app.services.agent_service import AgentService, _concise_spoken_summary
from app.services.consenso_alfa import ConsensoAlfa
from app.services.pipeline import AudioPipeline
from app.services.tts.mock import MockTts
from app.models.schemas import ToolInvocation


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


@pytest.fixture()
def settings(tmp_path) -> Settings:
    return Settings(
        use_mock_audio=True,
        memory_enabled=True,
        chroma_persist_dir=str(tmp_path / "chroma"),
        tts_audio_dir=str(tmp_path / "tts"),
        consenso_enabled=True,
    )


@pytest.mark.asyncio
async def test_tool_names_and_env_status(settings: Settings) -> None:
    assert "get_env_status" in known_tool_names()
    assert "get_system_metrics" in known_tool_names()
    assert "list_active_processes" in known_tool_names()
    assert "open_browser_url" in known_tool_names()
    registry = ToolRegistry(settings=settings)
    result = await registry.execute("get_env_status", {})
    assert result.ok
    assert "openai_api_key_configured" in result.output
    assert "sk-" not in result.output.lower()


@pytest.mark.asyncio
async def test_allowlist_blocks_unknown_command_structured(settings: Settings) -> None:
    registry = ToolRegistry(settings=settings)
    result = await registry.execute(
        "run_allowlisted_command",
        {"command_key": "rm_rf_root"},
    )
    assert result.ok is False
    assert result.meta.get("blocked") is True
    payload = json.loads(result.output)
    assert payload["error"] is True
    assert payload["code"] == "command_not_allowlisted"


@pytest.mark.asyncio
async def test_system_metrics_psutil(settings: Settings) -> None:
    pytest.importorskip("psutil")
    registry = ToolRegistry(settings=settings)
    result = await registry.execute("get_system_metrics", {})
    assert result.ok
    data = json.loads(result.output)
    assert "cpu_percent" in data
    assert "ram_percent" in data


@pytest.mark.asyncio
async def test_list_active_processes(settings: Settings) -> None:
    pytest.importorskip("psutil")
    registry = ToolRegistry(settings=settings)
    result = await registry.execute("list_active_processes", {"limit": 5})
    assert result.ok
    data = json.loads(result.output)
    assert "processes" in data
    assert data["count"] <= 5


@pytest.mark.asyncio
async def test_browser_url_allowlist() -> None:
    ok, _ = is_allowlisted_browser_url("https://www.google.com")
    assert ok is True
    bad, reason = is_allowlisted_browser_url("http://evil.example/hack")
    assert bad is False
    assert "https" in reason or "host" in reason
    bad2, _ = is_allowlisted_browser_url("https://evil.example.com")
    assert bad2 is False


@pytest.mark.asyncio
async def test_open_browser_blocked_by_consenso(settings: Settings) -> None:
    consenso = ConsensoAlfa(settings)
    decision = await consenso.validate_tool_call(
        tool_name="open_browser_url",
        arguments={"url": "https://evil.example.com"},
        user_transcript="abre este site",
    )
    assert decision.approved is False


@pytest.mark.asyncio
async def test_consenso_blocks_dangerous_tool(settings: Settings) -> None:
    consenso = ConsensoAlfa(settings)
    decision = await consenso.validate_tool_call(
        tool_name="run_allowlisted_command",
        arguments={"command_key": "python_version"},
        user_transcript="por favor formatar disco agora",
    )
    assert decision.approved is False
    assert "dangerous" in decision.reason


@pytest.mark.asyncio
async def test_consenso_allows_safe_env_tool(settings: Settings) -> None:
    consenso = ConsensoAlfa(settings)
    decision = await consenso.validate_tool_call(
        tool_name="get_env_status",
        arguments={},
        user_transcript="qual o status do ambiente",
    )
    assert decision.approved is True


@pytest.mark.asyncio
async def test_agent_service_mock_invokes_tool(settings: Settings) -> None:
    consenso = ConsensoAlfa(settings)
    service = AgentService(settings=settings, consenso=consenso)
    turn = await service.run(
        "mostra o status do ambiente por favor",
        client_id="hud-test",
        request_id="req-tools-1",
    )
    assert turn.tools
    assert turn.tools[0].name == "get_env_status"
    assert turn.tools[0].approved is True
    assert turn.tools[0].executed is True
    assert turn.text
    assert len(turn.text) <= 200


@pytest.mark.asyncio
async def test_agent_service_metrics_concise(settings: Settings) -> None:
    pytest.importorskip("psutil")
    consenso = ConsensoAlfa(settings)
    service = AgentService(settings=settings, consenso=consenso)
    turn = await service.run(
        "quanto de cpu e ram estou a usar",
        client_id="hud-test",
        request_id="req-metrics-1",
    )
    assert turn.tools
    assert turn.tools[0].name == "get_system_metrics"
    assert turn.tools[0].executed is True
    assert len(turn.text) <= 180


@pytest.mark.asyncio
async def test_agent_service_blocks_destructive_intent(settings: Settings) -> None:
    consenso = ConsensoAlfa(settings)
    service = AgentService(settings=settings, consenso=consenso)
    turn = await service.run(
        "apaga tudo e formatar disco",
        client_id="hud-test",
        request_id="req-block-1",
    )
    assert turn.tools
    assert turn.tools[0].approved is False
    assert turn.tools[0].executed is False
    assert "bloqueou" in turn.text.lower() or "não executo" in turn.text.lower()


@pytest.mark.asyncio
async def test_pipeline_returns_audio_and_tool_metadata(settings: Settings) -> None:
    class StatusStt:
        name = "status-stt"

        async def transcribe(self, audio_bytes: bytes, **kwargs: object):
            from app.models.schemas import SttResult

            _ = (audio_bytes, kwargs)
            return SttResult(
                text="qual o status do ambiente",
                language="pt",
                confidence=0.9,
                provider=self.name,
                duration_ms=5,
            )

    consenso = ConsensoAlfa(settings)
    pipeline = AudioPipeline(
        settings=settings,
        stt=StatusStt(),
        tts=MockTts(settings),
        consenso=consenso,
        agent_service=AgentService(settings=settings, consenso=consenso),
    )
    result = await pipeline.process(
        _tiny_wav(),
        filename="t.wav",
        content_type="audio/wav",
        client_id="pipeline-tools",
    )
    assert result.audio_base64
    assert result.response_text
    assert result.meta.tools_invoked is True
    assert result.meta.tools_executed_count >= 1
    assert result.tools
    assert result.tools[0].name == "get_env_status"


@pytest.mark.asyncio
async def test_memory_tags_persist_and_prompt(settings: Settings, tmp_path) -> None:
    memory = AdaptiveMemory(settings)
    if not memory.available:
        pytest.skip(f"chromadb unavailable: {memory.init_error}")

    assert normalize_semantic_tag("preferencia") == "preferência"
    assert infer_semantic_tag("todo dia acordo às 7") == "rotina"
    assert infer_semantic_tag("preciso fazer a tarefa de envio") == "tarefa"

    registry = ToolRegistry(settings=settings, memory=memory, project_root=tmp_path)
    written = await registry.execute(
        "memory_write_note",
        {
            "text": "Prefere respostas curtas no headset",
            "tag": "preferência",
            "key": "brevity",
            "client_id": "c1",
        },
    )
    assert written.ok
    meta = json.loads(written.output)
    assert meta["tag"] == "preferência"

    routine = await registry.execute(
        "memory_write_note",
        {
            "text": "Rotina: check Bluetooth de manhã",
            "tag": "rotina",
            "key": "morning",
            "client_id": "c1",
        },
    )
    assert routine.ok

    read = await registry.execute(
        "memory_read_notes",
        {"query": "respostas curtas", "client_id": "c1", "tag": "preferência"},
    )
    assert read.ok
    assert "curtas" in read.output.lower() or "prefer" in read.output.lower()

    hits = memory.search_context("headset curto", client_id="c1")
    prompt = memory.format_learned_preferences_prompt(hits)
    assert "Learned preferences" in prompt
    assert hits


def test_concise_spoken_summary_truncates() -> None:
    long = "A" * 50 + " " + "B" * 200
    tools = [
        ToolInvocation(
            name="get_system_metrics",
            arguments={},
            approved=True,
            executed=True,
        )
    ]
    out = _concise_spoken_summary(long, tools)
    assert len(out) <= 180
