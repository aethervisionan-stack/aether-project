"""
Stream text responses in small chunks to minimize perceived TTFT.

Audio PCM from Gemini Live already streams as binary frames. This module
covers text/tool-sidecar paths so the HUD can paint tokens immediately while
the spectrogram/LatencyTracker keep measuring ms independently.
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from typing import Any

EventSink = Callable[[dict[str, Any]], Awaitable[None]]

_WORD_SPLIT = re.compile(r"(\s+)")


def chunk_text(text: str, *, max_chars: int = 24) -> Iterator[str]:
    """Yield small speakable/HUD-sized chunks without breaking words when possible."""
    cleaned = (text or "").strip()
    if not cleaned:
        return
    buf = ""
    for part in _WORD_SPLIT.split(cleaned):
        if not part:
            continue
        if len(buf) + len(part) <= max_chars:
            buf += part
            continue
        if buf.strip():
            yield buf
        buf = part if not part.isspace() else ""
    if buf.strip():
        yield buf


class TokenStreamEmitter:
    """Emit `token_delta` / `token_done` events through the Live event sink."""

    def __init__(self, sink: EventSink) -> None:
        self._sink = sink

    async def emit_text(
        self,
        text: str,
        *,
        stream_id: str,
        max_chars: int = 24,
    ) -> int:
        count = 0
        for chunk in chunk_text(text, max_chars=max_chars):
            count += 1
            await self._sink(
                {
                    "type": "token_delta",
                    "stream_id": stream_id,
                    "index": count,
                    "text": chunk,
                }
            )
        await self._sink(
            {
                "type": "token_done",
                "stream_id": stream_id,
                "chunks": count,
                "text": text,
            }
        )
        return count

    async def aiter_chunks(self, text: str, *, max_chars: int = 24) -> AsyncIterator[str]:
        for chunk in chunk_text(text, max_chars=max_chars):
            yield chunk
