"""Gemini cognitive engine — unit tests (no live API key required)."""

from __future__ import annotations

from app.config import Settings
from app.services.gemini_gateway import (
    GeminiGateway,
    resolve_gemini_mode,
    resolve_gemini_model,
)
from fastapi.testclient import TestClient

from app.main import app
from app.services.resilience import RecoverableProviderError
import pytest


def test_effective_cognitive_always_gemini() -> None:
    s = Settings(
        cognitive_provider="auto",
        gemini_api_key="AIzaSyDummyKeyValue1234567890ABCD",
        use_mock_audio=False,
    )
    assert s.effective_cognitive_provider() == "gemini"

    s2 = Settings(
        cognitive_provider="auto",
        gemini_api_key="",
        use_mock_audio=True,
    )
    assert s2.effective_cognitive_provider() == "gemini"

    s3 = Settings(
        cognitive_provider="gemini",
        gemini_api_key="",
        use_mock_audio=False,
    )
    assert s3.effective_cognitive_provider() == "gemini"


def test_resolve_models() -> None:
    assert resolve_gemini_mode("flash") == "flash"
    assert resolve_gemini_mode("pro") == "pro"
    assert resolve_gemini_model("flash") == "gemini-2.5-flash"
    assert resolve_gemini_model("pro") == "gemini-2.5-pro"


@pytest.mark.asyncio
async def test_gemini_gateway_missing_key_raises() -> None:
    gateway = GeminiGateway(Settings(gemini_api_key="", cognitive_provider="gemini"))
    with pytest.raises(RecoverableProviderError):
        await gateway.chat(query="olá", mode="flash")


def test_health_lists_gemini_cognitive() -> None:
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert body["cognitive_provider"] == "gemini"
        assert body["stt_provider"] in ("mock", "gemini")
        assert body["tts_provider"] in ("mock", "gemini")
