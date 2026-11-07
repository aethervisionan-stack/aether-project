"""End-to-end audio pipeline: STT → agent → Consenso Alfa → TTS."""

from __future__ import annotations

import json
import logging
import time
import uuid

from app.config import Settings
from app.models.schemas import LatencyBreakdown, ProcessAudioMeta, ProcessAudioResponse
from app.services.agent import ResponseAgent
from app.services.consenso_alfa import ConsensoAlfa
from app.services.resilience import PipelineError
from app.services.stt import SttProviderProtocol
from app.services.tts import TtsProviderProtocol

logger = logging.getLogger("aether.pipeline")


def _plog(event: str, **fields: object) -> None:
    logger.info("%s", json.dumps({"event": event, **fields}, ensure_ascii=False, default=str))


class AudioPipeline:
    def __init__(
        self,
        settings: Settings,
        stt: SttProviderProtocol,
        tts: TtsProviderProtocol,
        consenso: ConsensoAlfa,
        agent: ResponseAgent | None = None,
    ) -> None:
        self._settings = settings
        self._stt = stt
        self._tts = tts
        self._consenso = consenso
        self._agent = agent or ResponseAgent()

    async def process(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: str,
        language: str | None = None,
        locale: str = "pt-BR",
    ) -> ProcessAudioResponse:
        request_id = str(uuid.uuid4())
        total_started = time.perf_counter()
        _plog(
            "pipeline.start",
            request_id=request_id,
            filename=filename,
            content_type=content_type,
            bytes=len(audio_bytes),
            locale=locale,
        )

        if len(audio_bytes) > self._settings.max_audio_bytes:
            raise PipelineError(
                "Audio payload too large",
                stage="stt",
                retryable=False,
                detail=f"max={self._settings.max_audio_bytes}",
            )
        if not audio_bytes:
            raise PipelineError(
                "Empty audio payload",
                stage="stt",
                retryable=False,
                detail="No bytes received from headset capture",
            )

        try:
            stt = await self._stt.transcribe(
                audio_bytes,
                filename=filename,
                content_type=content_type,
                language=language,
            )
        except PipelineError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PipelineError(
                "STT failed",
                stage="stt",
                retryable=True,
                detail=str(exc),
            ) from exc

        _plog(
            "pipeline.stt.done",
            request_id=request_id,
            provider=stt.provider,
            chars=len(stt.text),
            confidence=stt.confidence,
            duration_ms=stt.duration_ms,
        )

        try:
            draft = await self._agent.draft(stt.text, locale=locale)
        except Exception as exc:  # noqa: BLE001
            raise PipelineError(
                "Agent draft failed",
                stage="agent",
                retryable=True,
                detail=str(exc),
            ) from exc

        _plog(
            "pipeline.agent.done",
            request_id=request_id,
            provider=draft.provider,
            draft_chars=len(draft.text),
            duration_ms=draft.duration_ms,
        )

        try:
            consenso = await self._consenso.validate(
                user_transcript=stt.text,
                draft_response=draft.text,
                locale=locale,
                request_id=request_id,
            )
        except Exception as exc:  # noqa: BLE001
            raise PipelineError(
                "Consenso Alfa failed",
                stage="consenso_alfa",
                retryable=True,
                detail=str(exc),
            ) from exc

        # Quorum reject → speak safe fallback (never the unvalidated draft).
        speak_text = consenso.final_text
        _plog(
            "pipeline.consenso.done",
            request_id=request_id,
            approved=consenso.approved,
            used_fallback=not consenso.approved and not consenso.skipped,
            agreement_ratio=consenso.agreement_ratio,
            duration_ms=consenso.duration_ms,
        )

        try:
            tts = await self._tts.synthesize(speak_text)
        except PipelineError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PipelineError(
                "TTS failed",
                stage="tts",
                retryable=True,
                detail=str(exc),
            ) from exc

        total_ms = int((time.perf_counter() - total_started) * 1000)
        _plog(
            "pipeline.done",
            request_id=request_id,
            total_ms=total_ms,
            stt_provider=stt.provider,
            tts_provider=tts.provider,
            consenso_approved=consenso.approved,
            tts_ms=tts.duration_ms,
        )

        return ProcessAudioResponse(
            transcript=stt.text,
            response_text=consenso.final_text,
            consenso=consenso,
            audio_base64=tts.audio_base64,
            audio_mime_type=tts.mime_type,
            latency=LatencyBreakdown(
                stt_ms=stt.duration_ms,
                consenso_ms=consenso.duration_ms,
                agent_ms=draft.duration_ms,
                tts_ms=tts.duration_ms,
                total_ms=total_ms,
            ),
            meta=ProcessAudioMeta(
                request_id=request_id,
                pipeline_mode=self._settings.pipeline_mode,
                stt_provider=stt.provider,
                tts_provider=tts.provider,
                consenso_enabled=self._settings.consenso_enabled,
                depin_attestation=None,
            ),
        )
