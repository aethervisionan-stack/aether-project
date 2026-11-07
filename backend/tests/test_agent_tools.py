"""Unit tests for allowlisted tools + Consenso-gated agent loop."""

from __future__ import annotations

import io
import math
import struct
import wave

import pytest

from app.agent.tools import ToolRegistry, known_tool_names
from app.config import Settings
from app.services.agent_service import AgentService
from app.services.consenso_alfa import ConsensoAlfa
from app.services.pipeline import AudioPipeline
from app.services.stt.mock import MockWhisperStt
from app.services.tts.mock import MockTts


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
    assert "run_allowlisted_command" in known_tool_names()
    registry = ToolRegistry(settings=settings)
    result = await registry.execute("get_env_status", {})
    assert result.ok
    assert "openai_api_key_configured" in result.output
    assert "sk-" not in result.output.lower()


@pytest.mark.asyncio
async def test_allowlist_blocks_unknown_command(settings: Settings) -> None:
    registry = ToolRegistry(settings=settings)
    result = await registry.execute(
        "run_allowlisted_command",
        {"command_key": "rm_rf_root"},
    )
    assert result.ok is False
    assert result.meta.get("blocked") is True


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
    # Force mock STT to emit a status request so AgentService mock path fires a tool.
    class StatusStt:
        name = "status-stt"

        async def transcribe(self, audio_bytes: bytes, **kwargs: object):
            from app.models.schemas import SttResult

            _ = (audio_bytes, kwargs)
            return SttResult(
                text="qual o status do sistema",
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
async def test_memory_write_and_read_tool(settings: Settings, tmp_path) -> None:
    from app.core.memory import AdaptiveMemory

    memory = AdaptiveMemory(settings)
    if not memory.available:
        pytest.skip(f"chromadb unavailable: {memory.init_error}")
    registry = ToolRegistry(settings=settings, memory=memory, project_root=tmp_path)
    # list dirs against tmp project root (empty ok)
    listed = await registry.execute("list_project_dirs", {"relative_path": "."})
    assert listed.ok
    written = await registry.execute(
        "memory_write_note",
        {"text": "Prefere respostas curtas", "key": "brevity", "client_id": "c1"},
    )
    assert written.ok
    read = await registry.execute(
        "memory_read_notes",
        {"query": "respostas curtas", "client_id": "c1"},
    )
    assert read.ok
    assert "curtas" in read.output.lower() or "prefer" in read.output.lower()
