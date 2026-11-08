"""WebSocket `/ws/live` — browser ↔ FastAPI ↔ Gemini Live."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.genai.session import GeminiLiveSession

logger = logging.getLogger("aether.ws.live")

router = APIRouter()

# Keep idle browser↔proxy↔FastAPI sockets alive (many proxies drop ~30–60s idle).
SERVER_HEARTBEAT_INTERVAL_S = 15.0
# Brief pause before restarting a Gemini Live session that ended unexpectedly.
GEMINI_RESTART_DELAY_S = 1.0


@router.websocket("/ws/live")
async def live_websocket(websocket: WebSocket) -> None:
    """
    Bidirectional Live bridge.

    Client → server:
      - binary frames: PCM 16-bit LE mono @ 16 kHz
      - JSON text: {"type":"ping","t":<ms>} | {"type":"pong",...} | {"type":"text","text":"..."}

    Server → client:
      - binary frames: PCM 16-bit LE mono @ 24 kHz (Gemini audio)
      - JSON text: ready | ping | pong | *_transcript | turn_complete | interrupted | error
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

    stop = asyncio.Event()
    # Mutable holder so receive loop can target the active Gemini session across restarts.
    bridge: dict[str, GeminiLiveSession | None] = {"session": None}

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
                    session = bridge["session"]
                    if session is not None:
                        await session.push_audio(raw_bytes)
                    continue
                text = message.get("text")
                if text is None:
                    continue
                await _handle_control_message(bridge, websocket, text)
        except WebSocketDisconnect:
            logger.info("client disconnected")
        except Exception as exc:
            logger.exception("receive_from_client failed: %s", exc)
        finally:
            stop.set()

    async def server_heartbeat() -> None:
        """App-level keepalive so Vite/http-proxy idle timeouts do not kill the socket."""
        try:
            while not stop.is_set():
                await asyncio.sleep(SERVER_HEARTBEAT_INTERVAL_S)
                if stop.is_set():
                    break
                try:
                    await websocket.send_json(
                        {
                            "type": "ping",
                            "server_t": time.time(),
                        }
                    )
                except Exception:
                    logger.info("server heartbeat send failed; closing bridge")
                    stop.set()
                    break
        except asyncio.CancelledError:
            raise

    async def gemini_supervisor() -> None:
        """
        Keep Gemini Live running for the lifetime of the browser socket.

        Upstream Live sessions can end after idle minutes; restart them without
        tearing down `/ws/live` so the client stays connected for text/mic.
        """
        attempt = 0
        while not stop.is_set():
            attempt += 1
            session = GeminiLiveSession(settings)
            bridge["session"] = session
            try:
                await session.run(on_audio=on_audio, on_event=on_event)
                if stop.is_set():
                    break
                logger.warning(
                    "gemini live session ended cleanly (attempt=%s); restarting",
                    attempt,
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception(
                    "gemini live session error (attempt=%s): %s",
                    attempt,
                    exc,
                )
                if not stop.is_set():
                    try:
                        await websocket.send_json(
                            {
                                "type": "error",
                                "code": "session_retry",
                                "message": f"Live model session ended; reconnecting ({exc})",
                            }
                        )
                    except Exception:
                        stop.set()
                        break
            finally:
                bridge["session"] = None

            if stop.is_set():
                break
            await asyncio.sleep(GEMINI_RESTART_DELAY_S)

    receive_task = asyncio.create_task(receive_from_client(), name="ws-receive")
    heartbeat_task = asyncio.create_task(server_heartbeat(), name="ws-heartbeat")
    live_task = asyncio.create_task(gemini_supervisor(), name="gemini-supervisor")

    try:
        done, _pending = await asyncio.wait(
            {receive_task, heartbeat_task, live_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in done:
            if task is live_task and not stop.is_set():
                # Supervisor should only exit when stop is set; treat early exit as fatal.
                logger.error("gemini supervisor exited unexpectedly")
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
        heartbeat_task.cancel()
        live_task.cancel()
        await asyncio.gather(
            receive_task,
            heartbeat_task,
            live_task,
            return_exceptions=True,
        )
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("live bridge closed")


async def _handle_control_message(
    bridge: dict[str, GeminiLiveSession | None],
    websocket: WebSocket,
    text: str,
) -> None:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        session = bridge["session"]
        if session is not None:
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
                "server_t": time.time(),
            }
        )
        return

    if msg_type == "pong":
        # Client acknowledging a server heartbeat — traffic is enough.
        return

    session = bridge["session"]

    if msg_type == "text":
        if session is not None:
            await session.push_text(str(payload.get("text") or ""))
        return

    # Optional base64 PCM in JSON (fallback path)
    if msg_type == "audio" and payload.get("data"):
        if session is not None:
            await session.push_audio(base64.b64decode(payload["data"]))
