"""Gemini Function Calling against local SQLite (aether_vision.db)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.db.session import init_db, reset_db_caches
from app.db.store import consolidated_metrics, list_context_notes, store_context_note
from app.main import app
from app.models.schemas import ConsensoResult
from app.services.gemini_gateway import GeminiGateway, GeminiTurnResult
from app.services.gemini_tools import (
    ALLOWED_TOOL_NAMES,
    execute_gemini_tool,
    extract_function_calls,
    gemini_function_declarations,
    invocation_from_handler,
)
from app.config import Settings


@pytest.fixture()
def mem_db(tmp_path):
    reset_db_caches()
    url = f"sqlite:///{(tmp_path / 'fc.db').as_posix()}"
    init_db(url)
    yield url
    reset_db_caches()


def test_function_declarations_cover_sqlite_tools() -> None:
    names = {d["name"] for d in gemini_function_declarations()}
    assert names == set(ALLOWED_TOOL_NAMES)


def test_execute_query_metrics_and_store_note(mem_db: str) -> None:
    metrics = execute_gemini_tool("query_metrics", {}, sqlite_url=mem_db)
    assert metrics.ok is True
    assert "metrics" in metrics.payload
    assert metrics.payload["metrics"]["session_count"] == 0

    stored = execute_gemini_tool(
        "store_context_note",
        {"content": "Prefere respostas curtas no headset", "tag": "preferência"},
        client_id="hud-fc",
        request_id="req-1",
        sqlite_url=mem_db,
    )
    assert stored.ok is True
    assert stored.payload.get("id")

    listed = execute_gemini_tool(
        "list_context_notes",
        {"client_id": "hud-fc", "limit": 5},
        sqlite_url=mem_db,
    )
    assert listed.ok is True
    assert listed.payload["count"] >= 1
    assert "curtas" in listed.payload["notes"][0]["content"].lower()

    # Direct store helpers stay consistent
    again = store_context_note(
        content="Rotina Bluetooth de manhã",
        tag="rotina",
        client_id="hud-fc",
        sqlite_url=mem_db,
    )
    assert again["ok"] is True
    notes = list_context_notes(client_id="hud-fc", sqlite_url=mem_db)
    assert len(notes) >= 2
    assert consolidated_metrics(sqlite_url=mem_db)["session_count"] == 0


def test_execute_unknown_and_secret_refusal(mem_db: str) -> None:
    bad = execute_gemini_tool("drop_database", {}, sqlite_url=mem_db)
    assert bad.ok is False
    assert bad.payload["error"] == "unknown_tool"

    refused = execute_gemini_tool(
        "store_context_note",
        {"content": "aqui vai minha api_key secreta xyz"},
        sqlite_url=mem_db,
    )
    assert refused.ok is False
    assert refused.payload["error"] == "refused_possible_secret"


def test_extract_function_calls_from_response_attr() -> None:
    fc = SimpleNamespace(name="query_metrics", args={}, id="fc1")
    response = SimpleNamespace(function_calls=[fc], candidates=[])
    calls = extract_function_calls(response)
    assert calls == [("query_metrics", {}, fc)]


def test_invocation_telemetry() -> None:
    result = execute_gemini_tool("query_metrics", {})
    inv = invocation_from_handler("query_metrics", {}, result)
    assert inv.name == "query_metrics"
    assert inv.approved is True
    assert inv.result_preview


@pytest.mark.asyncio
async def test_gateway_fc_loop_executes_sqlite(mem_db: str) -> None:
    """Simulate model function_call → local SQLite → final text (no live API)."""
    settings = Settings(
        gemini_api_key="AIzaSyDummyKeyValue1234567890ABCD",
        use_mock_audio=True,
    )
    gateway = GeminiGateway(settings)

    fc = SimpleNamespace(name="query_metrics", args={}, id="call-1")
    model_content = SimpleNamespace(
        role="model",
        parts=[SimpleNamespace(function_call=fc, text=None)],
    )
    first = SimpleNamespace(
        function_calls=[fc],
        candidates=[SimpleNamespace(content=model_content)],
        text=None,
    )
    second = SimpleNamespace(
        function_calls=[],
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(
                    parts=[SimpleNamespace(text="Latência média está estável.", function_call=None)]
                )
            )
        ],
        text="Latência média está estável.",
    )

    mock_models = MagicMock()
    mock_models.generate_content = AsyncMock(side_effect=[first, second])
    mock_aio = MagicMock()
    mock_aio.models = mock_models
    mock_aio.aclose = AsyncMock()
    mock_client = MagicMock()
    mock_client.aio = mock_aio

    with patch("google.genai.Client", return_value=mock_client):
        turn = await gateway.chat(
            query="quais as métricas de latência?",
            mode="flash",
            enable_tools=True,
            client_id="fc-test",
            request_id="req-fc",
            sqlite_url=mem_db,
        )

    assert "estável" in turn.text.lower() or "latência" in turn.text.lower()
    assert turn.tools
    assert turn.tools[0].name == "query_metrics"
    assert turn.tools[0].executed is True
    assert mock_models.generate_content.await_count == 2


def test_cognitive_chat_surfaces_tools_from_gateway(mem_db: str) -> None:
    fake = GeminiTurnResult(
        text="Guardei a nota de preferência.",
        duration_ms=20,
        provider="gemini-2.5-flash",
        mode="flash",
        tools=[
            invocation_from_handler(
                "store_context_note",
                {"content": "curto", "tag": "preferência"},
                execute_gemini_tool(
                    "store_context_note",
                    {"content": "Prefere respostas curtas", "tag": "preferência"},
                    client_id="api-fc",
                    sqlite_url=mem_db,
                ),
            )
        ],
    )
    consenso = ConsensoResult(
        approved=True,
        agreement_ratio=1.0,
        final_text=fake.text,
        votes=[],
        duration_ms=3,
    )
    with (
        patch(
            "app.routers.cognitive.GeminiGateway.chat",
            new=AsyncMock(return_value=fake),
        ),
        patch(
            "app.routers.cognitive.ConsensoAlfa.validate",
            new=AsyncMock(return_value=consenso),
        ),
        TestClient(app) as client,
    ):
        res = client.post(
            "/api/cognitive/chat",
            json={
                "query": "salva que prefiro respostas curtas",
                "mode": "flash",
                "client_id": "api-fc",
            },
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ok"
    assert body["tools_executed_count"] >= 1
    assert body["tools"][0]["name"] == "store_context_note"
    assert body["gemini_response"] == fake.text
