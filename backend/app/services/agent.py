"""Primary response agent — gpt-4o-mini draft (pre-Consenso) with adaptive DNA."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from app.config import Settings
from app.services.resilience import RecoverableProviderError, classify_provider_failure


@dataclass(frozen=True)
class AgentDraft:
    text: str
    duration_ms: int
    provider: str = "gpt-4o-mini"


class ResponseAgent:
    """
    Generates a draft spoken reply from the user transcript.

    When OPENAI_API_KEY is set, uses gpt-4o-mini with optional Chroma DNA context.
    Empty key in real mode raises RecoverableProviderError (safe spoken fallback).
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings

    async def draft(
        self,
        transcript: str,
        *,
        locale: str = "pt-BR",
        memory_context: str = "",
        settings: Settings | None = None,
    ) -> AgentDraft:
        cfg = settings or self._settings
        if cfg is None:
            from app.config import get_settings

            cfg = get_settings()

        # Explicit mock path only when mock audio is enabled.
        if cfg.use_mock_audio:
            return await self._mock_draft(transcript, locale=locale)

        if not cfg.has_valid_openai_key():
            raise RecoverableProviderError(
                "agent",
                "invalid_api_key: OPENAI_API_KEY missing/invalid — paste sk-… in backend/.env",
                provider="gpt-4o-mini",
            )

        started = time.perf_counter()
        cleaned = " ".join(transcript.split())
        if not cleaned:
            text = (
                "Não capturei áudio claro do seu headset. "
                "Fale novamente perto do microfone Bluetooth."
            )
            return AgentDraft(text=text, duration_ms=0, provider="gpt-4o-mini-empty")

        system = (
            "You are Aether Vision — a direct, concise, smart voice assistant for Bluetooth headsets. "
            "Reply in the user's language (default Portuguese pt-BR). "
            "Keep answers short and speakable (ideally one sentence). "
            "Do NOT auto-categorize ordinary utterances as tarefa, nota, rotina, or preferência. "
            "Use client DNA / historical context only when it is already provided. "
            "Never invent API keys or claim actions you cannot perform."
        )
        user_parts = []
        if memory_context.strip():
            user_parts.append(memory_context.strip())
        user_parts.append(f"Locale: {locale}")
        user_parts.append(f"User said: {cleaned}")

        try:
            from openai import AsyncOpenAI
        except ImportError as exc:  # pragma: no cover
            raise RecoverableProviderError(
                "agent",
                f"openai_package_missing: {exc}",
                provider="gpt-4o-mini",
            ) from exc

        client = AsyncOpenAI(api_key=cfg.openai_api_key)
        try:
            completion = await client.chat.completions.create(
                model=cfg.openai_agent_model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": "\n\n".join(user_parts)},
                ],
                temperature=0.4,
                max_tokens=220,
            )
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("agent", "gpt-4o-mini", exc) from exc

        text = (completion.choices[0].message.content or "").strip()
        if not text:
            text = (
                "Aether Vision online. Recebi o seu pedido, "
                "mas não consegui formular uma resposta clara. Pode repetir?"
            )
        elapsed = int((time.perf_counter() - started) * 1000)
        return AgentDraft(text=text, duration_ms=elapsed, provider="gpt-4o-mini")

    async def _mock_draft(self, transcript: str, *, locale: str) -> AgentDraft:
        started = time.perf_counter()
        await asyncio.sleep(0.02)
        cleaned = " ".join(transcript.split())
        if not cleaned:
            text = (
                "Não capturei áudio claro do seu headset. "
                "Fale novamente perto do microfone Bluetooth."
            )
        else:
            text = (
                "Aether Vision online. Ouvi: "
                f"«{cleaned[:220]}». "
                "Consenso Alfa está validando a resposta antes da síntese de voz."
            )
        elapsed = int((time.perf_counter() - started) * 1000)
        _ = locale
        return AgentDraft(text=text, duration_ms=elapsed, provider="aether-mvp-agent")
