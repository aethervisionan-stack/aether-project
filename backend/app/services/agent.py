"""Primary response agent — Phase 1 draft generator (pre-Consenso)."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class AgentDraft:
    text: str
    duration_ms: int
    provider: str = "aether-mvp-agent"


class ResponseAgent:
    """
    Generates a draft spoken reply from the user transcript.

    Intentionally simple in Phase 1. Later phases can plug LLM / DePIN
    workers behind the same `draft()` method without changing the route.
    """

    async def draft(self, transcript: str, *, locale: str = "pt-BR") -> AgentDraft:
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
        return AgentDraft(text=text, duration_ms=elapsed)
