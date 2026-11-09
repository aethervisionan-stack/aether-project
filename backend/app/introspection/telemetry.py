"""Process-level latency telemetry for introspection health (TTFT / ping / AI cycle)."""

from __future__ import annotations

import threading
import time
from typing import Any


class LatencyTelemetryStore:
    """Latest HUD latency samples pushed over `/ws/live` telemetry frames."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ttft_ms: float | None = None
        self._ping_ms: float | None = None
        self._ai_ms: float | None = None
        self._ws_state: str | None = None
        self._updated_at: float | None = None
        self._samples = 0

    def record(self, payload: dict[str, Any] | None) -> None:
        if not payload:
            return
        with self._lock:
            ttft = _as_float(payload.get("ttft_ms"))
            if ttft is None:
                ttft = _as_float(payload.get("ttftMs"))
            ping = _as_float(payload.get("ping_ms"))
            ai = _as_float(payload.get("ai_ms"))
            ws = payload.get("ws_state")
            if ttft is not None:
                self._ttft_ms = ttft
            if ping is not None:
                self._ping_ms = ping
            if ai is not None:
                self._ai_ms = ai
            if ws is not None:
                self._ws_state = str(ws)
            self._updated_at = time.time()
            self._samples += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "ttft_ms": self._ttft_ms,
                "ping_ms": self._ping_ms,
                "ai_ms": self._ai_ms,
                "ws_state": self._ws_state,
                "updated_at": self._updated_at,
                "samples": self._samples,
                "source": "hud_latency_tracker" if self._samples else None,
                "note": (
                    "TTFT from client LatencyTracker when telemetry is flowing; "
                    "null until a Live session reports samples."
                    if self._samples == 0
                    else "Latest sample from HUD telemetry over /ws/live."
                ),
            }


_STORE = LatencyTelemetryStore()


def record_latency_sample(payload: dict[str, Any] | None) -> None:
    _STORE.record(payload)


def get_latency_telemetry() -> dict[str, Any]:
    return _STORE.snapshot()


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
