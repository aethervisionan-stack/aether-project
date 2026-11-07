"""Runtime configuration via environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import (
    BACKEND_ENV_FILE,
    is_valid_gemini_api_key,
    load_backend_dotenv,
    normalize_secret,
)

PipelineMode = Literal["mock", "hybrid", "production"]
SttProvider = Literal["mock", "gemini"]
TtsProvider = Literal["mock", "gemini"]
CognitiveProvider = Literal["auto", "gemini"]

# Always permitted for the Vite control client (local Bluetooth test).
DEFAULT_VITE_CORS_ORIGINS: tuple[str, ...] = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)

# Load backend/.env by absolute path BEFORE Settings() reads the environment.
# Critical when uvicorn is started from the repo root (CWD ≠ backend/).
load_backend_dotenv(override=False)


class Settings(BaseSettings):
    """Typed settings for the FastAPI voice service (Gemini-only)."""

    model_config = SettingsConfigDict(
        # Absolute path — never depend on process CWD
        env_file=str(BACKEND_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8001
    log_level: str = "info"
    cors_origins: str = ",".join(DEFAULT_VITE_CORS_ORIGINS)

    # Primary audio switch
    # true  → local mock STT/TTS (no paid APIs) + deterministic cognitive draft
    # false → Gemini STT + Gemini cognitive + Gemini TTS
    use_mock_audio: bool = True

    pipeline_mode: PipelineMode = "mock"

    stt_provider: SttProvider = "mock"
    default_language: str = "pt"
    # Back-compat alias used by older call sites / mock STT
    whisper_language: str = "pt"

    consenso_enabled: bool = True
    consenso_min_agents: int = Field(default=2, ge=1, le=8)
    consenso_agreement_threshold: float = Field(default=0.66, ge=0.0, le=1.0)
    consenso_timeout_ms: int = Field(default=2500, ge=100)

    tts_provider: TtsProvider = "mock"
    tts_sample_rate: int = 24000
    tts_audio_dir: str = "data/tts_audio"

    # Cognitive engine — Gemini only (Flash / Pro)
    cognitive_provider: CognitiveProvider = "auto"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_mode: str = "flash"
    gemini_stt_model: str = "gemini-2.5-flash"
    gemini_tts_model: str = "gemini-2.5-flash-preview-tts"
    gemini_tts_voice: str = "Kore"
    gemini_inject_sqlite_context: bool = True

    # Adaptive memory (local ChromaDB)
    chroma_persist_dir: str = "data/chroma"
    memory_enabled: bool = True

    # Structured session persistence (SQLite relative to backend/)
    sqlite_path: str = "aether_vision.db"

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

    @field_validator(
        "gemini_api_key",
        "helius_api_key",
        mode="before",
    )
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

    def has_valid_gemini_key(self) -> bool:
        """True when GEMINI_API_KEY looks usable; never expose the secret."""
        return is_valid_gemini_api_key(self.gemini_api_key)

    def effective_cognitive_provider(self) -> Literal["gemini"]:
        """Cognitive draft engine is always Gemini (mock path uses local draft)."""
        return "gemini"

    def effective_stt_provider(self) -> SttProvider:
        if self.use_mock_audio:
            return "mock"
        if self.stt_provider == "gemini":
            return "gemini"
        return "gemini"

    def effective_tts_provider(self) -> TtsProvider:
        if self.use_mock_audio:
            return "mock"
        if self.tts_provider == "gemini":
            return "gemini"
        return "gemini"

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
