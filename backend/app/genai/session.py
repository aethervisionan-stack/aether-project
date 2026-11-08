"""Bidirectional Gemini Live session via the official google-genai SDK."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from google import genai
from google.genai import types

from app.config import AETHER_SYSTEM_INSTRUCTION, Settings

logger = logging.getLogger("aether.genai.session")

AudioOutCallback = Callable[[bytes], Awaitable[None]]
EventOutCallback = Callable[[dict[str, Any]], Awaitable[None]]

INPUT_SAMPLE_RATE = 16_000


def build_live_config(*, system_instruction: str = AETHER_SYSTEM_INSTRUCTION) -> types.LiveConnectConfig:
    """Live session config: AUDIO responses + Aether HUD persona."""
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

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = genai.Client(api_key=settings.gemini_api_key.strip())
        self._model = settings.gemini_live_model.strip() or "gemini-2.5-flash"
        self._audio_in: asyncio.Queue[bytes] = asyncio.Queue(maxsize=64)
        self._text_in: asyncio.Queue[str] = asyncio.Queue(maxsize=16)
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

    async def run(
        self,
        *,
        on_audio: AudioOutCallback,
        on_event: EventOutCallback,
    ) -> None:
        config = build_live_config()
        logger.info("connecting Live session model=%s", self._model)
        async with self._client.aio.live.connect(model=self._model, config=config) as session:
            self._session = session
            await on_event({"type": "ready", "model": self._model})
            send_audio_task = asyncio.create_task(self._send_audio_loop(session), name="live-send-audio")
            send_text_task = asyncio.create_task(self._send_text_loop(session), name="live-send-text")
            receive_task = asyncio.create_task(
                self._receive_loop(session, on_audio=on_audio, on_event=on_event),
                name="live-receive",
            )
            self._tasks = [send_audio_task, send_text_task, receive_task]
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
                            await on_audio(bytes(data))

                in_tx = getattr(server_content, "input_transcription", None)
                if in_tx and getattr(in_tx, "text", None):
                    await on_event({"type": "user_transcript", "text": in_tx.text})

                out_tx = getattr(server_content, "output_transcription", None)
                if out_tx and getattr(out_tx, "text", None):
                    await on_event({"type": "aether_transcript", "text": out_tx.text})

                if getattr(server_content, "interrupted", False):
                    await on_event({"type": "interrupted"})

                if getattr(server_content, "turn_complete", False):
                    await on_event({"type": "turn_complete"})
