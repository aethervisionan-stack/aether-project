"""TTS provider interface."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.models.schemas import TtsResult


@runtime_checkable
class TtsProviderProtocol(Protocol):
    name: str

    async def synthesize(self, text: str) -> TtsResult:
        """Return clean audio suitable for Bluetooth headphone playback."""
        ...
