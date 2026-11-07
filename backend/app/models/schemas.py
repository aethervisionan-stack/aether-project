"""Shared API and pipeline schemas (Pydantic v2)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PipelineStage(str, Enum):
    STT = "stt"
    CONSENSO = "consenso_alfa"
    AGENT = "agent"
    TTS = "tts"
    TOTAL = "total"


class SttResult(BaseModel):
    text: str
    language: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    provider: str
    duration_ms: int = 0
    raw: dict[str, Any] = Field(default_factory=dict)


class AgentVote(BaseModel):
    """Single validator vote inside Consenso Alfa."""

    agent_id: str
    agent_role: str
    approved: bool
    score: float = Field(ge=0.0, le=1.0)
    rationale: str
    revised_text: str | None = None
    duration_ms: int = 0


class ConsensoAgentLatency(BaseModel):
    """Per-sub-agent validation speed for frontend / dev console."""

    agent_id: str
    agent_role: str
    duration_ms: int = Field(ge=0)
    label: str = ""


class ConsensoResult(BaseModel):
    """Multi-agent validation outcome before a response is spoken."""

    approved: bool
    agreement_ratio: float = Field(ge=0.0, le=1.0)
    final_text: str
    votes: list[AgentVote] = Field(default_factory=list)
    hallucination_flags: list[str] = Field(default_factory=list)
    duration_ms: int = 0
    skipped: bool = False
    agent_latencies: list[ConsensoAgentLatency] = Field(default_factory=list)


class TtsResult(BaseModel):
    audio_base64: str
    mime_type: str = "audio/wav"
    sample_rate: int = 24000
    provider: str
    duration_ms: int = 0
    character_count: int = 0
    filename: str | None = None
    audio_url: str | None = None


class LatencyBreakdown(BaseModel):
    stt_ms: int = 0
    consenso_ms: int = 0
    agent_ms: int = 0
    tts_ms: int = 0
    total_ms: int = 0
    # Per Consenso Alfa sub-agent (ms) — mirrored for easy frontend binding
    consenso_grounding_ms: int = 0
    consenso_safety_tone_ms: int = 0
    consenso_consistency_ms: int = 0
    consenso_agents_ms: dict[str, int] = Field(default_factory=dict)


class ProcessAudioMeta(BaseModel):
    request_id: str
    pipeline_mode: str
    use_mock_audio: bool = True
    stt_provider: str
    tts_provider: str
    consenso_enabled: bool
    used_safe_fallback: bool = False
    fallback_reason: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    # Seam for Phase 2+ DePIN/Solana attestation (null in Phase 1)
    depin_attestation: dict[str, Any] | None = None


class ProcessAudioResponse(BaseModel):
    """JSON envelope returned by POST /process-audio (audio embedded as base64)."""

    transcript: str
    response_text: str
    consenso: ConsensoResult
    audio_base64: str
    audio_mime_type: str = "audio/wav"
    audio_url: str | None = None
    latency: LatencyBreakdown
    meta: ProcessAudioMeta


class HealthResponse(BaseModel):
    status: str
    version: str
    pipeline_mode: str
    use_mock_audio: bool = True
    stt_provider: str
    tts_provider: str
    consenso_enabled: bool
    depin_ready: bool = False
    web3_rpc_configured: bool = False


class ErrorResponse(BaseModel):
    error: str
    detail: str
    request_id: str | None = None
    retryable: bool = False
    stage: PipelineStage | None = None
