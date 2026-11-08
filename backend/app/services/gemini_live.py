"""Gemini Live (BidiGenerateContent) session helpers for Aether Vision HUD.

Uses google-genai ``client.aio.live.connect`` with AUDIO-only responses.
Model id is pinned to ``gemini-2.5-flash`` per Live integration plan
(even when turn-based cognitive defaults are 3.x).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable, Awaitable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Protocol

from app.services.gemini_gateway import default_system_instruction

logger = logging.getLogger("aether.gemini_live")

# Assignment-pinned Live model (do not silently swap to 3.x cognitive IDs).
GEMINI_LIVE_MODEL = "gemini-2.5-flash"
LIVE_INPUT_SAMPLE_RATE = 16_000
LIVE_OUTPUT_SAMPLE_RATE = 24_000
LIVE_PCM_MIME = f"audio/pcm;rate={LIVE_INPUT_SAMPLE_RATE}"


class LiveSessionProto(Protocol):
    async def send_realtime_input(self, **kwargs: Any) -> None: ...

    def receive(self) -> AsyncIterator[Any]: ...

    async def close(self) -> None: ...


@dataclass(frozen=True)
class LiveBridgeMeta:
    model: str
    input_sample_rate: int = LIVE_INPUT_SAMPLE_RATE
    output_sample_rate: int = LIVE_OUTPUT_SAMPLE_RATE
    response_modality: str = "AUDIO"


def live_system_instruction() -> str:
    """HUD / headset Live persona — reuse Gemini gateway speakable tone."""
    return default_system_instruction(speakable=True)


def build_live_connect_config(types_mod: Any) -> Any:
    """Build LiveConnectConfig for AUDIO-only Live responses.

    google-genai 1.75 uses ``types.Modality.AUDIO`` (no LiveModality enum).
    """
    modality = types_mod.Modality.AUDIO
    return types_mod.LiveConnectConfig(
        response_modalities=[modality],
        system_instruction=live_system_instruction(),
        temperature=0.4,
    )


@asynccontextmanager
async def connect_gemini_live(
    *,
    api_key: str,
    model: str = GEMINI_LIVE_MODEL,
) -> AsyncIterator[LiveSessionProto]:
    """Open an official google-genai Live session (async context)."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    config = build_live_connect_config(types)
    logger.info("gemini.live.connect model=%s modality=AUDIO", model)
    try:
        async with client.aio.live.connect(model=model, config=config) as session:
            yield session  # type: ignore[misc]
    finally:
        try:
            await client.aio.aclose()
        except Exception:  # noqa: BLE001
            pass


async def send_pcm_chunk(session: LiveSessionProto, pcm: bytes) -> None:
    """Forward 16 kHz PCM mono to Gemini Live realtime input."""
    from google.genai import types

    if not pcm:
        return
    await session.send_realtime_input(
        audio=types.Blob(data=pcm, mime_type=LIVE_PCM_MIME),
    )


async def signal_user_activity_start(session: LiveSessionProto) -> None:
    """Barge-in hint: client detected speech during model playback."""
    from google.genai import types

    try:
        await session.send_realtime_input(activity_start=types.ActivityStart())
    except Exception as exc:  # noqa: BLE001
        logger.debug("gemini.live.activity_start skipped: %s", exc)


async def signal_audio_stream_end(session: LiveSessionProto) -> None:
    try:
        await session.send_realtime_input(audio_stream_end=True)
    except Exception as exc:  # noqa: BLE001
        logger.debug("gemini.live.audio_stream_end skipped: %s", exc)


def extract_audio_bytes(message: Any) -> bytes | None:
    data = getattr(message, "data", None)
    if isinstance(data, (bytes, bytearray)) and len(data) > 0:
        return bytes(data)
    return None


def extract_server_flags(message: Any) -> dict[str, Any]:
    content = getattr(message, "server_content", None)
    if content is None:
        return {}
    return {
        "interrupted": bool(getattr(content, "interrupted", False)),
        "turn_complete": bool(getattr(content, "turn_complete", False)),
        "generation_complete": bool(getattr(content, "generation_complete", False)),
        "input_transcript": _transcription_text(getattr(content, "input_transcription", None)),
        "output_transcript": _transcription_text(getattr(content, "output_transcription", None)),
    }


def _transcription_text(obj: Any) -> str | None:
    if obj is None:
        return None
    text = getattr(obj, "text", None)
    if isinstance(text, str) and text.strip():
        return text
    return None


LiveConnectFactory = Callable[..., Awaitable[Any]]
