"""Latency / network error helpers shared across STT, agent, and TTS."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


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


def transient_network_error(stage: str, exc: BaseException) -> TransientNetworkError:
    return TransientNetworkError(stage, f"{type(exc).__name__}: {exc}")


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
