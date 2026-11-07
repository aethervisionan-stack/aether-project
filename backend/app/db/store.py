"""Persist SessionLogs + AuditTrail and query history/metrics."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import desc, func, select

from app.db.models import AuditTrail, ContextNote, SessionLog, utc_now
from app.db.session import get_session_factory
from app.models.schemas import ProcessAudioResponse, ToolInvocation

logger = logging.getLogger("aether.db.store")


def _tool_to_json(tool: ToolInvocation) -> dict[str, Any]:
    return {
        "name": tool.name,
        "arguments": tool.arguments,
        "approved": tool.approved,
        "executed": tool.executed,
        "blocked_reason": tool.blocked_reason,
        "result_preview": tool.result_preview,
        "duration_ms": tool.duration_ms,
    }


def persist_process_audio(
    response: ProcessAudioResponse,
    *,
    client_id: str = "default",
    sqlite_url: str = "",
) -> int | None:
    """
    Write one SessionLog + AuditTrail rows for each tool consensus decision.
    Returns session_logs.id, or None on failure (never raises into the HTTP path).
    """
    try:
        factory = get_session_factory(sqlite_url)
        with factory() as session:
            log = SessionLog(
                timestamp=utc_now(),
                request_id=response.meta.request_id,
                client_id=client_id or "default",
                transcription=response.transcript or "",
                agent_response=response.response_text or "",
                tools_invoked=[_tool_to_json(t) for t in response.tools],
                latency_stt_ms=response.latency.stt_ms,
                latency_agent_ms=response.latency.agent_ms,
                latency_consenso_ms=response.latency.consenso_ms,
                latency_tts_ms=response.latency.tts_ms,
                latency_total_ms=response.latency.total_ms,
                consensus_score=float(response.consenso.agreement_ratio),
                tokens_prompt=0,
                tokens_completion=0,
                tokens_total=0,
            )
            session.add(log)

            for tool in response.tools:
                decision = "approve" if tool.approved else "reject"
                session.add(
                    AuditTrail(
                        timestamp=utc_now(),
                        request_id=response.meta.request_id,
                        client_id=client_id or "default",
                        tool_name=tool.name,
                        decision=decision,
                        reason=tool.blocked_reason,
                        arguments_json=tool.arguments,
                        duration_ms=tool.duration_ms,
                        consensus_score=1.0 if tool.approved else 0.0,
                    )
                )

            session.commit()
            session.refresh(log)
            logger.info(
                "session_log saved id=%s request_id=%s tools=%s audits=%s",
                log.id,
                response.meta.request_id,
                len(response.tools),
                len(response.tools),
            )
            return log.id
    except Exception as exc:  # noqa: BLE001
        logger.exception("persist_process_audio failed: %s", exc)
        return None


def list_recent_sessions(
    *,
    limit: int = 50,
    client_id: str | None = None,
    sqlite_url: str = "",
) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 200))
    factory = get_session_factory(sqlite_url)
    with factory() as session:
        stmt = select(SessionLog).order_by(desc(SessionLog.timestamp)).limit(limit)
        if client_id:
            stmt = stmt.where(SessionLog.client_id == client_id)
        rows = session.scalars(stmt).all()
        return [
            {
                "id": row.id,
                "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                "request_id": row.request_id,
                "client_id": row.client_id,
                "transcription": row.transcription,
                "agent_response": row.agent_response,
                "tools_invoked": row.tools_invoked or [],
                "latency_ms": {
                    "stt": row.latency_stt_ms,
                    "agent": row.latency_agent_ms,
                    "consenso": row.latency_consenso_ms,
                    "tts": row.latency_tts_ms,
                    "total": row.latency_total_ms,
                },
                "consensus_score": row.consensus_score,
                "tokens": {
                    "prompt": row.tokens_prompt,
                    "completion": row.tokens_completion,
                    "total": row.tokens_total,
                },
            }
            for row in rows
        ]


def consolidated_metrics(*, sqlite_url: str = "") -> dict[str, Any]:
    """Average / totals for latency + best-effort token usage."""
    factory = get_session_factory(sqlite_url)
    with factory() as session:
        count = session.scalar(select(func.count()).select_from(SessionLog)) or 0
        if count == 0:
            return {
                "session_count": 0,
                "latency_ms": {
                    "avg_stt": 0.0,
                    "avg_agent": 0.0,
                    "avg_consenso": 0.0,
                    "avg_tts": 0.0,
                    "avg_total": 0.0,
                },
                "tokens": {
                    "tracked": False,
                    "total_prompt": 0,
                    "total_completion": 0,
                    "total": 0,
                    "avg_total": 0.0,
                },
                "consensus": {"avg_score": 0.0},
                "audit": {"approve": 0, "reject": 0},
            }

        avg_stt = session.scalar(select(func.avg(SessionLog.latency_stt_ms))) or 0.0
        avg_agent = session.scalar(select(func.avg(SessionLog.latency_agent_ms))) or 0.0
        avg_consenso = session.scalar(select(func.avg(SessionLog.latency_consenso_ms))) or 0.0
        avg_tts = session.scalar(select(func.avg(SessionLog.latency_tts_ms))) or 0.0
        avg_total = session.scalar(select(func.avg(SessionLog.latency_total_ms))) or 0.0
        avg_score = session.scalar(select(func.avg(SessionLog.consensus_score))) or 0.0
        tok_prompt = session.scalar(select(func.sum(SessionLog.tokens_prompt))) or 0
        tok_completion = session.scalar(select(func.sum(SessionLog.tokens_completion))) or 0
        tok_total = session.scalar(select(func.sum(SessionLog.tokens_total))) or 0
        avg_tok = session.scalar(select(func.avg(SessionLog.tokens_total))) or 0.0

        approve = (
            session.scalar(
                select(func.count())
                .select_from(AuditTrail)
                .where(AuditTrail.decision == "approve")
            )
            or 0
        )
        reject = (
            session.scalar(
                select(func.count())
                .select_from(AuditTrail)
                .where(AuditTrail.decision == "reject")
            )
            or 0
        )

        return {
            "session_count": int(count),
            "latency_ms": {
                "avg_stt": float(avg_stt),
                "avg_agent": float(avg_agent),
                "avg_consenso": float(avg_consenso),
                "avg_tts": float(avg_tts),
                "avg_total": float(avg_total),
            },
            "tokens": {
                "tracked": bool(tok_total),
                "total_prompt": int(tok_prompt),
                "total_completion": int(tok_completion),
                "total": int(tok_total),
                "avg_total": float(avg_tok),
            },
            "consensus": {"avg_score": float(avg_score)},
            "audit": {"approve": int(approve), "reject": int(reject)},
        }


def store_context_note(
    *,
    content: str,
    client_id: str = "default",
    tag: str = "geral",
    request_id: str | None = None,
    source: str = "gemini_fc",
    sqlite_url: str = "",
) -> dict[str, Any]:
    """Persist a short context note for Gemini FC (never stores secrets)."""
    cleaned = " ".join((content or "").split())
    if not cleaned:
        return {"ok": False, "error": "empty_content"}
    if len(cleaned) > 2000:
        cleaned = cleaned[:2000]
    tag_clean = (tag or "geral").strip().lower()[:64] or "geral"
    try:
        factory = get_session_factory(sqlite_url)
        with factory() as session:
            note = ContextNote(
                timestamp=utc_now(),
                client_id=client_id or "default",
                tag=tag_clean,
                content=cleaned,
                source=source or "gemini_fc",
                request_id=request_id,
            )
            session.add(note)
            session.commit()
            session.refresh(note)
            return {
                "ok": True,
                "id": note.id,
                "tag": note.tag,
                "client_id": note.client_id,
                "content_preview": note.content[:160],
            }
    except Exception as exc:  # noqa: BLE001
        logger.exception("store_context_note failed: %s", exc)
        return {"ok": False, "error": "sqlite_write_failed", "detail": type(exc).__name__}


def list_context_notes(
    *,
    client_id: str | None = None,
    tag: str | None = None,
    limit: int = 20,
    sqlite_url: str = "",
) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit or 20), 50))
    factory = get_session_factory(sqlite_url)
    with factory() as session:
        stmt = select(ContextNote).order_by(desc(ContextNote.timestamp)).limit(limit)
        if client_id:
            stmt = stmt.where(ContextNote.client_id == client_id)
        if tag:
            stmt = stmt.where(ContextNote.tag == tag.strip().lower())
        rows = session.scalars(stmt).all()
        return [
            {
                "id": row.id,
                "timestamp": row.timestamp.isoformat() if row.timestamp else None,
                "client_id": row.client_id,
                "tag": row.tag,
                "content": row.content,
                "source": row.source,
                "request_id": row.request_id,
            }
            for row in rows
        ]
