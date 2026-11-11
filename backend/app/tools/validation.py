"""Strict Pydantic param validation for the 9 Tool Registry tools."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SolanaTreasuryArgs(StrictModel):
    wallet: str | None = None


class OnchainLookupArgs(StrictModel):
    address: str
    method: Literal["getBalance", "getAccountInfo"] = "getBalance"


class RunTestRoutineArgs(StrictModel):
    routine: Literal["health", "memory_snapshot", "latency_targets"]


class MemoryPayloadArgs(StrictModel):
    action: Literal["get", "patch_prefs", "clear_history"]
    preferences: dict[str, Any] | None = None


class MessagingToolArgs(StrictModel):
    action: Literal["read", "summarize", "send", "voice_reply"]
    app: Literal["whatsapp", "telegram", "sms", "instagram"] | None = None
    contact: str | None = None
    text: str | None = None
    limit: int | None = Field(default=None, ge=1, le=50)
    confirmed: bool | None = None
    pending_id: str | None = None


class EmailCalendarArgs(StrictModel):
    action: Literal[
        "read_email",
        "priority_email",
        "draft",
        "send_draft",
        "schedule",
        "agenda",
        "query_agenda",
        "delete",
    ]
    to: str | None = None
    subject: str | None = None
    body: str | None = None
    text: str | None = None
    draft_id: str | None = None
    title: str | None = None
    when: str | None = None
    duration_min: int | None = Field(default=None, ge=1, le=480)
    attendees: list[str] | None = None
    day: str | None = None
    event_id: str | None = None
    limit: int | None = Field(default=None, ge=1, le=50)
    confirmed: bool | None = None
    pending_id: str | None = None


class TelephonyArgs(StrictModel):
    action: Literal["incoming", "identify", "answer", "decline", "place_call"]
    contact: str | None = None
    speaker: bool | None = None
    confirmed: bool | None = None
    pending_id: str | None = None


class SystemControlArgs(StrictModel):
    action: Literal["media", "battery", "volume", "sound_mode", "timer", "alarm"]
    media_action: Literal["play", "pause", "next", "previous", "stop"] | None = None
    level: int | None = Field(default=None, ge=0, le=100)
    mode: Literal["normal", "vibrate", "silent"] | None = None
    minutes: int | None = Field(default=None, ge=1, le=180)
    time: str | None = None
    time_hhmm: str | None = None
    label: str | None = None
    media: str | None = None


class SystemHelpArgs(StrictModel):
    action: Literal["get_system_capabilities", "get_system_health"] | None = None
    category: str | None = None
    op: str | None = None


class DeepResearchArgs(StrictModel):
    topic: str
    open_in_canvas: bool | None = True
    max_subquestions: int | None = Field(default=None, ge=2, le=8)
    canvas_doc_id: str | None = None


class CanvasEditArgs(StrictModel):
    action: Literal["list", "create", "get", "propose", "accept", "reject"]
    doc_id: str | None = None
    title: str | None = None
    markdown: str | None = None
    kind: Literal["article", "code", "docs", "research"] | None = None
    instruction: str | None = None
    text: str | None = None
    diff_id: str | None = None


TOOL_ARG_MODELS: dict[str, type[StrictModel]] = {
    "solana_treasury_query": SolanaTreasuryArgs,
    "onchain_lookup": OnchainLookupArgs,
    "run_test_routine": RunTestRoutineArgs,
    "memory_payload": MemoryPayloadArgs,
    "messaging_tool": MessagingToolArgs,
    "email_calendar_tool": EmailCalendarArgs,
    "telephony_tool": TelephonyArgs,
    "system_control_tool": SystemControlArgs,
    "system_help_tool": SystemHelpArgs,
    "deep_research_tool": DeepResearchArgs,
    "canvas_edit_tool": CanvasEditArgs,
}


def validate_tool_args(name: str, args: dict[str, Any] | None) -> tuple[dict[str, Any] | None, str | None]:
    """Return (normalized_args, error). Unknown tools skip strict validation."""
    model = TOOL_ARG_MODELS.get(name)
    if model is None:
        return dict(args or {}), None
    try:
        parsed = model.model_validate(args or {})
        return parsed.model_dump(exclude_none=True), None
    except ValidationError as exc:
        err = exc.errors()[0] if exc.errors() else {"msg": str(exc)}
        loc = ".".join(str(x) for x in err.get("loc", ()))
        msg = str(err.get("msg") or "validation failed")
        return None, f"{loc}: {msg}" if loc else msg
