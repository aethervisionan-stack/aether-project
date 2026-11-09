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

    # --- Stripe (card subscription; never commit real secrets) ---
    stripe_secret_key: str = Field(default="", alias="STRIPE_SECRET_KEY")
    stripe_publishable_key: str = Field(default="", alias="STRIPE_PUBLISHABLE_KEY")
    stripe_webhook_secret: str = Field(default="", alias="STRIPE_WEBHOOK_SECRET")
    stripe_price_id: str = Field(default="", alias="STRIPE_PRICE_ID")
    stripe_success_url: str = Field(
        default="http://127.0.0.1:5173/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
        alias="STRIPE_SUCCESS_URL",
    )
    stripe_cancel_url: str = Field(
        default="http://127.0.0.1:5173/?checkout=cancel",
        alias="STRIPE_CANCEL_URL",
    )
    # --- TEMP TEST price (restore official later) ---
    # Official restore: STRIPE_CURRENCY=usd, STRIPE_UNIT_AMOUNT_CENTS=1999,
    # STRIPE_FORCE_UNIT_AMOUNT=false (and set STRIPE_PRICE_ID if you use a Dashboard Price).
    # TEMP: R$ 0,01 = 1 centavo BRL.
    stripe_currency: str = Field(default="brl", alias="STRIPE_CURRENCY")
    stripe_unit_amount_cents: int = Field(default=1, alias="STRIPE_UNIT_AMOUNT_CENTS")
    # When true, Checkout always uses price_data (ignores STRIPE_PRICE_ID) — TEMP TEST.
    stripe_force_unit_amount: bool = Field(default=True, alias="STRIPE_FORCE_UNIT_AMOUNT")

    # Local Gen-1 bypass when Stripe keys are absent (never enable in production).
    billing_dev_unlock: bool = Field(default=True, alias="BILLING_DEV_UNLOCK")

    # --- Solana tokenomics (70% treasury / 30% burn) ---
    treasury_wallet_address: str = Field(
        default="TreasuryWalletPubkeyPlaceholder1111111111111",
        alias="TREASURY_WALLET_ADDRESS",
    )
    vision_burn_address: str = Field(
        default="BurnAddressPubkeyPlaceholder111111111111111",
        alias="VISION_BURN_ADDRESS",
    )
    vision_mint_address: str = Field(
        default="VisionMintPubkeyPlaceholder1111111111111111",
        alias="VISION_MINT_ADDRESS",
    )
    solana_rpc_url: str = Field(
        default="https://api.devnet.solana.com",
        alias="SOLANA_RPC_URL",
    )
    # Base58 secret of the payer that funds treasury/burn transfers — leave empty for stub mode.
    solana_payer_secret_key: str = Field(default="", alias="SOLANA_PAYER_SECRET_KEY")
    # Rough VISION tokens credited per USD of subscription for Gen-1 distribution math.
    vision_tokens_per_usd: float = Field(default=100.0, alias="VISION_TOKENS_PER_USD")

    entitlements_path: str = Field(
        default="data/entitlements.json",
        alias="ENTITLEMENTS_PATH",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        raw = {o.strip() for o in self.cors_origins.split(",") if o.strip()}
        raw.update({"http://127.0.0.1:5173", "http://localhost:5173"})
        return sorted(raw)

    def has_api_key(self) -> bool:
        return bool(self.gemini_api_key.strip())

    def has_stripe(self) -> bool:
        return bool(self.stripe_secret_key.strip())

    def solana_live_transfers_enabled(self) -> bool:
        """Real on-chain transfers require an explicit payer secret (never invent one)."""
        return bool(self.solana_payer_secret_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
