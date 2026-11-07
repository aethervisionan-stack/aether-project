"""Latency / network error helpers shared across STT, agent, and TTS."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

logger = logging.getLogger("aether.resilience")

T = TypeVar("T")

# Spoken when real STT/TTS APIs fail (quota, bad key, network) — never crash Uvicorn.
API_FAILURE_FALLBACK_PT = (
    "Não consegui contactar o serviço de voz neste momento. "
    "Estou em modo seguro — pode repetir o pedido pelo headset?"
)


class PipelineError(Exception):
    """Typed pipeline failure with retry and stage metadata."""

    def __init__(
        self,
        message: str,
        *,
        stage: str,
        retryable: bool = False,
        detail: str | None = None,
    ) -> None:
        super().__init__(message)
        self.stage = stage
        self.retryable = retryable
        self.detail = detail or message


class TransientNetworkError(PipelineError):
    def __init__(self, stage: str, detail: str) -> None:
        super().__init__(
            f"Transient failure in {stage}",
            stage=stage,
            retryable=True,
            detail=detail,
        )


class RecoverableProviderError(PipelineError):
    """
    Real STT/TTS failure (quota, invalid key, upstream 4xx/5xx).

    The pipeline catches this, logs JSON, synthesizes a safe spoken fallback,
    and returns HTTP 200 — Uvicorn must not crash.
    """

    def __init__(self, stage: str, detail: str, *, provider: str = "") -> None:
        super().__init__(
            f"Recoverable provider failure in {stage}",
            stage=stage,
            retryable=True,
            detail=detail,
        )
        self.provider = provider


def transient_network_error(stage: str, exc: BaseException) -> TransientNetworkError:
    return TransientNetworkError(stage, f"{type(exc).__name__}: {exc}")


def log_provider_error(
    *,
    stage: str,
    provider: str,
    detail: str,
    request_id: str | None = None,
    error_type: str = "provider_error",
) -> None:
    payload = {
        "event": "audio.provider.error",
        "error_type": error_type,
        "stage": stage,
        "provider": provider,
        "detail": detail,
        "request_id": request_id,
        "action": "safe_spoken_fallback",
    }
    logger.error("%s", json.dumps(payload, ensure_ascii=False, default=str))


def classify_provider_failure(stage: str, provider: str, exc: BaseException) -> RecoverableProviderError:
    """Map Gemini/httpx failures into a recoverable error."""
    text = f"{type(exc).__name__}: {exc}".lower()
    error_type = "upstream_error"
    if any(k in text for k in ("401", "unauthorized", "invalid api key", "incorrect api key")):
        error_type = "invalid_api_key"
    elif any(k in text for k in ("429", "quota", "rate limit", "insufficient_quota")):
        error_type = "quota_exhausted"
    elif any(k in text for k in ("timeout", "timed out")):
        error_type = "timeout"
    detail = f"{error_type}: {type(exc).__name__}: {exc}"
    log_provider_error(
        stage=stage,
        provider=provider,
        detail=detail,
        error_type=error_type,
    )
    return RecoverableProviderError(stage, detail, provider=provider)


async def retry_async(
    fn: Callable[[], Awaitable[T]],
    *,
    attempts: int,
    backoff_ms: int,
) -> T:
    """Retry transient network failures with linear backoff."""
    last_exc: BaseException | None = None
    total = max(1, attempts + 1)
    for attempt in range(total):
        try:
            return await fn()
        except TransientNetworkError as exc:
            last_exc = exc
            if attempt >= total - 1:
                break
            delay = (backoff_ms / 1000.0) * (attempt + 1)
            logger.warning(
                "retryable %s failure (attempt %s/%s): %s",
                exc.stage,
                attempt + 1,
                total,
                exc.detail,
            )
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise last_exc
