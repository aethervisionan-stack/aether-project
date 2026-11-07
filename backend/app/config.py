"""Runtime configuration via environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PipelineMode = Literal["mock", "hybrid", "production"]
SttProvider = Literal["mock", "openai", "local"]
TtsProvider = Literal["mock", "openai"]


class Settings(BaseSettings):
    """Typed settings for the FastAPI voice service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    pipeline_mode: PipelineMode = "mock"

    stt_provider: SttProvider = "mock"
    openai_api_key: str = ""
    openai_stt_model: str = "whisper-1"
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_language: str = "pt"

    consenso_enabled: bool = True
    consenso_min_agents: int = Field(default=2, ge=1, le=8)
    consenso_agreement_threshold: float = Field(default=0.66, ge=0.0, le=1.0)
    consenso_timeout_ms: int = Field(default=2500, ge=100)

    tts_provider: TtsProvider = "mock"
    openai_tts_model: str = "gpt-4o-mini-tts"
    openai_tts_voice: str = "alloy"
    tts_sample_rate: int = 24000

    request_timeout_ms: int = Field(default=30_000, ge=1000)
    max_audio_bytes: int = Field(default=10_485_760, ge=1024)
    retry_attempts: int = Field(default=2, ge=0, le=5)
    retry_backoff_ms: int = Field(default=200, ge=0)

    # Phase 2+ DePIN/Solana seams — declared but unused in Phase 1
    deployment_network: str = ""
    solana_rpc_url: str = ""
    aether_agent_wallet: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_origins(cls, value: object) -> object:
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def effective_stt_provider(self) -> SttProvider:
        if self.pipeline_mode == "mock":
            return "mock"
        return self.stt_provider

    def effective_tts_provider(self) -> TtsProvider:
        if self.pipeline_mode == "mock":
            return "mock"
        if self.pipeline_mode == "hybrid" and self.tts_provider != "mock":
            # hybrid allows real STT with mock TTS when no TTS key is ready
            if not self.openai_api_key and self.tts_provider == "openai":
                return "mock"
        return self.tts_provider


@lru_cache
def get_settings() -> Settings:
    return Settings()
