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
from app.memory.context import build_system_instruction
from app.memory.extractor import run_extraction
from app.memory.store import get_memory_store
from app.safety import sanitize_outbound_event

logger = logging.getLogger("aether.ws.live")

router = APIRouter()

# Keep idle browser↔proxy↔FastAPI sockets alive (many proxies drop ~30–60s idle).
SERVER_HEARTBEAT_INTERVAL_S = 15.0
# Brief pause before restarting a Gemini Live session that ended unexpectedly.
GEMINI_RESTART_DELAY_S = 1.0
DEFAULT_MEMORY_PROFILE = "local"


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
    profile_id = (
        (websocket.query_params.get("profile_id") or DEFAULT_MEMORY_PROFILE).strip()
        or DEFAULT_MEMORY_PROFILE
    )
    logger.info("client connected path=/ws/live profile=%s", profile_id)

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
    memory_turns = 0

    def _schedule_memory(role: str, text: str) -> None:
        """Fire-and-forget history append + periodic extraction (never blocks audio)."""
        nonlocal memory_turns
        if not settings.memory_enabled:
            return
        cleaned = (text or "").strip()
        if not cleaned:
            return

        async def _bg() -> None:
            nonlocal memory_turns
            try:
                store = get_memory_store()
                await asyncio.to_thread(store.append_interaction, profile_id, role, cleaned)
                memory_turns += 1
                # Extract every few user turns — cheap rules, off the audio path.
                if role == "user" and memory_turns % 3 == 0:
                    await asyncio.to_thread(run_extraction, store, profile_id)
            except Exception:
                logger.debug("memory background write failed", exc_info=True)

        asyncio.create_task(_bg(), name="memory-bg")

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
            # Guardrails on AI text only — audio PCM and heartbeats bypass this path.
            sanitized = await sanitize_outbound_event(event)
            if sanitized is None:
                return
            # Learn from final transcripts without adding latency to the WS send.
            et = sanitized.get("type")
            if et in {"output_transcript", "input_transcript"}:
                role = "aether" if et == "output_transcript" else "user"
                _schedule_memory(role, str(sanitized.get("text") or ""))
            await websocket.send_json(sanitized)
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
                await _handle_control_message(bridge, websocket, text, schedule_memory=_schedule_memory)
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
        Preference summary is loaded once per restart (async thread) so Live
        adapts without adding ms to audio frame RTT.
        """
        attempt = 0
        while not stop.is_set():
            attempt += 1
            system_instruction = build_system_instruction()
            if settings.memory_enabled:
                try:
                    store = get_memory_store()
                    snap = await asyncio.to_thread(store.snapshot, profile_id)
                    system_instruction = build_system_instruction(snap.get("preferences"))
                except Exception:
                    logger.debug("memory prefs load failed; using base persona", exc_info=True)

            session = GeminiLiveSession(settings, system_instruction=system_instruction)
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
    *,
    schedule_memory: Any | None = None,
) -> None:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        session = bridge["session"]
        if session is not None:
            await session.push_text(text)
        if schedule_memory is not None:
            schedule_memory("user", text)
        return

    if not isinstance(payload, dict):
        return

    msg_type = payload.get("type")
    if msg_type == "ping":
        await websocket.send_json(
            {
                "type": "pong",
                "t": payload.get("t"),
                "server_t": time.time() * 1000.0,
            }
        )
        return

    if msg_type == "pong":
        # Client acknowledging a server heartbeat — traffic is enough.
        return

    session = bridge["session"]

    if msg_type == "text":
        # Echo client_t so HUD latency can correlate outbound stamps (Gen-1).
        client_t = payload.get("client_t")
        if client_t is not None:
            try:
                await websocket.send_json(
                    {
                        "type": "outbound_ack",
                        "client_t": client_t,
                        "server_t": time.time() * 1000.0,
                    }
                )
            except Exception:
                pass
        user_text = str(payload.get("text") or "")
        if session is not None:
            await session.push_text(user_text)
        if schedule_memory is not None:
            schedule_memory("user", user_text)
        return

    # Optional base64 PCM in JSON (fallback path)
    if msg_type == "audio" and payload.get("data"):
        if session is not None:
            await session.push_audio(base64.b64decode(payload["data"]))
