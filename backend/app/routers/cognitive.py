"""POST /api/cognitive/chat — Gemini flash|pro + Consenso Alfa unified payload."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import get_settings
from app.core.memory import get_adaptive_memory
from app.services.consenso_alfa import ConsensoAlfa
from app.services.gemini_gateway import (
    GeminiGateway,
    build_sqlite_context,
    resolve_gemini_mode,
)
from app.services.resilience import API_FAILURE_FALLBACK_PT, RecoverableProviderError

logger = logging.getLogger("aether.cognitive")

router = APIRouter(tags=["cognitive"])


class ChatHistoryItem(BaseModel):
    role: Literal["user", "model", "assistant"] = "user"
    content: str = ""


class CognitiveChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User utterance / question")
    history: list[ChatHistoryItem] = Field(default_factory=list)
    mode: Literal["flash", "pro"] = "flash"
    locale: str = "pt-BR"
    client_id: str = "default"


class CognitiveChatResponse(BaseModel):
    """Unified HUD payload (aliases + backend-native fields)."""

    status: Literal["ok", "fallback", "error"]
    query: str
    transcription: str  # alias of query for HUD parity with voice
    gemini_response: str
    response_text: str
    consensus_confidence: float
    consenso: dict[str, Any]
    model: str
    mode: str
    duration_ms: int
    cognitive_provider: str = "gemini"
    request_id: str
    used_safe_fallback: bool = False
    fallback_reason: str | None = None
    audio_response_url: str | None = None
    tools: list[dict[str, Any]] = Field(default_factory=list)
    tools_executed_count: int = 0


@router.post("/api/cognitive/chat", response_model=CognitiveChatResponse)
@router.post("/cognitive/chat", response_model=CognitiveChatResponse)
async def cognitive_chat(body: CognitiveChatRequest) -> CognitiveChatResponse:
    settings = get_settings()
    request_id = str(uuid.uuid4())
    mode = resolve_gemini_mode(body.mode)
    gateway = GeminiGateway(settings)
    consenso_engine = ConsensoAlfa(settings)

    memory_context = ""
    if settings.memory_enabled:
        try:
            memory = get_adaptive_memory()
            if memory.available:
                hits = memory.search_context(body.query, client_id=body.client_id)
                memory_context = (
                    memory.format_learned_preferences_prompt(hits)
                    or memory.format_context_block(hits)
                )
        except Exception as exc:  # noqa: BLE001
            logger.debug("cognitive memory skip: %s", exc)

    sqlite_ctx = ""
    if settings.gemini_inject_sqlite_context:
        sqlite_ctx = build_sqlite_context(client_id=body.client_id, limit=5)

    history_payload = [h.model_dump() for h in body.history]

    tools_payload: list[dict[str, Any]] = []
    try:
        turn = await gateway.chat(
            query=body.query,
            history=history_payload,
            mode=mode,
            locale=body.locale,
            memory_context=memory_context,
            sqlite_context=sqlite_ctx,
            client_id=body.client_id,
            request_id=request_id,
            speakable=False,
            enable_tools=True,
        )
        draft = turn.text
        used_fallback = False
        fallback_reason = None
        tools_payload = [t.model_dump() for t in (turn.tools or [])]
    except RecoverableProviderError as exc:
        logger.warning(
            "cognitive.gemini.recoverable detail=%s provider=%s request_id=%s",
            exc.detail,
            exc.provider,
            request_id,
        )
        draft = API_FAILURE_FALLBACK_PT
        used_fallback = True
        fallback_reason = exc.detail
        turn_provider = "gemini-3.8-flash"
        turn = type(
            "T",
            (),
            {
                "text": draft,
                "duration_ms": 0,
                "provider": turn_provider,
                "mode": mode,
                "tools": [],
            },
        )()

    consenso = await consenso_engine.validate(
        user_transcript=body.query,
        draft_response=draft,
        locale=body.locale,
        request_id=request_id,
    )
    final_text = consenso.final_text
    if not consenso.approved and not consenso.skipped:
        used_fallback = True
        fallback_reason = fallback_reason or "consenso_quorum_rejected"

    status: Literal["ok", "fallback", "error"] = "fallback" if used_fallback else "ok"
    executed = sum(1 for t in tools_payload if t.get("executed"))

    return CognitiveChatResponse(
        status=status,
        query=body.query,
        transcription=body.query,
        gemini_response=final_text,
        response_text=final_text,
        consensus_confidence=float(consenso.agreement_ratio),
        consenso=consenso.model_dump(),
        model=getattr(turn, "provider", "gemini-3.8-flash"),
        mode=mode,
        duration_ms=int(getattr(turn, "duration_ms", 0)) + int(consenso.duration_ms),
        cognitive_provider="gemini",
        request_id=request_id,
        used_safe_fallback=used_fallback,
        fallback_reason=fallback_reason,
        audio_response_url=None,
        tools=tools_payload,
        tools_executed_count=executed,
    )
