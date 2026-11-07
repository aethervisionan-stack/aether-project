"""POST /api/cognitive/chat — mode flash|pro + Consenso unified payload."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import ConsensoResult
from app.services.gemini_gateway import (
    GeminiTurnResult,
    resolve_gemini_mode,
    resolve_gemini_model,
)


def test_resolve_gemini_mode_and_model() -> None:
    assert resolve_gemini_mode("flash") == "flash"
    assert resolve_gemini_mode("pro") == "pro"
    assert resolve_gemini_mode("gemini-2.5-pro") == "pro"
    assert resolve_gemini_model("flash") == "gemini-2.5-flash"
    assert resolve_gemini_model("pro") == "gemini-2.5-pro"


def test_cognitive_chat_missing_key_safe_fallback() -> None:
    with TestClient(app) as client:
        res = client.post(
            "/api/cognitive/chat",
            json={
                "query": "qual a arquitetura do Aether?",
                "history": [],
                "mode": "flash",
            },
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["status"] in ("ok", "fallback")
        assert "gemini_response" in body
        assert "consensus_confidence" in body
        assert body["mode"] == "flash"
        assert body["transcription"] == "qual a arquitetura do Aether?"
        # Without a real key we expect safe fallback
        assert body["used_safe_fallback"] is True or body["status"] == "fallback"


def test_cognitive_chat_mocked_gemini_ok() -> None:
    fake = GeminiTurnResult(
        text="Whisper → Gemini → Consenso → TTS.",
        duration_ms=12,
        provider="gemini-2.5-pro",
        mode="pro",
    )
    consenso = ConsensoResult(
        approved=True,
        agreement_ratio=0.9,
        final_text=fake.text,
        votes=[],
        duration_ms=5,
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
            "/cognitive/chat",
            json={
                "query": "explica o stack",
                "mode": "pro",
                "history": [
                    {"role": "user", "content": "olá"},
                    {"role": "model", "content": "Olá."},
                ],
            },
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["status"] == "ok"
        assert body["mode"] == "pro"
        assert body["model"] == "gemini-2.5-pro"
        assert body["gemini_response"] == fake.text
        assert body["consensus_confidence"] == pytest.approx(0.9)
        assert body["used_safe_fallback"] is False
