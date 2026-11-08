"""WebSocket ``/ws/live`` — browser PCM bridge ↔ Gemini Live AUDIO.

Client path via Vite: ``ws(s)://host/api/ws/live`` (proxy strips ``/api``).
Direct API: ``ws://127.0.0.1:8001/ws/live``.

Framing
-------
Client → server
  - binary: PCM s16le mono @ 16 kHz
  - text JSON: ``{"type":"interrupt"}`` | ``{"type":"audio_stream_end"}`` |
    ``{"type":"ping"}`` | ``{"type":"close"}``

Server → client
  - binary: PCM s16le mono @ 24 kHz (Gemini Live)
  - text JSON: ready | interrupted | turn_complete | error | pong | transcripts
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.config import Settings, get_settings
from app.core.config import is_valid_gemini_api_key, normalize_secret
from app.services import gemini_live as live
from app.services.gemini_live import (
    GEMINI_LIVE_MODEL,
    LIVE_INPUT_SAMPLE_RATE,
    LIVE_OUTPUT_SAMPLE_RATE,
    LiveBridgeMeta,
    LiveSessionProto,
    extract_audio_bytes,
    extract_server_flags,
    send_pcm_chunk,
    signal_audio_stream_end,
    signal_user_activity_start,
)

logger = logging.getLogger("aether.live_stream")

router = APIRouter(tags=["live"])

# Injectable connect factory for pytest (mock Live without network/key).
LiveSessionFactory = Callable[[Settings], Any]


@asynccontextmanager
async def _default_live_session(settings: Settings) -> AsyncIterator[LiveSessionProto]:
    key = normalize_secret(settings.gemini_api_key)
    if not is_valid_gemini_api_key(key):
        raise RuntimeError("missing_gemini_api_key")
    model = (getattr(settings, "gemini_live_model", None) or GEMINI_LIVE_MODEL).strip()
    async with live.connect_gemini_live(api_key=key, model=model) as session:
        yield session


_live_session_factory: LiveSessionFactory = _default_live_session


def set_live_session_factory(factory: LiveSessionFactory | None) -> None:
    """Test hook: replace or restore the Gemini Live connect factory."""
    global _live_session_factory
    _live_session_factory = factory or _default_live_session


def get_live_session_factory() -> LiveSessionFactory:
    return _live_session_factory


async def _send_json(ws: WebSocket, payload: dict[str, Any]) -> None:
    if ws.client_state != WebSocketState.CONNECTED:
        return
    await ws.send_text(json.dumps(payload, ensure_ascii=False))


async def _send_pcm(ws: WebSocket, pcm: bytes) -> None:
    if ws.client_state != WebSocketState.CONNECTED or not pcm:
        return
    await ws.send_bytes(pcm)


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket) -> None:
    """Bidirectional PCM bridge for Gemini Live (AUDIO modality)."""
    await websocket.accept()
    settings = get_settings()
    meta = LiveBridgeMeta(
        model=(getattr(settings, "gemini_live_model", None) or GEMINI_LIVE_MODEL).strip(),
        input_sample_rate=LIVE_INPUT_SAMPLE_RATE,
        output_sample_rate=LIVE_OUTPUT_SAMPLE_RATE,
    )
    logger.info("live.ws.accept model=%s", meta.model)

    try:
        factory = get_live_session_factory()
        async with factory(settings) as session:
            await _send_json(
                websocket,
                {
                    "type": "ready",
                    "model": meta.model,
                    "input_rate": meta.input_sample_rate,
                    "output_rate": meta.output_sample_rate,
                    "response_modality": meta.response_modality,
                },
            )
            await _run_bridge(websocket, session)
    except WebSocketDisconnect:
        logger.info("live.ws.client_disconnect")
    except Exception as exc:  # noqa: BLE001
        code = "live_session_error"
        message = str(exc) or exc.__class__.__name__
        if "missing_gemini_api_key" in message:
            code = "missing_gemini_api_key"
            message = "GEMINI_API_KEY missing or invalid — Live requires a usable key"
        logger.warning("live.ws.error code=%s err=%s", code, message)
        try:
            await _send_json(
                websocket,
                {"type": "error", "code": code, "message": message},
            )
        except Exception:  # noqa: BLE001
            pass
        try:
            await websocket.close(code=1011)
        except Exception:  # noqa: BLE001
            pass


async def _run_bridge(websocket: WebSocket, session: LiveSessionProto) -> None:
    stop = asyncio.Event()

    async def uplink() -> None:
        """Browser → Gemini (PCM + control frames)."""
        try:
            while not stop.is_set():
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                data = message.get("bytes")
                if data is not None:
                    await send_pcm_chunk(session, data)
                    continue
                text = message.get("text")
                if text is None:
                    continue
                await _handle_client_control(session, websocket, text, stop)
        except WebSocketDisconnect:
            pass
        except Exception as exc:  # noqa: BLE001
            logger.debug("live.uplink.end: %s", exc)
        finally:
            stop.set()

    async def downlink() -> None:
        """Gemini → browser (PCM + turn / interrupt events)."""
        try:
            while not stop.is_set():
                async for msg in session.receive():
                    if stop.is_set():
                        break
                    flags = extract_server_flags(msg)
                    pcm = extract_audio_bytes(msg)
                    if pcm:
                        await _send_pcm(websocket, pcm)
                    if flags.get("interrupted"):
                        await _send_json(websocket, {"type": "interrupted"})
                    if flags.get("input_transcript"):
                        await _send_json(
                            websocket,
                            {
                                "type": "input_transcript",
                                "text": flags["input_transcript"],
                            },
                        )
                    if flags.get("output_transcript"):
                        await _send_json(
                            websocket,
                            {
                                "type": "output_transcript",
                                "text": flags["output_transcript"],
                            },
                        )
                    if flags.get("turn_complete"):
                        await _send_json(websocket, {"type": "turn_complete"})
                # receive() ends after turn_complete — keep listening for next turn
        except WebSocketDisconnect:
            pass
        except Exception as exc:  # noqa: BLE001
            if not stop.is_set():
                logger.debug("live.downlink.end: %s", exc)
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "code": "gemini_receive_error",
                        "message": str(exc) or exc.__class__.__name__,
                    },
                )
        finally:
            stop.set()

    up_task = asyncio.create_task(uplink(), name="live-uplink")
    down_task = asyncio.create_task(downlink(), name="live-downlink")
    try:
        await stop.wait()
    finally:
        stop.set()
        for task in (up_task, down_task):
            task.cancel()
        await asyncio.gather(up_task, down_task, return_exceptions=True)
        try:
            await session.close()
        except Exception:  # noqa: BLE001
            pass


async def _handle_client_control(
    session: LiveSessionProto,
    websocket: WebSocket,
    raw: str,
    stop: asyncio.Event,
) -> None:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        await _send_json(
            websocket,
            {
                "type": "error",
                "code": "invalid_json",
                "message": "client control frame must be JSON",
            },
        )
        return

    msg_type = str(payload.get("type") or "").strip().lower()
    if msg_type == "ping":
        await _send_json(websocket, {"type": "pong"})
        return
    if msg_type == "interrupt":
        await signal_user_activity_start(session)
        await _send_json(websocket, {"type": "interrupted"})
        return
    if msg_type == "audio_stream_end":
        await signal_audio_stream_end(session)
        return
    if msg_type == "close":
        stop.set()
        return
    await _send_json(
        websocket,
        {
            "type": "error",
            "code": "unknown_control",
            "message": f"unsupported control type: {msg_type or '(empty)'}",
        },
    )
