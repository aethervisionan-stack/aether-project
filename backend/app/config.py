"""Environment and runtime configuration for the Live WebSocket bridge."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_CORS = (
    "http://127.0.0.1:5173,"
    "http://localhost:5173"
)

AETHER_SYSTEM_INSTRUCTION = (
    "You are Aether — a HUD and spatial-audio copiloto. "
    "Reply in 1–3 short, direct, actionable sentences. "
    "No complex markdown, no long lists, no preamble. "
    "Match the user's language. Optimize for glanceable HUD text and spoken audio."
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    # Live-native bidirectional audio model (requires GEMINI_API_VERSION v1beta/v1alpha).
    gemini_live_model: str = Field(default="gemini-3.8-live", alias="GEMINI_LIVE_MODEL")
    # Live WebSocket path is not on the default GenAI API version — use v1beta.
    gemini_api_version: str = Field(default="v1beta", alias="GEMINI_API_VERSION")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    cors_origins: str = Field(default=DEFAULT_CORS, alias="CORS_ORIGINS")

    @property
    def cors_origin_list(self) -> list[str]:
        raw = {o.strip() for o in self.cors_origins.split(",") if o.strip()}
        raw.update({"http://127.0.0.1:5173", "http://localhost:5173"})
        return sorted(raw)

    def has_api_key(self) -> bool:
        return bool(self.gemini_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
