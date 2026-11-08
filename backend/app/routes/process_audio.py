"""POST /process-audio — Bluetooth headset capture → validated spoken reply."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.config import Settings
from app.deps import get_app_settings, get_pipeline
from app.models.schemas import ProcessAudioResponse
from app.services.pipeline import AudioPipeline
from app.services.resilience import PipelineError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["audio"])


@router.post(
    "/process-audio",
    response_model=ProcessAudioResponse,
    summary="Process Bluetooth headset audio",
    responses={
        400: {"description": "Invalid / empty audio"},
        503: {"description": "Transient STT/TTS/network failure"},
    },
)
async def process_audio(
    audio: UploadFile = File(..., description="Microphone capture from the Bluetooth headset"),
    language: str | None = Form(default=None),
    locale: str = Form(default="pt-BR"),
    client_id: str = Form(default="default"),
    settings: Settings = Depends(get_app_settings),
    pipeline: AudioPipeline = Depends(get_pipeline),
) -> ProcessAudioResponse:
    """
    Accepts multipart audio from a generic Bluetooth headset mic,
    runs STT → adaptive memory → Gemini → Consenso Alfa → TTS, and returns
    transcript + validated text + base64 /audio URL for headphone autoplay.
    """
    content_type = audio.content_type or "application/octet-stream"
    filename = audio.filename or "headset-capture.webm"

    try:
        audio_bytes = await asyncio.wait_for(
            audio.read(),
            timeout=settings.request_timeout_ms / 1000.0,
        )
    except TimeoutError as exc:
        raise PipelineError(
            "Timed out reading audio upload",
            stage="stt",
            retryable=True,
            detail=str(exc),
        ) from exc

    logger.info(
        "[aether:stage] http.process_audio.received filename=%s content_type=%s bytes=%s locale=%s client_id=%s",
        filename,
        content_type,
        len(audio_bytes),
        locale,
        client_id,
    )
    logger.info(
        '{"event":"http.process_audio.received","filename":%s,"content_type":%s,"bytes":%s,"locale":%s,"client_id":%s}',
        json.dumps(filename),
        json.dumps(content_type),
        len(audio_bytes),
        json.dumps(locale),
        json.dumps(client_id),
    )

    try:
        response = await asyncio.wait_for(
            pipeline.process(
                audio_bytes,
                filename=filename,
                content_type=content_type,
                language=language,
                locale=locale,
                client_id=client_id or "default",
            ),
            timeout=settings.request_timeout_ms / 1000.0,
        )
        logger.info(
            "[aether:stage] http.process_audio.done transcript_chars=%s response_chars=%s "
            "tts=%s audio_url=%s fallback=%s reason=%s total_ms=%s",
            len(response.transcript or ""),
            len(response.response_text or ""),
            response.meta.tts_provider,
            bool(response.audio_url),
            response.meta.used_safe_fallback,
            response.meta.fallback_reason,
            response.latency.total_ms,
        )
        return response
    except TimeoutError as exc:
        logger.error("[aether:stage] http.process_audio.timeout detail=%s", exc)
        raise PipelineError(
            "Pipeline timed out",
            stage="total",
            retryable=True,
            detail=str(exc),
        ) from exc
    except Exception:
        logger.exception("[aether:stage] http.process_audio.error")
        raise
