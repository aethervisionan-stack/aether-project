"""End-to-end audio pipeline: STT → memory → agent → Consenso Alfa → TTS."""

from __future__ import annotations

import json
import logging
import time
import uuid

from app.config import Settings
from app.core.memory import AdaptiveMemory, get_adaptive_memory
from app.models.schemas import (
    ConsensoResult,
    LatencyBreakdown,
    ProcessAudioMeta,
    ProcessAudioResponse,
    SttResult,
    ToolInvocation,
)
from app.services.agent_service import AgentService
from app.services.consenso_alfa import ConsensoAlfa
from app.services.resilience import (
    API_FAILURE_FALLBACK_PT,
    PipelineError,
    RecoverableProviderError,
    log_provider_error,
)
from app.services.stt import SttProviderProtocol
from app.services.tts import TtsProviderProtocol
from app.services.tts.mock import MockTts

logger = logging.getLogger("aether.pipeline")


def _plog(event: str, **fields: object) -> None:
    logger.info("%s", json.dumps({"event": event, **fields}, ensure_ascii=False, default=str))


def _latency_from_consenso(consenso: ConsensoResult) -> dict[str, int]:
    by_role = {a.agent_role: a.duration_ms for a in consenso.agent_latencies}
    if not by_role:
        by_role = {v.agent_role: v.duration_ms for v in consenso.votes}
    return by_role


class AudioPipeline:
    def __init__(
        self,
        settings: Settings,
        stt: SttProviderProtocol,
        tts: TtsProviderProtocol,
        consenso: ConsensoAlfa,
        agent_service: AgentService | None = None,
        memory: AdaptiveMemory | None = None,
        **legacy: object,
    ) -> None:
        self._settings = settings
        self._stt = stt
        self._tts = tts
        self._consenso = consenso
        self._memory = memory
        self._mock_tts = MockTts(settings)
        # Backward-compatible: tests may still pass agent=ResponseAgent(...)
        if agent_service is not None:
            self._agent_service = agent_service
        elif "agent" in legacy and legacy["agent"] is not None:
            # Wrap old ResponseAgent-style tests: AgentService still preferred.
            self._agent_service = AgentService(
                settings=settings,
                consenso=consenso,
                memory=memory,
            )
        else:
            self._agent_service = AgentService(
                settings=settings,
                consenso=consenso,
                memory=memory,
            )

    def _memory_or_none(self) -> AdaptiveMemory | None:
        if not self._settings.memory_enabled:
            return None
        if self._memory is not None:
            return self._memory
        try:
            return get_adaptive_memory()
        except Exception as exc:  # noqa: BLE001
            logger.warning("memory unavailable: %s", exc)
            return None

    async def process(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: str,
        language: str | None = None,
        locale: str = "pt-BR",
        client_id: str = "default",
    ) -> ProcessAudioResponse:
        request_id = str(uuid.uuid4())
        total_started = time.perf_counter()
        used_safe_fallback = False
        fallback_reason: str | None = None

        _plog(
            "pipeline.start",
            request_id=request_id,
            filename=filename,
            content_type=content_type,
            bytes=len(audio_bytes),
            locale=locale,
            client_id=client_id,
            use_mock_audio=self._settings.use_mock_audio,
            stt=self._settings.effective_stt_provider(),
            tts=self._settings.effective_tts_provider(),
            openai_key_configured=bool(self._settings.openai_api_key.strip()),
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

        # Real mode without key: fail clearly — never silent mock Whisper success.
        if (
            not self._settings.use_mock_audio
            and not self._settings.has_valid_openai_key()
            and self._settings.effective_stt_provider() == "openai"
        ):
            log_provider_error(
                stage="stt",
                provider="openai-whisper",
                detail="invalid_api_key: OPENAI_API_KEY missing/invalid — set sk-… in backend/.env",
                request_id=request_id,
                error_type="invalid_api_key",
            )
            used_safe_fallback = True
            fallback_reason = "stt:invalid_api_key: OPENAI_API_KEY empty"
            stt = SttResult(
                text="",
                language=language or self._settings.whisper_language,
                confidence=0.0,
                provider="openai-whisper",
                duration_ms=0,
                raw={"fallback": True, "detail": "OPENAI_API_KEY empty"},
            )
            return await self._safe_response(
                request_id=request_id,
                total_started=total_started,
                stt=stt,
                response_text=API_FAILURE_FALLBACK_PT,
                consenso=ConsensoResult(
                    approved=False,
                    agreement_ratio=0.0,
                    final_text=API_FAILURE_FALLBACK_PT,
                    votes=[],
                    hallucination_flags=["missing_openai_api_key"],
                    duration_ms=0,
                    skipped=True,
                    agent_latencies=[],
                ),
                used_safe_fallback=True,
                fallback_reason=fallback_reason,
                agent_ms=0,
            )

        # --- STT (recoverable on real API failure) ---
        try:
            stt = await self._stt.transcribe(
                audio_bytes,
                filename=filename,
                content_type=content_type,
                language=language,
            )
        except RecoverableProviderError as exc:
            log_provider_error(
                stage="stt",
                provider=exc.provider or "stt",
                detail=exc.detail,
                request_id=request_id,
                error_type="recoverable_stt",
            )
            used_safe_fallback = True
            fallback_reason = f"stt:{exc.detail}"
            stt = SttResult(
                text="",
                language=language or self._settings.whisper_language,
                confidence=0.0,
                provider=exc.provider or "stt-fallback",
                duration_ms=0,
                raw={"fallback": True, "detail": exc.detail},
            )
        except PipelineError:
            raise
        except Exception as exc:  # noqa: BLE001
            log_provider_error(
                stage="stt",
                provider=getattr(self._stt, "name", "stt"),
                detail=str(exc),
                request_id=request_id,
                error_type="unexpected_stt",
            )
            used_safe_fallback = True
            fallback_reason = f"stt:{type(exc).__name__}: {exc}"
            stt = SttResult(
                text="",
                language=language or self._settings.whisper_language,
                confidence=0.0,
                provider="stt-fallback",
                duration_ms=0,
                raw={"fallback": True, "detail": str(exc)},
            )

        _plog(
            "pipeline.stt.done",
            request_id=request_id,
            provider=stt.provider,
            chars=len(stt.text),
            confidence=stt.confidence,
            duration_ms=stt.duration_ms,
            fallback=used_safe_fallback and not stt.text,
        )

        if used_safe_fallback and not stt.text:
            return await self._safe_response(
                request_id=request_id,
                total_started=total_started,
                stt=stt,
                response_text=API_FAILURE_FALLBACK_PT,
                consenso=ConsensoResult(
                    approved=False,
                    agreement_ratio=0.0,
                    final_text=API_FAILURE_FALLBACK_PT,
                    votes=[],
                    hallucination_flags=["stt_provider_failure"],
                    duration_ms=0,
                    skipped=True,
                    agent_latencies=[],
                ),
                used_safe_fallback=True,
                fallback_reason=fallback_reason,
                agent_ms=0,
            )

        # --- Adaptive memory / client DNA (before gpt-4o-mini) ---
        memory = self._memory_or_none()
        memory_context = ""
        if memory and memory.available and stt.text:
            hits = memory.search_context(stt.text, client_id=client_id)
            # Inject most relevant tagged notes as learned preferences for gpt-4o-mini
            memory_context = memory.format_learned_preferences_prompt(hits) or memory.format_context_block(
                hits
            )
            memory.extract_and_store_preferences(stt.text, client_id=client_id)
            _plog(
                "pipeline.memory.loaded",
                request_id=request_id,
                hits=len(hits),
                client_id=client_id,
                tags=[h.metadata.get("tag") for h in hits if h.metadata.get("tag")],
            )

        tools: list[ToolInvocation] = []
        try:
            turn = await self._agent_service.run(
                stt.text,
                locale=locale,
                memory_context=memory_context,
                client_id=client_id,
                request_id=request_id,
            )
            tools = list(turn.tools)
        except RecoverableProviderError as exc:
            log_provider_error(
                stage="agent",
                provider=exc.provider or "gpt-4o-mini",
                detail=exc.detail,
                request_id=request_id,
                error_type="recoverable_agent",
            )
            used_safe_fallback = True
            fallback_reason = fallback_reason or f"agent:{exc.detail}"
            return await self._safe_response(
                request_id=request_id,
                total_started=total_started,
                stt=stt,
                response_text=API_FAILURE_FALLBACK_PT,
                consenso=ConsensoResult(
                    approved=False,
                    agreement_ratio=0.0,
                    final_text=API_FAILURE_FALLBACK_PT,
                    votes=[],
                    hallucination_flags=["agent_provider_failure"],
                    duration_ms=0,
                    skipped=True,
                    agent_latencies=[],
                ),
                used_safe_fallback=True,
                fallback_reason=fallback_reason,
                agent_ms=0,
                tools=tools,
            )
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
            provider=turn.provider,
            draft_chars=len(turn.text),
            duration_ms=turn.duration_ms,
            tools_invoked=len(tools),
            tools_executed=sum(1 for t in tools if t.executed),
        )

        try:
            consenso = await self._consenso.validate(
                user_transcript=stt.text,
                draft_response=turn.text,
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

        if not consenso.approved and not consenso.skipped:
            used_safe_fallback = True
            fallback_reason = fallback_reason or "consenso_quorum_rejected"

        speak_text = consenso.final_text
        _plog(
            "pipeline.consenso.done",
            request_id=request_id,
            approved=consenso.approved,
            used_fallback=not consenso.approved and not consenso.skipped,
            agreement_ratio=consenso.agreement_ratio,
            duration_ms=consenso.duration_ms,
            agent_latencies_ms={a.agent_role: a.duration_ms for a in consenso.agent_latencies},
        )

        # --- TTS (recoverable → mock WAV for safe text) ---
        try:
            tts = await self._tts.synthesize(speak_text)
        except RecoverableProviderError as exc:
            log_provider_error(
                stage="tts",
                provider=exc.provider or "tts",
                detail=exc.detail,
                request_id=request_id,
                error_type="recoverable_tts",
            )
            used_safe_fallback = True
            fallback_reason = fallback_reason or f"tts:{exc.detail}"
            speak_text = API_FAILURE_FALLBACK_PT
            tts = await self._mock_tts.synthesize(speak_text)
            consenso = consenso.model_copy(update={"final_text": speak_text})
        except PipelineError:
            raise
        except Exception as exc:  # noqa: BLE001
            log_provider_error(
                stage="tts",
                provider=getattr(self._tts, "name", "tts"),
                detail=str(exc),
                request_id=request_id,
                error_type="unexpected_tts",
            )
            used_safe_fallback = True
            fallback_reason = fallback_reason or f"tts:{type(exc).__name__}: {exc}"
            speak_text = API_FAILURE_FALLBACK_PT
            tts = await self._mock_tts.synthesize(speak_text)
            consenso = consenso.model_copy(update={"final_text": speak_text})

        # Persist interaction into client DNA after a successful spoken turn.
        if memory and memory.available and stt.text and consenso.final_text:
            memory.remember_interaction(
                transcript=stt.text,
                response=consenso.final_text,
                client_id=client_id,
                request_id=request_id,
            )

        total_ms = int((time.perf_counter() - total_started) * 1000)
        by_role = _latency_from_consenso(consenso)
        _plog(
            "pipeline.done",
            request_id=request_id,
            total_ms=total_ms,
            stt_provider=stt.provider,
            tts_provider=tts.provider,
            consenso_approved=consenso.approved,
            used_safe_fallback=used_safe_fallback,
            tts_ms=tts.duration_ms,
            audio_url=tts.audio_url,
            grounding_ms=by_role.get("factual_grounding", 0),
            safety_tone_ms=by_role.get("safety_tone", 0),
            consistency_ms=by_role.get("consistency", 0),
        )

        executed_count = sum(1 for t in tools if t.executed)
        return ProcessAudioResponse(
            transcript=stt.text,
            response_text=consenso.final_text,
            consenso=consenso,
            audio_base64=tts.audio_base64,
            audio_mime_type=tts.mime_type,
            audio_url=tts.audio_url,
            tools=tools,
            latency=LatencyBreakdown(
                stt_ms=stt.duration_ms,
                consenso_ms=consenso.duration_ms,
                agent_ms=turn.duration_ms,
                tts_ms=tts.duration_ms,
                total_ms=total_ms,
                consenso_grounding_ms=by_role.get("factual_grounding", 0),
                consenso_safety_tone_ms=by_role.get("safety_tone", 0),
                consenso_consistency_ms=by_role.get("consistency", 0),
                consenso_agents_ms=by_role,
            ),
            meta=ProcessAudioMeta(
                request_id=request_id,
                pipeline_mode=self._settings.pipeline_mode,
                use_mock_audio=self._settings.use_mock_audio,
                stt_provider=stt.provider,
                tts_provider=tts.provider,
                consenso_enabled=self._settings.consenso_enabled,
                used_safe_fallback=used_safe_fallback,
                fallback_reason=fallback_reason,
                depin_attestation=None,
                tools_invoked=bool(tools),
                tools_executed_count=executed_count,
            ),
        )

    async def _safe_response(
        self,
        *,
        request_id: str,
        total_started: float,
        stt: SttResult,
        response_text: str,
        consenso: ConsensoResult,
        used_safe_fallback: bool,
        fallback_reason: str | None,
        agent_ms: int,
        tools: list[ToolInvocation] | None = None,
    ) -> ProcessAudioResponse:
        tool_list = tools or []
        tts = await self._mock_tts.synthesize(response_text)
        total_ms = int((time.perf_counter() - total_started) * 1000)
        by_role = _latency_from_consenso(consenso)
        _plog(
            "pipeline.safe_fallback",
            request_id=request_id,
            reason=fallback_reason,
            total_ms=total_ms,
        )
        return ProcessAudioResponse(
            transcript=stt.text,
            response_text=response_text,
            consenso=consenso,
            audio_base64=tts.audio_base64,
            audio_mime_type=tts.mime_type,
            audio_url=tts.audio_url,
            tools=tool_list,
            latency=LatencyBreakdown(
                stt_ms=stt.duration_ms,
                consenso_ms=consenso.duration_ms,
                agent_ms=agent_ms,
                tts_ms=tts.duration_ms,
                total_ms=total_ms,
                consenso_grounding_ms=by_role.get("factual_grounding", 0),
                consenso_safety_tone_ms=by_role.get("safety_tone", 0),
                consenso_consistency_ms=by_role.get("consistency", 0),
                consenso_agents_ms=by_role,
            ),
            meta=ProcessAudioMeta(
                request_id=request_id,
                pipeline_mode=self._settings.pipeline_mode,
                use_mock_audio=self._settings.use_mock_audio,
                stt_provider=stt.provider,
                tts_provider=tts.provider,
                consenso_enabled=self._settings.consenso_enabled,
                used_safe_fallback=used_safe_fallback,
                fallback_reason=fallback_reason,
                depin_attestation=None,
                tools_invoked=bool(tool_list),
                tools_executed_count=sum(1 for t in tool_list if t.executed),
            ),
        )
