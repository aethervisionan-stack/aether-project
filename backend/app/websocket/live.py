"""WebSocket `/ws/live` — browser ↔ FastAPI ↔ Gemini Live."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.genai.session import GeminiLiveSession

logger = logging.getLogger("aether.ws.live")

router = APIRouter()


@router.websocket("/ws/live")
async def live_websocket(websocket: WebSocket) -> None:
    """
    Bidirectional Live bridge.

    Client → server:
      - binary frames: PCM 16-bit LE mono @ 16 kHz
      - JSON text: {"type":"ping","t":<ms>} | {"type":"text","text":"..."}

    Server → client:
      - binary frames: PCM 16-bit LE mono @ 24 kHz (Gemini audio)
      - JSON text: ready | pong | *_transcript | turn_complete | interrupted | error
    """
    await websocket.accept()
    settings = get_settings()
    logger.info("client connected path=/ws/live")

    if not settings.has_api_key():
        await websocket.send_json(
            {
                "type": "error",
                "code": "missing_api_key",
                "message": "Set GEMINI_API_KEY in backend/.env",
            }
        )
        await websocket.close(code=1011)
        return

    session = GeminiLiveSession(settings)
    stop = asyncio.Event()

    async def on_audio(pcm: bytes) -> None:
        if stop.is_set():
            return
        try:
            await websocket.send_bytes(pcm)
        except Exception:
            stop.set()

    async def on_event(event: dict[str, Any]) -> None:
        if stop.is_set():
            return
        try:
            await websocket.send_json(event)
        except Exception:
            stop.set()

    async def receive_from_client() -> None:
        try:
            while not stop.is_set():
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                raw_bytes = message.get("bytes")
                if raw_bytes is not None:
                    await session.push_audio(raw_bytes)
                    continue
                text = message.get("text")
                if text is None:
                    continue
                await _handle_control_message(session, websocket, text)
        except WebSocketDisconnect:
            logger.info("client disconnected")
        except Exception as exc:
            logger.exception("receive_from_client failed: %s", exc)
        finally:
            stop.set()

    receive_task = asyncio.create_task(receive_from_client(), name="ws-receive")
    live_task = asyncio.create_task(
        session.run(on_audio=on_audio, on_event=on_event),
        name="gemini-live",
    )

    try:
        done, _pending = await asyncio.wait(
            {receive_task, live_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in done:
            exc = task.exception() if not task.cancelled() else None
            if exc is not None:
                logger.error("live bridge task error: %s", exc)
                try:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "code": "session_error",
                            "message": str(exc),
                        }
                    )
                except Exception:
                    pass
    finally:
        stop.set()
        receive_task.cancel()
        live_task.cancel()
        await asyncio.gather(receive_task, live_task, return_exceptions=True)
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("live bridge closed")


async def _handle_control_message(
    session: GeminiLiveSession,
    websocket: WebSocket,
    text: str,
) -> None:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        await session.push_text(text)
        return

    if not isinstance(payload, dict):
        return

    msg_type = payload.get("type")
    if msg_type == "ping":
        await websocket.send_json(
            {
                "type": "pong",
                "t": payload.get("t"),
                "server_t": asyncio.get_running_loop().time(),
            }
        )
        return

    if msg_type == "text":
        await session.push_text(str(payload.get("text") or ""))
        return

    # Optional base64 PCM in JSON (fallback path)
    if msg_type == "audio" and payload.get("data"):
        await session.push_audio(base64.b64decode(payload["data"]))
