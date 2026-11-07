"""
Gemini cognitive engine — modular draft generator for the voice pipeline.

Uses the official `google-genai` async client (`Client.aio`).
Missing/invalid GEMINI_API_KEY → RecoverableProviderError (safe pipeline path).
Never log the API key value.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.config import Settings
from app.core.config import is_valid_gemini_api_key, normalize_secret
from app.models.schemas import ToolInvocation
from app.services.resilience import RecoverableProviderError, classify_provider_failure

logger = logging.getLogger("aether.gemini")

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

AETHER_GEMINI_SYSTEM = (
    "Você é o Aether — copiloto técnico avançado, articulado e direto, "
    "para headsets Bluetooth genéricos. "
    "Responda no idioma do utilizador (padrão: português pt-BR). "
    "Preferencialmente UMA frase falável (baixa latência de TTS). "
    "Sem clichês de assistente genérico («como IA», «fico feliz em ajudar», etc.). "
    "\n\n"
    "Arquitetura real deste produto (cite só o que for verdade): "
    "STT Whisper → motor cognitivo Gemini (gemini-2.5-flash) e/ou GPT tools → "
    "Consenso Alfa → TTS OpenAI (tts-1-hd / nova); memória adaptativa local (Chroma/RAG); "
    "auditoria SQLite (SessionLogs + latências STT·Agent·Consenso·TTS). "
    "Não invente notas/tarefas a partir de falas comuns; "
    "só trate memória quando o utilizador pedir explicitamente salvar/anotar/lembrar. "
    "Nunca invente segredos nem peça ações destrutivas."
)


@dataclass
class GeminiTurnResult:
    text: str
    duration_ms: int
    provider: str = "gemini-2.5-flash"
    tools: list[ToolInvocation] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


class GeminiGateway:
    """Async Gemini draft generator (Consenso Alfa runs downstream in the pipeline)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def model(self) -> str:
        return (self._settings.gemini_model or DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL

    def available(self) -> bool:
        return self._settings.has_valid_gemini_key()

    async def generate(
        self,
        transcript: str,
        *,
        locale: str = "pt-BR",
        memory_context: str = "",
        sqlite_context: str = "",
        client_id: str = "default",
        request_id: str | None = None,
        system_instruction: str | None = None,
    ) -> GeminiTurnResult:
        started = time.perf_counter()
        cleaned = " ".join((transcript or "").split())
        if not cleaned:
            return GeminiTurnResult(
                text=(
                    "Não capturei áudio claro do seu headset. "
                    "Fale novamente perto do microfone Bluetooth."
                ),
                duration_ms=0,
                provider=f"{self.model}-empty",
            )

        key = normalize_secret(self._settings.gemini_api_key)
        if not is_valid_gemini_api_key(key):
            raise RecoverableProviderError(
                "agent",
                "missing_gemini_api_key: set GEMINI_API_KEY in backend/.env",
                provider=self.model,
            )

        user_parts: list[str] = []
        if memory_context.strip():
            user_parts.append(memory_context.strip())
        if sqlite_context.strip():
            user_parts.append(sqlite_context.strip())
        user_parts.append(f"Locale: {locale}")
        user_parts.append(f"client_id: {client_id}")
        user_parts.append(f"User said: {cleaned}")
        user_prompt = "\n\n".join(user_parts)
        system = (system_instruction or AETHER_GEMINI_SYSTEM).strip()

        try:
            text, raw_meta = await self._call_gemini(
                api_key=key,
                system=system,
                user_prompt=user_prompt,
            )
        except RecoverableProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("agent", self.model, exc) from exc

        if not text.strip():
            text = (
                "Aether online. Recebi o pedido via Gemini, "
                "mas a resposta veio vazia. Pode repetir?"
            )

        elapsed = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gemini.generate.done model=%s chars=%s duration_ms=%s request_id=%s",
            self.model,
            len(text),
            elapsed,
            request_id,
        )
        return GeminiTurnResult(
            text=text.strip(),
            duration_ms=elapsed,
            provider=self.model,
            tools=[],
            raw=raw_meta,
        )

    async def _call_gemini(
        self,
        *,
        api_key: str,
        system: str,
        user_prompt: str,
    ) -> tuple[str, dict[str, Any]]:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover
            raise RecoverableProviderError(
                "agent",
                f"google_genai_package_missing: {exc}",
                provider=self.model,
            ) from exc

        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.4,
            max_output_tokens=400,
        )

        async def _once() -> Any:
            return await client.aio.models.generate_content(
                model=self.model,
                contents=user_prompt,
                config=config,
            )

        try:
            response = await asyncio.wait_for(
                _once(),
                timeout=max(5.0, self._settings.request_timeout_ms / 1000.0),
            )
        except TimeoutError as exc:
            raise RecoverableProviderError(
                "agent",
                "gemini_timeout",
                provider=self.model,
            ) from exc
        finally:
            try:
                await client.aio.aclose()
            except Exception:  # noqa: BLE001
                pass

        text = (getattr(response, "text", None) or "").strip()
        if not text:
            # Fallback extract from candidates
            try:
                cands = getattr(response, "candidates", None) or []
                for cand in cands:
                    content = getattr(cand, "content", None)
                    parts = getattr(content, "parts", None) or []
                    for part in parts:
                        piece = getattr(part, "text", None)
                        if piece:
                            text += str(piece)
            except Exception:  # noqa: BLE001
                pass
            text = text.strip()

        meta = {
            "model": self.model,
            "has_text": bool(text),
        }
        return text, meta


def build_sqlite_context(
    *,
    client_id: str = "default",
    limit: int = 5,
) -> str:
    """Optional recent SessionLogs block for Gemini (best-effort)."""
    try:
        from app.db.store import list_recent_sessions

        items = list_recent_sessions(limit=limit, client_id=client_id)
    except Exception as exc:  # noqa: BLE001
        logger.debug("sqlite context unavailable: %s", exc)
        return ""
    if not items:
        return ""
    lines = ["[Recent session history — SQLite SessionLogs]"]
    for item in reversed(items):  # chronological
        t = (item.get("transcription") or "")[:120]
        a = (item.get("agent_response") or "")[:160]
        if t or a:
            lines.append(f"- User: {t}")
            lines.append(f"  Aether: {a}")
    return "\n".join(lines) if len(lines) > 1 else ""
