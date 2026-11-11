"""Environment and runtime configuration for the Live WebSocket bridge."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.persona.real_life_copilot import REAL_LIFE_COPILOT_INSTRUCTION

# Always load backend/.env regardless of process cwd.
_BACKEND_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

DEFAULT_CORS = (
    "http://127.0.0.1:5173,"
    "http://localhost:5173"
)

# Primary Live persona — Strategic Real-Life Co-Pilot Engine (v0.4.1).
# Source of truth: app.persona.real_life_copilot.
AETHER_SYSTEM_INSTRUCTION = REAL_LIFE_COPILOT_INSTRUCTION


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ENV_FILE),
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
    # Local-dev default: unlock Live/HUD/tools without Subscribe.
    # Set BYPASS_SUBSCRIPTION_CHECK=false before sk_live_ / production — Stripe code stays intact.
    bypass_subscription_check: bool = Field(
        default=True,
        alias="BYPASS_SUBSCRIPTION_CHECK",
    )

    # --- Solana tokenomics (70% treasury / 30% burn) ---
    treasury_wallet_address: str = Field(
        default="AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa",
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
    # Preferred public RPC for Gen-1 treasury HUD balance (mainnet official wallet).
    # Falls back through Ankr / PublicNode / Solana Labs if this endpoint 403s.
    treasury_rpc_url: str = Field(
        default="https://rpc.ankr.com/solana",
        alias="TREASURY_RPC_URL",
    )
    # Base58 secret of the payer that funds treasury/burn transfers — leave empty for stub mode.
    solana_payer_secret_key: str = Field(default="", alias="SOLANA_PAYER_SECRET_KEY")
    # Rough VISION tokens credited per USD of subscription for Gen-1 distribution math.
    vision_tokens_per_usd: float = Field(default=100.0, alias="VISION_TOKENS_PER_USD")

    entitlements_path: str = Field(
        default="data/entitlements.json",
        alias="ENTITLEMENTS_PATH",
    )
    # Long-term memory / preference learning (JSON; async writes only).
    memory_path: str = Field(
        default="data/memory.json",
        alias="MEMORY_PATH",
    )
    memory_enabled: bool = Field(default=True, alias="MEMORY_ENABLED")

    @property
    def cors_origin_list(self) -> list[str]:
        raw = {o.strip() for o in self.cors_origins.split(",") if o.strip()}
        raw.update({"http://127.0.0.1:5173", "http://localhost:5173"})
        return sorted(raw)

    def has_api_key(self) -> bool:
        return bool(self.gemini_api_key.strip())

    def has_stripe(self) -> bool:
        """True for a real-looking secret (sk_test_ or sk_live_). Placeholders do not count."""
        key = self.stripe_secret_key.strip()
        if not key:
            return False
        lowered = key.lower()
        if (
            "placeholder" in lowered
            or "replace_me" in lowered
            or "not_a_real" in lowered
            or key.endswith("...")
        ):
            return False
        return key.startswith("sk_test_") or key.startswith("sk_live_")

    def stripe_mode(self) -> str:
        """
        Public mode label derived from STRIPE_SECRET_KEY alone (no code change to flip).
        - off: missing / placeholder
        - test: sk_test_
        - live: sk_live_ (paste after MEI / production keys are ready — do not invent)
        """
        if not self.has_stripe():
            return "off"
        key = self.stripe_secret_key.strip()
        if key.startswith("sk_live_"):
            return "live"
        return "test"

    def publishable_key_public(self) -> str | None:
        """
        Only expose a real-looking publishable key to the client.
        Incomplete placeholders like `pk_test_` stay hidden — Session.create does not need them.
        """
        if not self.has_stripe():
            return None
        pk = self.stripe_publishable_key.strip()
        if not pk:
            return None
        lowered = pk.lower()
        if (
            "placeholder" in lowered
            or "replace_me" in lowered
            or "not_a_real" in lowered
            or pk.endswith("...")
            or pk in {"pk_test_", "pk_live_"}
            or len(pk) < 20
        ):
            return None
        if not (pk.startswith("pk_test_") or pk.startswith("pk_live_")):
            return None
        return pk

    def stripe_mock_checkout_enabled(self) -> bool:
        """Local/dev fallback when no real Stripe secret is configured."""
        return (not self.has_stripe()) and bool(self.billing_dev_unlock)

    def billing_dev_tools_enabled(self) -> bool:
        """Reset / local tools — allowed with test Stripe when BILLING_DEV_UNLOCK=true."""
        return bool(self.billing_dev_unlock)

    def subscription_check_bypassed(self) -> bool:
        """Local-dev paywall skip — re-enable by setting BYPASS_SUBSCRIPTION_CHECK=false."""
        return bool(self.bypass_subscription_check)

    def local_feature_unlock(self) -> bool:
        """
        Full local-dev unlock for HUD panels, tool registry, and test routes.
        True when paywall bypass or BILLING_DEV_UNLOCK is on (default local).
        """
        return self.subscription_check_bypassed() or self.billing_dev_tools_enabled()

    def unlocked_surfaces(self) -> dict[str, bool]:
        """Public map of surfaces exposed under local unlock (no secrets)."""
        unlocked = self.local_feature_unlock()
        return {
            "live_hud": unlocked,
            "memory_inspector": unlocked,
            "hardware_profile": unlocked,
            "latency_tracker": unlocked,
            "notification_history": unlocked,
            "tool_registry": unlocked,
            "async_cot": unlocked,
            "multimodal_ws": unlocked,
            "geolocation": unlocked,
            "productivity": unlocked,
            "deep_research": unlocked,
            "canvas_editor": unlocked,
            "vad_open_mic": unlocked,
            "push_to_talk": unlocked,
            "test_routes": unlocked,
            "dev_unlock_endpoint": unlocked,
        }

    def solana_live_transfers_enabled(self) -> bool:
        """Real on-chain transfers require an explicit payer secret (never invent one)."""
        return bool(self.solana_payer_secret_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
