"""Persist TTS MP3 bytes and expose download paths for GET /audio/{filename}."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.config import Settings, get_settings

_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


def audio_dir(settings: Settings | None = None) -> Path:
    cfg = settings or get_settings()
    path = Path(cfg.tts_audio_dir).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_tts_audio(
    audio_bytes: bytes,
    *,
    extension: str = "mp3",
    settings: Settings | None = None,
) -> str:
    """Write bytes to disk; return the filename only (not a full path)."""
    ext = extension.lstrip(".") or "mp3"
    filename = f"tts-{uuid.uuid4().hex}.{ext}"
    target = audio_dir(settings) / filename
    target.write_bytes(audio_bytes)
    return filename


def resolve_audio_file(filename: str, *, settings: Settings | None = None) -> Path | None:
    safe = _SAFE_NAME.sub("", filename)
    if not safe or safe != filename or ".." in filename:
        return None
    path = audio_dir(settings) / safe
    if not path.is_file():
        return None
    return path
