"""Absolute dotenv path + OpenAI key validation (never expose secrets)."""

from __future__ import annotations

import os
from pathlib import Path

from app.core.config import (
    BACKEND_ENV_FILE,
    is_valid_openai_api_key,
    load_backend_dotenv,
    normalize_secret,
)


def test_backend_env_path_is_absolute_and_under_backend() -> None:
    assert BACKEND_ENV_FILE.is_absolute()
    assert BACKEND_ENV_FILE.name == ".env"
    assert BACKEND_ENV_FILE.parent.name == "backend"


def test_normalize_secret_strips_quotes() -> None:
    assert normalize_secret('""') == ""
    assert normalize_secret('"sk-abc"') == "sk-abc"
    assert normalize_secret("  sk-xyz  ") == "sk-xyz"


def test_is_valid_openai_api_key() -> None:
    assert is_valid_openai_api_key("") is False
    assert is_valid_openai_api_key("placeholder") is False
    assert is_valid_openai_api_key("not-a-key") is False
    assert is_valid_openai_api_key("sk-short") is False
    assert (
        is_valid_openai_api_key("sk-abcdefghijklmnopqrstuvwxyz012345") is True
    )
    assert (
        is_valid_openai_api_key("sk-proj-abcdefghijklmnopqrstuvwxyz012345") is True
    )


def test_load_backend_dotenv_works_from_repo_root_cwd(tmp_path: Path, monkeypatch) -> None:
    """Regression: CWD at repo root must still load backend/.env, not miss it."""
    monkeypatch.chdir(tmp_path)  # nowhere near backend/
    # Should not raise; targets absolute BACKEND_ENV_FILE
    path = load_backend_dotenv(override=False)
    assert path == BACKEND_ENV_FILE
    assert path.is_absolute()


def test_settings_has_valid_openai_key_false_when_empty() -> None:
    from app.config import Settings

    s = Settings(openai_api_key="", use_mock_audio=True)
    assert s.has_valid_openai_key() is False


def test_settings_has_valid_openai_key_true_for_sk() -> None:
    from app.config import Settings

    s = Settings(
        openai_api_key="sk-abcdefghijklmnopqrstuvwxyz012345",
        use_mock_audio=True,
    )
    assert s.has_valid_openai_key() is True
    # Never leak into repr accidentally via health — just ensure value stays internal
    assert "sk-abcdef" in s.openai_api_key
