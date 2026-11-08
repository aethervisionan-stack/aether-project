"""Gemini native TTS (AUDIO modality) with local WAV fallback path in pipeline."""

from __future__ import annotations

import asyncio
import base64
import logging
import time

from app.config import Settings
from app.core.config import is_valid_gemini_api_key, normalize_secret
from app.models.schemas import TtsResult
from app.services.audio_store import save_tts_audio
from app.services.resilience import RecoverableProviderError, classify_provider_failure

logger = logging.getLogger("aether.tts.gemini")

DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts"
DEFAULT_VOICE = "Kore"


class GeminiTts:
    """Synthesize speech via Gemini response_modalities=['AUDIO']."""

    name = "gemini-tts"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def synthesize(self, text: str) -> TtsResult:
        started = time.perf_counter()
        cleaned = " ".join((text or "").split())
        if not cleaned:
            cleaned = "Aether online."

        key = normalize_secret(self._settings.gemini_api_key)
        if not is_valid_gemini_api_key(key):
            raise RecoverableProviderError(
                "tts",
                "missing_gemini_api_key: set GEMINI_API_KEY in backend/.env",
                provider=self.name,
            )

        model = (self._settings.gemini_tts_model or DEFAULT_TTS_MODEL).strip() or DEFAULT_TTS_MODEL
        voice = (self._settings.gemini_tts_voice or DEFAULT_VOICE).strip() or DEFAULT_VOICE

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover
            raise RecoverableProviderError(
                "tts",
                f"google_genai_package_missing: {exc}",
                provider=self.name,
            ) from exc

        client = genai.Client(api_key=key)
        config = types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                )
            ),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        async def _once() -> bytes:
            response = await client.aio.models.generate_content(
                model=model,
                contents=cleaned,
                config=config,
            )
            # Prefer inline audio parts
            cands = getattr(response, "candidates", None) or []
            for cand in cands:
                content = getattr(cand, "content", None)
                parts = getattr(content, "parts", None) or []
                for part in parts:
                    inline = getattr(part, "inline_data", None)
                    data = getattr(inline, "data", None) if inline is not None else None
                    if data:
                        if isinstance(data, str):
                            return base64.b64decode(data)
                        return bytes(data)
            raise RecoverableProviderError(
                "tts",
                "gemini_tts_empty_audio",
                provider=self.name,
            )

        try:
            audio_bytes = await asyncio.wait_for(
                _once(),
                timeout=max(5.0, self._settings.request_timeout_ms / 1000.0),
            )
        except TimeoutError as exc:
            raise RecoverableProviderError(
                "tts",
                "gemini_tts_timeout",
                provider=self.name,
            ) from exc
        except RecoverableProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise classify_provider_failure("tts", self.name, exc) from exc
        finally:
            try:
                await client.aio.aclose()
            except Exception:  # noqa: BLE001
                pass

        # Gemini TTS typically returns WAV/PCM container bytes
        mime = "audio/wav"
        filename = save_tts_audio(audio_bytes, extension="wav", settings=self._settings)
        elapsed = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gemini.tts.done model=%s voice=%s chars=%s bytes=%s duration_ms=%s",
            model,
            voice,
            len(cleaned),
            len(audio_bytes),
            elapsed,
        )
        return TtsResult(
            audio_base64=base64.b64encode(audio_bytes).decode("ascii"),
            mime_type=mime,
            sample_rate=self._settings.tts_sample_rate,
            provider=self.name,
            duration_ms=elapsed,
            character_count=len(cleaned),
            filename=filename,
            audio_url=f"/audio/{filename}",
        )
