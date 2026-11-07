"""
Backend env bootstrap — always load `backend/.env` by absolute path.

Why: bare `load_dotenv()` and pydantic `env_file=".env"` resolve against CWD.
Starting uvicorn from the repo root (or another folder) silently skips
`backend/.env`, so OPENAI_API_KEY stays empty and STT falls back.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

logger = logging.getLogger("aether.env")

# backend/app/core/config.py → parents[2] == backend/
BACKEND_DIR: Path = Path(__file__).resolve().parents[2]
BACKEND_ENV_FILE: Path = BACKEND_DIR / ".env"

# OpenAI user keys are `sk-...` (project keys may be `sk-proj-...`).
_OPENAI_KEY_RE = re.compile(r"^sk-[A-Za-z0-9_\-]{20,}$")


def backend_env_path() -> Path:
    return BACKEND_ENV_FILE


def normalize_secret(value: object) -> str:
    """Strip whitespace and wrapping quotes from .env values."""
    if value is None:
        return ""
    text = str(value).strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in ("'", '"'):
        text = text[1:-1].strip()
    return text


def is_valid_openai_api_key(value: object) -> bool:
    """True when key looks like a real OpenAI secret (never log the value)."""
    key = normalize_secret(value)
    if not key or key.lower() in {"", "your-key-here", "changeme", "placeholder"}:
        return False
    return bool(_OPENAI_KEY_RE.match(key))


def is_valid_gemini_api_key(value: object) -> bool:
    """True when GEMINI_API_KEY looks present/usable (never log the value)."""
    key = normalize_secret(value)
    if not key or key.lower() in {"", "your-key-here", "changeme", "placeholder"}:
        return False
    # Google AI Studio keys are typically long; often start with AIza.
    if len(key) < 20:
        return False
    return True


def load_backend_dotenv(*, override: bool = False) -> Path:
    """
    Load `backend/.env` using an absolute path (independent of process CWD).

    Returns the path that was targeted. Safe if the file is missing.
    """
    path = BACKEND_ENV_FILE
    try:
        from dotenv import load_dotenv
    except ImportError:  # pragma: no cover
        logger.warning("python-dotenv missing — relying on OS env / pydantic only")
        return path

    if not path.is_file():
        logger.warning(
            "backend .env not found at %s (cwd=%s) — set OPENAI_API_KEY in that file",
            path,
            os.getcwd(),
        )
        return path

    loaded = load_dotenv(dotenv_path=path, override=override)
    # Normalize quoted empty / quoted keys into os.environ for downstream readers
    for env_name in ("OPENAI_API_KEY", "GEMINI_API_KEY"):
        raw = os.environ.get(env_name)
        if raw is not None:
            os.environ[env_name] = normalize_secret(raw)

    logger.info(
        "dotenv load path=%s loaded=%s cwd=%s openai_key_valid=%s gemini_key_valid=%s",
        path,
        bool(loaded),
        os.getcwd(),
        is_valid_openai_api_key(os.environ.get("OPENAI_API_KEY")),
        is_valid_gemini_api_key(os.environ.get("GEMINI_API_KEY")),
    )
    return path
