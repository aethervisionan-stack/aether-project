"""SQLAlchemy models — SessionLogs + AuditTrail (AAV-11)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class SessionLog(Base):
    """One row per completed POST /process-audio turn (table: session_logs)."""

    __tablename__ = "session_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
    request_id: Mapped[str] = mapped_column(String(64), index=True, unique=True)
    client_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    transcription: Mapped[str] = mapped_column(Text, default="")
    agent_response: Mapped[str] = mapped_column(Text, default="")
    tools_invoked: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    latency_stt_ms: Mapped[int] = mapped_column(Integer, default=0)
    latency_agent_ms: Mapped[int] = mapped_column(Integer, default=0)
    latency_consenso_ms: Mapped[int] = mapped_column(Integer, default=0)
    latency_tts_ms: Mapped[int] = mapped_column(Integer, default=0)
    latency_total_ms: Mapped[int] = mapped_column(Integer, default=0)
    consensus_score: Mapped[float] = mapped_column(Float, default=0.0)
    # Optional usage counters (best-effort; 0 when providers do not report)
    tokens_prompt: Mapped[int] = mapped_column(Integer, default=0)
    tokens_completion: Mapped[int] = mapped_column(Integer, default=0)
    tokens_total: Mapped[int] = mapped_column(Integer, default=0)


class AuditTrail(Base):
    """Consenso Alfa approve/reject decision per tool call (table: audit_trail)."""

    __tablename__ = "audit_trail"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    client_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    tool_name: Mapped[str] = mapped_column(String(128), index=True)
    decision: Mapped[str] = mapped_column(String(32), index=True)  # approve | reject
    reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    arguments_json: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    consensus_score: Mapped[float | None] = mapped_column(Float, nullable=True)


class ContextNote(Base):
    """User/context notes stored by Gemini function calling (table: context_notes)."""

    __tablename__ = "context_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
    client_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    tag: Mapped[str] = mapped_column(String(64), index=True, default="geral")
    content: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(64), default="gemini_fc")
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
