"""Gemini multimodal speech-to-text."""

from __future__ import annotations

import asyncio
import logging
import time

from app.config import Settings
from app.core.config import is_valid_gemini_api_key, normalize_secret
from app.models.schemas import SttResult
from app.services.resilience import RecoverableProviderError, classify_provider_failure

logger = logging.getLogger("aether.stt.gemini")

DEFAULT_STT_MODEL = "gemini-3.5-flash-lite"


class GeminiStt:
    """Transcribe headset audio via Gemini multimodal generate_content."""

    name = "gemini-stt"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        filename: str,
        content_type: str,
        language: str | None = None,
    ) -> SttResult:
        started = time.perf_counter()
        key = normalize_secret(self._settings.gemini_api_key)
        if not is_valid_gemini_api_key(key):
            raise RecoverableProviderError(
                "stt",
                "missing_gemini_api_key: set GEMINI_API_KEY in backend/.env",
                provider=self.name,
            )

        model = (self._settings.gemini_stt_model or DEFAULT_STT_MODEL).strip() or DEFAULT_STT_MODEL
        mime = (content_type or "audio/webm").split(";")[0].strip() or "audio/webm"
        lang = language or self._settings.default_language
        prompt = (
            f"Transcreva fielmente o áudio falado (idioma preferencial: {lang}). "
            "Responda APENAS com o texto da transcrição, sem aspas nem comentários. "
            "Se não houver fala inteligível, responda com uma string vazia."
        )

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover
            raise RecoverableProviderError(
                "stt",
                f"google_genai_package_missing: {exc}",
                provider=self.name,
            ) from exc

        client = genai.Client(api_key=key)

        # google-genai 3.x enables Automatic Function Calling by default; AFC can
        # spin for minutes on multimodal STT and starve the HUD reply path.
        stt_timeout_s = min(45.0, max(8.0, self._settings.request_timeout_ms / 1000.0))

        async def _once() -> str:
            response = await client.aio.models.generate_content(
                model=model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_bytes(data=audio_bytes, mime_type=mime),
                            types.Part.from_text(text=prompt),
                        ],
                    )
                ],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=1024,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                ),
            )
            return (getattr(response, "text", None) or "").strip()

        logger.info(
            "[aether:stage] gemini.stt.start model=%s bytes=%s mime=%s timeout_s=%.1f",
            model,
            len(audio_bytes),
            mime,
            stt_timeout_s,
        )
        try:
            text = await asyncio.wait_for(
                _once(),
                timeout=stt_timeout_s,
            )
        except TimeoutError as exc:
            raise RecoverableProviderError(
                "stt",
                "gemini_stt_timeout",
                provider=self.name,
            ) from exc
        except RecoverableProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("stt", self.name, exc) from exc
        finally:
            try:
                await client.aio.aclose()
            except Exception:  # noqa: BLE001
                pass

        elapsed = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gemini.stt.done model=%s chars=%s bytes=%s duration_ms=%s",
            model,
            len(text),
            len(audio_bytes),
            elapsed,
        )
        return SttResult(
            text=text,
            language=lang,
            confidence=0.9 if text else 0.0,
            provider=self.name,
            duration_ms=elapsed,
            raw={
                "model": model,
                "filename": filename,
                "content_type": mime,
                "bytes": len(audio_bytes),
            },
        )
