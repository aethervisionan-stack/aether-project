"""WebSocket `/ws/live` — browser ↔ FastAPI ↔ Gemini Live (+ frontier sidecars)."""

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
from app.multimodal.ingest import MultimodalBuffer
from app.pipeline.decision import DecisionContext, run_decision_pipeline
from app.reasoning.classifier import Complexity, classify_complexity
from app.safety import sanitize_outbound_event
from app.streaming.tokens import TokenStreamEmitter
from app.tools.registry import ToolContext, get_tool_registry

logger = logging.getLogger("aether.ws.live")

router = APIRouter()

# Keep idle browser↔proxy↔FastAPI sockets alive (many proxies drop ~30–60s idle).
SERVER_HEARTBEAT_INTERVAL_S = 15.0
# Brief pause before restarting a Gemini Live session that ended unexpectedly.
GEMINI_RESTART_DELAY_S = 1.0
DEFAULT_MEMORY_PROFILE = "local"

# Transcript event names emitted by genai.session (memory must match these).
_USER_TRANSCRIPT_TYPES = frozenset({"user_transcript", "input_transcript"})
_AETHER_TRANSCRIPT_TYPES = frozenset({"aether_transcript", "output_transcript"})


@router.websocket("/ws/live")
async def live_websocket(websocket: WebSocket) -> None:
    """
    Bidirectional Live bridge.

    Client → server:
      - binary frames: PCM 16-bit LE mono @ 16 kHz
      - JSON text:
          ping | pong | text | audio | frame | telemetry | tool_call | planning

    Server → client:
      - binary frames: PCM 16-bit LE mono @ 24 kHz (Gemini audio)
      - JSON text: ready | ping | pong | *_transcript | token_* | decision |
        tool_result | multimodal_ack | turn_complete | interrupted | error
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
    bridge: dict[str, GeminiLiveSession | None] = {"session": None}
    memory_turns = 0
    multimodal = MultimodalBuffer()
    # Serialize heavy decision work so voice PCM never waits on CoT/tools.
    decision_lock = asyncio.Lock()

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
            sanitized = await sanitize_outbound_event(event)
            if sanitized is None:
                return
            et = sanitized.get("type")
            if et in _AETHER_TRANSCRIPT_TYPES:
                _schedule_memory("aether", str(sanitized.get("text") or ""))
            elif et in _USER_TRANSCRIPT_TYPES:
                _schedule_memory("user", str(sanitized.get("text") or ""))
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
                await _handle_control_message(
                    bridge,
                    websocket,
                    text,
                    schedule_memory=_schedule_memory,
                    multimodal=multimodal,
                    profile_id=profile_id,
                    on_event=on_event,
                    decision_lock=decision_lock,
                    stop=stop,
                )
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

        Preference summary is loaded once per restart (async thread) so Live
        adapts without adding ms to audio frame RTT. Runtime memory also flows
        through the decision pipeline on complex text turns.
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

            # Advertise tool catalog in the persona so Live can suggest tool_call JSON.
            tools_hint = (
                "Available tools (client/server may invoke via tool_call): "
                + ", ".join(get_tool_registry().list_names())
                + ". Prefer short HUD answers; never narrate internal plans unless asked."
            )
            system_instruction = f"{system_instruction}\n{tools_hint}"

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
        logger.info("live bridge closed multimodal=%s", multimodal.stats())


async def _handle_control_message(
    bridge: dict[str, GeminiLiveSession | None],
    websocket: WebSocket,
    text: str,
    *,
    schedule_memory: Any | None = None,
    multimodal: MultimodalBuffer | None = None,
    profile_id: str = DEFAULT_MEMORY_PROFILE,
    on_event: Any | None = None,
    decision_lock: asyncio.Lock | None = None,
    stop: asyncio.Event | None = None,
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
        return

    session = bridge["session"]

    # --- Multimodal: screen/image frames (sidecar; never blocks PCM) ---
    if msg_type == "frame" and multimodal is not None:
        frame = multimodal.push_frame(
            mime=str(payload.get("mime") or "image/jpeg"),
            data_b64=str(payload.get("data") or ""),
            width=_optional_int(payload.get("width")),
            height=_optional_int(payload.get("height")),
            client_t=_optional_float(payload.get("client_t")),
        )
        ack = {
            "type": "multimodal_ack",
            "kind": "frame",
            "ok": frame is not None,
            "stats": multimodal.stats(),
        }
        try:
            await websocket.send_json(ack)
        except Exception:
            pass
        # Forward latest frame to Gemini when possible (async, after ack).
        if frame is not None and session is not None:
            raw = frame.decode()
            if raw:
                await session.push_image(raw, mime=frame.mime)
        return

    # --- Multimodal: HUD telemetry ---
    if msg_type == "telemetry" and multimodal is not None:
        sample = multimodal.push_telemetry(payload)
        try:
            await websocket.send_json(
                {
                    "type": "multimodal_ack",
                    "kind": "telemetry",
                    "ok": True,
                    "viz_mode": sample.viz_mode,
                    "stats": multimodal.stats(),
                }
            )
        except Exception:
            pass
        return

    # --- Explicit tool call from client ---
    if msg_type == "tool_call":
        name = str(payload.get("name") or "").strip()
        args = payload.get("arguments") if isinstance(payload.get("arguments"), dict) else {}
        registry = get_tool_registry()
        result = await registry.invoke(
            name,
            args,
            ctx=ToolContext(profile_id=profile_id, settings=get_settings(), source="ws"),
        )
        event = {"type": "tool_result", **result.to_dict()}
        try:
            await websocket.send_json(event)
        except Exception:
            pass
        # Feed tool outcome into Live as compact context (text path only).
        if session is not None:
            await session.push_text(
                f"[tool_result {result.name}] {result.context_line()}"
            )
        return

    if msg_type == "text":
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
        if schedule_memory is not None:
            schedule_memory("user", user_text)

        # Fast path: always forward user text to Live immediately (TTFT).
        if session is not None:
            await session.push_text(user_text)

        # Heavy path: CoT + memory + tools as async sidecar (does not gate audio).
        complexity = classify_complexity(user_text)
        force_plan = bool(payload.get("force_plan"))
        if complexity is Complexity.COMPLEX or force_plan:
            asyncio.create_task(
                _run_text_sidecar(
                    bridge=bridge,
                    websocket=websocket,
                    user_text=user_text,
                    profile_id=profile_id,
                    multimodal=multimodal,
                    on_event=on_event,
                    decision_lock=decision_lock,
                    stop=stop,
                    force_plan=force_plan,
                ),
                name="decision-sidecar",
            )
        return

    # Optional base64 PCM in JSON (fallback path)
    if msg_type == "audio" and payload.get("data"):
        if session is not None:
            await session.push_audio(base64.b64decode(payload["data"]))


async def _run_text_sidecar(
    *,
    bridge: dict[str, GeminiLiveSession | None],
    websocket: WebSocket,
    user_text: str,
    profile_id: str,
    multimodal: MultimodalBuffer | None,
    on_event: Any | None,
    decision_lock: asyncio.Lock | None,
    stop: asyncio.Event | None,
    force_plan: bool,
) -> None:
    """Async CoT / memory / tools — never on the PCM flush path."""
    if stop is not None and stop.is_set():
        return
    lock = decision_lock or asyncio.Lock()
    async with lock:
        if stop is not None and stop.is_set():
            return
        try:
            outcome = await run_decision_pipeline(
                DecisionContext(
                    profile_id=profile_id,
                    user_text=user_text,
                    multimodal=multimodal,
                    settings=get_settings(),
                    auto_tools=True,
                )
            )
            if force_plan and outcome.planning.skipped:
                # Rare: force replan even if classifier said simple.
                from app.reasoning.cot import plan_and_correct

                outcome.planning = await asyncio.to_thread(plan_and_correct, user_text, force=True)
                outcome.skipped_heavy = False

            try:
                await websocket.send_json(outcome.to_event())
            except Exception:
                return

            # Stream a short planning summary as token deltas (HUD TTFT), not audio.
            if on_event is not None and outcome.planning.plan_summary:
                emitter = TokenStreamEmitter(on_event)
                await emitter.emit_text(
                    f"Plan: {outcome.planning.plan_summary}",
                    stream_id=f"plan-{outcome.turn_id}",
                    max_chars=28,
                )

            for tr in outcome.tool_results:
                try:
                    await websocket.send_json({"type": "tool_result", **tr.to_dict()})
                except Exception:
                    return

            session = bridge.get("session")
            if session is not None and outcome.injection_text:
                # Sidecar context for the model — user already received the primary text.
                await session.push_text(
                    "[runtime_context]\n" + outcome.injection_text
                )
        except Exception:
            logger.exception("decision sidecar failed")


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
