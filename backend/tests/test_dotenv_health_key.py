"""Absolute dotenv path + Gemini key validation (never expose secrets)."""

from __future__ import annotations

from app.config import Settings
from app.core.config import (
    BACKEND_ENV_FILE,
    is_valid_gemini_api_key,
    load_backend_dotenv,
    normalize_secret,
)
from app.main import app
from fastapi.testclient import TestClient


def test_normalize_secret_strips_quotes() -> None:
    assert normalize_secret('  "abc"  ') == "abc"
    assert normalize_secret("'xyz'") == "xyz"
    assert normalize_secret(None) == ""


def test_is_valid_gemini_api_key() -> None:
    assert is_valid_gemini_api_key("") is False
    assert is_valid_gemini_api_key("placeholder") is False
    assert is_valid_gemini_api_key("short") is False
    assert is_valid_gemini_api_key("AIzaSyDummyKeyValue1234567890ABCD") is True


def test_backend_env_file_is_absolute() -> None:
    assert BACKEND_ENV_FILE.is_absolute()
    assert BACKEND_ENV_FILE.name == ".env"


def test_load_backend_dotenv_returns_path() -> None:
    path = load_backend_dotenv(override=False)
    assert path == BACKEND_ENV_FILE


def test_settings_has_valid_gemini_key_false_when_empty() -> None:
    s = Settings(gemini_api_key="", use_mock_audio=True)
    assert s.has_valid_gemini_key() is False


def test_settings_has_valid_gemini_key_true_for_long_key() -> None:
    s = Settings(
        gemini_api_key="AIzaSyDummyKeyValue1234567890ABCD",
        use_mock_audio=True,
    )
    assert s.has_valid_gemini_key() is True


def test_health_exposes_gemini_flags_not_openai() -> None:
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert "has_valid_gemini_key" in body
        assert "gemini_api_key_configured" in body
        assert "openai_api_key_configured" not in body
        assert "has_valid_openai_key" not in body
        assert body["cognitive_provider"] == "gemini"
