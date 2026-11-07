"""CORS and settings smoke checks for the Vite client."""

from __future__ import annotations

from app.config import DEFAULT_VITE_CORS_ORIGINS, Settings


def test_vite_cors_origins_always_present() -> None:
    settings = Settings(cors_origins="https://example.com")
    origins = settings.cors_origin_list
    assert "https://example.com" in origins
    assert "http://127.0.0.1:5173" in origins
    assert "http://localhost:5173" in origins
    for required in DEFAULT_VITE_CORS_ORIGINS:
        assert required in origins


def test_default_cors_includes_vite() -> None:
    settings = Settings()
    assert settings.cors_origin_list == list(DEFAULT_VITE_CORS_ORIGINS)
