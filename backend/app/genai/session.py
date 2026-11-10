"""Bidirectional Gemini Live session via the official google-genai SDK."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from google import genai
from google.genai import types

from app.config import AETHER_SYSTEM_INSTRUCTION, Settings
from app.memory.context import build_system_instruction

logger = logging.getLogger("aether.genai.session")

AudioOutCallback = Callable[[bytes], Awaitable[None]]
EventOutCallback = Callable[[dict[str, Any]], Awaitable[None]]

INPUT_SAMPLE_RATE = 16_000


def build_live_config(*, system_instruction: str = AETHER_SYSTEM_INSTRUCTION) -> types.LiveConnectConfig:
    """
    Live session config: AUDIO responses + Aether co-pilot persona.

    System instruction carries fluent voice persona, silent CoT guidance,
    long-term memory personalization, and mandatory system_help_tool rules.
    Ultra-low-latency PCM path is unchanged — planning lives in prompt +
    async sidecar, never on the audio send/receive loops.
    """
    return types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(
            parts=[types.Part(text=system_instruction)],
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )


class GeminiLiveSession:
    """
    Bridges PCM queues to `client.aio.live.connect`.

    Mic PCM (16-bit LE mono @ 16 kHz) → Gemini.
    Gemini PCM (16-bit LE mono @ 24 kHz) → audio_out callback.
    """

    def __init__(
        self,
        settings: Settings,
        *,
        system_instruction: str | None = None,
    ) -> None:
        self._settings = settings
        api_version = (settings.gemini_api_version or "v1beta").strip() or "v1beta"
        # Live / BidiGenerateContent WebSockets require v1beta or v1alpha.
        # Default (unset) API version returns HTTP 404 on live.connect.
        self._client = genai.Client(
            api_key=settings.gemini_api_key.strip(),
            http_options={"api_version": api_version},
        )
        self._model = settings.gemini_live_model.strip() or "gemini-3.8-live"
        self._api_version = api_version
        self._system_instruction = (system_instruction or build_system_instruction()).strip()
        self._audio_in: asyncio.Queue[bytes] = asyncio.Queue(maxsize=64)
        self._text_in: asyncio.Queue[str] = asyncio.Queue(maxsize=16)
        # Screen/image frames: (mime, bytes) — bounded so voice path stays primary.
        self._image_in: asyncio.Queue[tuple[str, bytes]] = asyncio.Queue(maxsize=2)
        self._session: Any | None = None
        self._tasks: list[asyncio.Task[Any]] = []

    @property
    def model(self) -> str:
        return self._model

    async def push_audio(self, pcm: bytes) -> None:
        """Enqueue mic PCM; drop oldest on overflow to bound latency."""
        if not pcm:
            return
        try:
            self._audio_in.put_nowait(pcm)
        except asyncio.QueueFull:
            try:
                _ = self._audio_in.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                self._audio_in.put_nowait(pcm)
            except asyncio.QueueFull:
                logger.warning("audio queue still full after drop; discarding frame")

    async def push_text(self, text: str) -> None:
        cleaned = text.strip()
        if cleaned:
            await self._text_in.put(cleaned)

    async def push_image(self, data: bytes, *, mime: str = "image/jpeg") -> None:
        """Enqueue a screen/image frame for Live multimodal input (drops oldest)."""
        if not data:
            return
        item = (mime or "image/jpeg", data)
        try:
            self._image_in.put_nowait(item)
        except asyncio.QueueFull:
            try:
                _ = self._image_in.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                self._image_in.put_nowait(item)
            except asyncio.QueueFull:
                logger.warning("image queue full; dropping frame")

    async def run(
        self,
        *,
        on_audio: AudioOutCallback,
        on_event: EventOutCallback,
    ) -> None:
        config = build_live_config(system_instruction=self._system_instruction)
        logger.info(
            "connecting Live session model=%s api_version=%s memory_block=%s cot_hint=%s",
            self._model,
            self._api_version,
            "Long-term memory" in self._system_instruction,
            "Silent CoT" in self._system_instruction
            or "Internal planning" in self._system_instruction,
        )
        async with self._client.aio.live.connect(model=self._model, config=config) as session:
            self._session = session
            await on_event({"type": "ready", "model": self._model})
            send_audio_task = asyncio.create_task(self._send_audio_loop(session), name="live-send-audio")
            send_text_task = asyncio.create_task(self._send_text_loop(session), name="live-send-text")
            send_image_task = asyncio.create_task(self._send_image_loop(session), name="live-send-image")
            receive_task = asyncio.create_task(
                self._receive_loop(session, on_audio=on_audio, on_event=on_event),
                name="live-receive",
            )
            self._tasks = [send_audio_task, send_text_task, send_image_task, receive_task]
            try:
                done, pending = await asyncio.wait(
                    self._tasks,
                    return_when=asyncio.FIRST_EXCEPTION,
                )
                for task in done:
                    exc = task.exception()
                    if exc is not None:
                        raise exc
            finally:
                for task in self._tasks:
                    task.cancel()
                await asyncio.gather(*self._tasks, return_exceptions=True)
                self._tasks.clear()
                self._session = None

    async def _send_audio_loop(self, session: Any) -> None:
        mime = f"audio/pcm;rate={INPUT_SAMPLE_RATE}"
        while True:
            chunk = await self._audio_in.get()
            await session.send_realtime_input(
                audio=types.Blob(data=chunk, mime_type=mime),
            )

    async def _send_text_loop(self, session: Any) -> None:
        while True:
            text = await self._text_in.get()
            await session.send_realtime_input(text=text)

    async def _send_image_loop(self, session: Any) -> None:
        """Forward screen frames without competing with PCM priority queues."""
        while True:
            mime, data = await self._image_in.get()
            try:
                # google-genai Live accepts realtime media blobs (image/jpeg|png).
                await session.send_realtime_input(
                    media=types.Blob(data=data, mime_type=mime),
                )
            except TypeError:
                # Older SDK keyword — try video= for compatibility.
                try:
                    await session.send_realtime_input(
                        video=types.Blob(data=data, mime_type=mime),
                    )
                except Exception:
                    logger.debug("image send unsupported by Live SDK; skipping frame", exc_info=True)
            except Exception:
                logger.debug("image send failed; skipping frame", exc_info=True)

    async def _receive_loop(
        self,
        session: Any,
        *,
        on_audio: AudioOutCallback,
        on_event: EventOutCallback,
    ) -> None:
        while True:
            async for response in session.receive():
                server_content = getattr(response, "server_content", None)
                if not server_content:
                    continue

                model_turn = getattr(server_content, "model_turn", None)
                if model_turn and getattr(model_turn, "parts", None):
                    for part in model_turn.parts:
                        inline = getattr(part, "inline_data", None)
                        data = getattr(inline, "data", None) if inline else None
                        if data:
                            # First audio chunk → client marks TTFT via LatencyTracker.
                            await on_audio(bytes(data))
                        # Stream any text parts as token deltas (ultra-low TTFT for HUD).
                        part_text = getattr(part, "text", None)
                        if part_text:
                            await on_event(
                                {
                                    "type": "token_delta",
                                    "stream_id": "live-text",
                                    "text": str(part_text),
                                }
                            )

                in_tx = getattr(server_content, "input_transcription", None)
                if in_tx and getattr(in_tx, "text", None):
                    await on_event({"type": "user_transcript", "text": in_tx.text})

                out_tx = getattr(server_content, "output_transcription", None)
                if out_tx and getattr(out_tx, "text", None):
                    # Transcript chunks also count as streamed AI text for TTFT.
                    await on_event({"type": "aether_transcript", "text": out_tx.text})
                    await on_event(
                        {
                            "type": "token_delta",
                            "stream_id": "live-transcript",
                            "text": str(out_tx.text),
                        }
                    )

                if getattr(server_content, "interrupted", False):
                    await on_event({"type": "interrupted"})

                if getattr(server_content, "turn_complete", False):
                    await on_event({"type": "token_done", "stream_id": "live-transcript"})
                    await on_event({"type": "turn_complete"})
