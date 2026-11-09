"""
Simultaneous multimodal ingestion beside PCM audio.

Frames and HUD telemetry land in bounded buffers so Live voice RTT is never
blocked. The bridge can optionally forward the latest frame/telemetry as
sidecar context for complex turns.
"""

from __future__ import annotations

import base64
import logging
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Any

logger = logging.getLogger("aether.multimodal.ingest")

MAX_FRAMES = 3
MAX_TELEMETRY = 32
MAX_FRAME_BYTES = 180_000  # ~JPEG budget after base64 decode


@dataclass
class MultimodalFrame:
    mime: str
    data_b64: str
    width: int | None = None
    height: int | None = None
    client_t: float | None = None
    received_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "mime": self.mime,
            "bytes": len(self.data_b64),
            "width": self.width,
            "height": self.height,
            "client_t": self.client_t,
            "received_at": self.received_at,
        }

    def decode(self) -> bytes | None:
        try:
            raw = base64.b64decode(self.data_b64, validate=False)
        except Exception:
            return None
        if len(raw) > MAX_FRAME_BYTES:
            return raw[:MAX_FRAME_BYTES]
        return raw


@dataclass
class TelemetrySample:
    ping_ms: float | None = None
    ai_ms: float | None = None
    ttft_ms: float | None = None
    ws_state: str | None = None
    viz_mode: str | None = None
    fifo_depth_ms: float | None = None
    client_t: float | None = None
    received_at: float = field(default_factory=time.time)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        extra = payload.pop("extra", {}) or {}
        payload.update({k: v for k, v in extra.items() if k not in payload})
        return payload


class MultimodalBuffer:
    """Bounded ring buffers for screen/image frames + HUD telemetry."""

    def __init__(self) -> None:
        self._frames: deque[MultimodalFrame] = deque(maxlen=MAX_FRAMES)
        self._telemetry: deque[TelemetrySample] = deque(maxlen=MAX_TELEMETRY)
        self.frames_accepted = 0
        self.frames_dropped = 0
        self.telemetry_accepted = 0

    def push_frame(
        self,
        *,
        mime: str,
        data_b64: str,
        width: int | None = None,
        height: int | None = None,
        client_t: float | None = None,
    ) -> MultimodalFrame | None:
        if not data_b64 or not mime:
            self.frames_dropped += 1
            return None
        if len(data_b64) > MAX_FRAME_BYTES * 2:
            # Oversized base64 — drop rather than inflate queues / TTFT.
            self.frames_dropped += 1
            logger.debug("dropping oversized frame b64_len=%s", len(data_b64))
            return None
        frame = MultimodalFrame(
            mime=mime.strip() or "image/jpeg",
            data_b64=data_b64,
            width=width,
            height=height,
            client_t=client_t,
        )
        self._frames.append(frame)
        self.frames_accepted += 1
        return frame

    def push_telemetry(self, payload: dict[str, Any]) -> TelemetrySample:
        known = {
            "ping_ms",
            "ai_ms",
            "ttft_ms",
            "ttftMs",
            "ws_state",
            "viz_mode",
            "fifo_depth_ms",
            "client_t",
        }
        sample = TelemetrySample(
            ping_ms=_as_float(payload.get("ping_ms")),
            ai_ms=_as_float(payload.get("ai_ms")),
            ttft_ms=_as_float(payload.get("ttft_ms") if payload.get("ttft_ms") is not None else payload.get("ttftMs")),
            ws_state=str(payload["ws_state"]) if payload.get("ws_state") else None,
            viz_mode=str(payload["viz_mode"]) if payload.get("viz_mode") else None,
            fifo_depth_ms=_as_float(payload.get("fifo_depth_ms")),
            client_t=_as_float(payload.get("client_t")),
            extra={k: v for k, v in payload.items() if k not in known and k != "type"},
        )
        self._telemetry.append(sample)
        self.telemetry_accepted += 1
        return sample

    def latest_frame(self) -> MultimodalFrame | None:
        return self._frames[-1] if self._frames else None

    def latest_telemetry(self) -> TelemetrySample | None:
        return self._telemetry[-1] if self._telemetry else None

    def context_snippet(self) -> str:
        """Compact multimodal context for complex-turn injection only."""
        parts: list[str] = []
        frame = self.latest_frame()
        if frame:
            dims = ""
            if frame.width and frame.height:
                dims = f" {frame.width}x{frame.height}"
            parts.append(f"Latest screen frame: {frame.mime}{dims} ({len(frame.data_b64)} b64 chars)")
        tel = self.latest_telemetry()
        if tel:
            bits = []
            if tel.ping_ms is not None:
                bits.append(f"ping={tel.ping_ms:.0f}ms")
            if tel.ai_ms is not None:
                bits.append(f"ai={tel.ai_ms:.0f}ms")
            if tel.ttft_ms is not None:
                bits.append(f"ttft={tel.ttft_ms:.0f}ms")
            if tel.viz_mode:
                bits.append(f"viz={tel.viz_mode}")
            if tel.ws_state:
                bits.append(f"ws={tel.ws_state}")
            if bits:
                parts.append("HUD telemetry: " + ", ".join(bits))
        return " | ".join(parts)

    def stats(self) -> dict[str, Any]:
        return {
            "frames_buffered": len(self._frames),
            "frames_accepted": self.frames_accepted,
            "frames_dropped": self.frames_dropped,
            "telemetry_buffered": len(self._telemetry),
            "telemetry_accepted": self.telemetry_accepted,
        }


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
