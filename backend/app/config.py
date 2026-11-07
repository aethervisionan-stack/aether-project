"""Runtime configuration via environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import (
    BACKEND_ENV_FILE,
    is_valid_openai_api_key,
    load_backend_dotenv,
    normalize_secret,
)

PipelineMode = Literal["mock", "hybrid", "production"]
SttProvider = Literal["mock", "openai", "local"]
TtsProvider = Literal["mock", "openai", "elevenlabs"]

# Always permitted for the Vite control client (local Bluetooth test).
DEFAULT_VITE_CORS_ORIGINS: tuple[str, ...] = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)

# Load backend/.env by absolute path BEFORE Settings() reads the environment.
# Critical when uvicorn is started from the repo root (CWD ≠ backend/).
load_backend_dotenv(override=False)


class Settings(BaseSettings):
    """Typed settings for the FastAPI voice service."""

    model_config = SettingsConfigDict(
        # Absolute path — never depend on process CWD
        env_file=str(BACKEND_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    cors_origins: str = ",".join(DEFAULT_VITE_CORS_ORIGINS)

    # Primary audio switch (Phase 1+)
    # true  → simulated STT/TTS (no paid APIs)
    # false → OpenAI Whisper STT + ElevenLabs/OpenAI TTS
    use_mock_audio: bool = True

    # Legacy / fine-grained mode (honored when use_mock_audio=false)
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
    openai_tts_model: str = "tts-1"
    openai_tts_voice: str = "alloy"
    openai_agent_model: str = "gpt-4o-mini"
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_model_id: str = "eleven_multilingual_v2"
    elevenlabs_output_format: str = "mp3_44100_128"
    tts_sample_rate: int = 24000
    tts_audio_dir: str = "data/tts_audio"

    # Adaptive memory (local ChromaDB)
    chroma_persist_dir: str = "data/chroma"
    memory_enabled: bool = True

    request_timeout_ms: int = Field(default=30_000, ge=1000)
    max_audio_bytes: int = Field(default=10_485_760, ge=1024)
    retry_attempts: int = Field(default=2, ge=0, le=5)
    retry_backoff_ms: int = Field(default=200, ge=0)

    # Web3 / Solana prep (stubs — unused by voice pipeline)
    deployment_network: str = "solana-mainnet"
    solana_rpc_url: str = ""
    helius_rpc_url: str = ""
    helius_api_key: str = ""
    pyth_hermes_url: str = "https://hermes.pyth.network"
    jupiter_quote_api_url: str = "https://quote-api.jup.ag/v6"
    aether_agent_wallet: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_origins(cls, value: object) -> object:
        return value

    @field_validator("openai_api_key", "elevenlabs_api_key", mode="before")
    @classmethod
    def _normalize_secrets(cls, value: object) -> str:
        return normalize_secret(value)

    @property
    def cors_origin_list(self) -> list[str]:
        """Configured CORS origins plus Vite defaults (deduped, order preserved)."""
        configured = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        merged: list[str] = []
        for origin in [*configured, *DEFAULT_VITE_CORS_ORIGINS]:
            if origin not in merged:
                merged.append(origin)
        return merged

    def has_valid_openai_key(self) -> bool:
        """True when OPENAI_API_KEY looks usable (sk-…); never expose the secret."""
        return is_valid_openai_api_key(self.openai_api_key)

    def effective_stt_provider(self) -> SttProvider:
        if self.use_mock_audio:
            return "mock"
        if self.pipeline_mode == "mock" and self.stt_provider == "mock":
            # use_mock_audio=false wins over legacy PIPELINE_MODE=mock
            pass
        if self.stt_provider in ("openai", "local"):
            return self.stt_provider
        # Default real STT: OpenAI Whisper
        return "openai"

    def effective_tts_provider(self) -> TtsProvider:
        if self.use_mock_audio:
            return "mock"
        if self.tts_provider in ("openai", "elevenlabs"):
            return self.tts_provider
        # Prefer ElevenLabs when key present, else OpenAI Audio
        if self.elevenlabs_api_key:
            return "elevenlabs"
        return "openai"

    def resolved_solana_rpc(self) -> str:
        """Prefer Helius RPC when configured."""
        if self.helius_rpc_url:
            return self.helius_rpc_url
        return self.solana_rpc_url


@lru_cache
def get_settings() -> Settings:
    # Ensure dotenv is applied even if Settings was imported before main ran.
    load_backend_dotenv(override=False)
    return Settings()
