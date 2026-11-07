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
    query: str | None = Form(
        default=None,
        description=(
            "Optional transcript override (Android on-device STT). "
            "When set, STT is skipped and this text feeds the agent + Consenso Alfa."
        ),
    ),
    client: str | None = Form(default=None, description="Caller id, e.g. aether_m100_android"),
    settings: Settings = Depends(get_app_settings),
    pipeline: AudioPipeline = Depends(get_pipeline),
) -> ProcessAudioResponse:
    """
    Accepts multipart audio from a generic Bluetooth headset mic,
    runs STT → agent draft → Consenso Alfa → TTS, and returns
    transcript + validated text + base64 WAV for headphone playback.

    Android clients upload MultipartBody.Part field name **audio** plus optional
    form fields language / locale / query / client.
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
        '{"event":"http.process_audio.received","filename":%s,"content_type":%s,"bytes":%s,"locale":%s,"query_chars":%s,"client":%s}',
        json.dumps(filename),
        json.dumps(content_type),
        len(audio_bytes),
        json.dumps(locale),
        len((query or "").strip()),
        json.dumps(client),
    )

    try:
        return await asyncio.wait_for(
            pipeline.process(
                audio_bytes,
                filename=filename,
                content_type=content_type,
                language=language,
                locale=locale,
                transcript_override=(query.strip() if query and query.strip() else None),
            ),
            timeout=settings.request_timeout_ms / 1000.0,
        )
    except TimeoutError as exc:
        raise PipelineError(
            "Pipeline timed out",
            stage="total",
            retryable=True,
            detail=str(exc),
        ) from exc
