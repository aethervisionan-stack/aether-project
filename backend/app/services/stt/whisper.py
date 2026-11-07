"""Whisper STT adapters — OpenAI API and optional local openai-whisper."""

from __future__ import annotations

import asyncio
import io
import time
from typing import Any

from app.config import Settings
from app.models.schemas import SttResult
from app.services.resilience import retry_async, transient_network_error


class OpenAIWhisperStt:
    """Cloud Whisper via OpenAI Audio Transcriptions API."""

    name = "openai-whisper"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        if not settings.openai_api_key:
            raise RuntimeError(
                "STT_PROVIDER=openai requires OPENAI_API_KEY. "
                "Use STT_PROVIDER=mock or PIPELINE_MODE=mock for local tests."
            )

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: str,
        language: str | None = None,
    ) -> SttResult:
        started = time.perf_counter()

        async def _call() -> Any:
            try:
                from openai import AsyncOpenAI
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError("Install openai package for STT_PROVIDER=openai") from exc

            client = AsyncOpenAI(api_key=self._settings.openai_api_key)
            buffer = io.BytesIO(audio_bytes)
            buffer.name = filename or "headset.webm"
            try:
                return await client.audio.transcriptions.create(
                    model=self._settings.openai_stt_model,
                    file=buffer,
                    language=language or self._settings.whisper_language,
                    response_format="verbose_json",
                )
            except Exception as exc:  # noqa: BLE001
                raise transient_network_error("openai-stt", exc) from exc

        result = await retry_async(
            _call,
            attempts=self._settings.retry_attempts,
            backoff_ms=self._settings.retry_backoff_ms,
        )
        text = getattr(result, "text", "") or ""
        elapsed = int((time.perf_counter() - started) * 1000)
        return SttResult(
            text=text.strip(),
            language=getattr(result, "language", language),
            confidence=0.85,
            provider=self.name,
            duration_ms=elapsed,
            raw={"model": self._settings.openai_stt_model, "content_type": content_type},
        )


class LocalWhisperStt:
    """Local openai-whisper model (optional heavy dependency)."""

    name = "local-whisper"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model: Any | None = None

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model
        try:
            import whisper  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "STT_PROVIDER=local requires `pip install openai-whisper` and ffmpeg. "
                "Prefer STT_PROVIDER=mock for lightweight local tests."
            ) from exc
        self._model = whisper.load_model(
            self._settings.whisper_model,
            device=self._settings.whisper_device,
        )
        return self._model

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: str,
        language: str | None = None,
    ) -> SttResult:
        started = time.perf_counter()
        model = await asyncio.to_thread(self._load_model)

        def _run() -> Any:
            import tempfile
            from pathlib import Path

            suffix = Path(filename).suffix or ".wav"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
                tmp.write(audio_bytes)
                tmp.flush()
                return model.transcribe(
                    tmp.name,
                    language=language or self._settings.whisper_language,
                    fp16=False,
                )

        result = await asyncio.to_thread(_run)
        text = (result.get("text") or "").strip()
        elapsed = int((time.perf_counter() - started) * 1000)
        return SttResult(
            text=text,
            language=result.get("language") or language,
            confidence=0.8,
            provider=self.name,
            duration_ms=elapsed,
            raw={"model": self._settings.whisper_model, "content_type": content_type},
        )
