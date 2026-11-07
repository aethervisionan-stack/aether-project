"""Gemini cognitive engine — unit tests (no live API key required)."""

from __future__ import annotations

import pytest

from app.config import Settings
from app.core.config import is_valid_gemini_api_key
from app.services.gemini_gateway import GeminiGateway, build_sqlite_context
from app.services.resilience import RecoverableProviderError


def test_gemini_key_validator() -> None:
    assert is_valid_gemini_api_key("") is False
    assert is_valid_gemini_api_key("short") is False
    assert is_valid_gemini_api_key("AIzaSyDummyKeyForValidationTestsXXXX") is True


def test_effective_cognitive_auto_prefers_gemini_when_key() -> None:
    s = Settings(
        use_mock_audio=False,
        cognitive_provider="auto",
        gemini_api_key="AIzaSyDummyKeyForValidationTestsXXXX",
        openai_api_key="",
    )
    assert s.effective_cognitive_provider() == "gemini"

    s2 = Settings(
        use_mock_audio=False,
        cognitive_provider="auto",
        gemini_api_key="",
        openai_api_key="sk-abcdefghijklmnopqrstuvwxyz0123456789",
    )
    assert s2.effective_cognitive_provider() == "openai"

    # Mock audio always stays on OpenAI tool mock path
    s3 = Settings(
        use_mock_audio=True,
        cognitive_provider="gemini",
        gemini_api_key="AIzaSyDummyKeyForValidationTestsXXXX",
    )
    assert s3.effective_cognitive_provider() == "openai"


@pytest.mark.asyncio
async def test_gemini_missing_key_raises_recoverable() -> None:
    gateway = GeminiGateway(Settings(gemini_api_key="", cognitive_provider="gemini"))
    with pytest.raises(RecoverableProviderError) as exc:
        await gateway.generate("olá Aether")
    assert "missing_gemini_api_key" in exc.value.detail


def test_build_sqlite_context_best_effort() -> None:
    # Should not raise even if DB empty / unavailable
    block = build_sqlite_context(client_id="__no_such_client__", limit=3)
    assert isinstance(block, str)


def test_health_exposes_gemini_flags() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert "gemini_api_key_configured" in body
        assert "has_valid_gemini_key" in body
        assert "cognitive_provider" in body
        assert isinstance(body["has_valid_gemini_key"], bool)
