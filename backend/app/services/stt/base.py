"""STT provider interface."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.models.schemas import SttResult


@runtime_checkable
class SttProviderProtocol(Protocol):
    """Pluggable Whisper / STT backend."""

    name: str

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: str,
        language: str | None = None,
    ) -> SttResult:
        """Convert headset-captured audio into text."""
        ...
