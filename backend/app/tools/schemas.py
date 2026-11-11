"""Strict tool schema definitions shared by the registry (JSON-schema shaped)."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


class ToolParamSchema(TypedDict, total=False):
    type: str
    description: str
    enum: list[str]
    default: Any


class ToolSchema(TypedDict):
    name: str
    description: str
    parameters: dict[str, Any]


TOOL_SCHEMAS: list[ToolSchema] = [
    {
        "name": "solana_treasury_query",
        "description": "Query Aether Vision Solana treasury SOL balance and wallet metadata.",
        "parameters": {
            "type": "object",
            "properties": {
                "wallet": {
                    "type": "string",
                    "description": "Optional wallet override; defaults to official treasury.",
                }
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "onchain_lookup",
        "description": "Lightweight on-chain data lookup (RPC getBalance / getAccountInfo style).",
        "parameters": {
            "type": "object",
            "properties": {
                "address": {"type": "string", "description": "Solana address to inspect."},
                "method": {
                    "type": "string",
                    "enum": ["getBalance", "getAccountInfo"],
                    "description": "RPC method shorthand.",
                },
            },
            "required": ["address"],
            "additionalProperties": False,
        },
    },
    {
        "name": "run_test_routine",
        "description": "Run a named Gen-1 health/test routine (latency, memory, live bridge).",
        "parameters": {
            "type": "object",
            "properties": {
                "routine": {
                    "type": "string",
                    "enum": ["health", "memory_snapshot", "latency_targets"],
                }
            },
            "required": ["routine"],
            "additionalProperties": False,
        },
    },
    {
        "name": "memory_payload",
        "description": (
            "Long-term memory. Trigger when the user asks what you remember, to change "
            "tone/style/language preferences, clear history, or inspect learned habits. "
            "action=get to read; patch_prefs to update; clear_history to wipe turns."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["get", "patch_prefs", "clear_history"],
                },
                "preferences": {
                    "type": "object",
                    "description": "Partial preference patch when action=patch_prefs.",
                },
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "name": "messaging_tool",
        "description": (
            "OS Agent — messaging & notification threads. Trigger immediately (no hesitation) "
            "when the user asks to read, check, summarize, catch up on, or reply to "
            "WhatsApp / Telegram / SMS / Instagram DMs, or to review message notifications. "
            "Default to action=read or summarize with the named contact/app. "
            "action=send or voice_reply ONLY after two-step voice confirm (confirmed=true)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["read", "summarize", "send", "voice_reply"],
                    "description": (
                        "read/summarize = safe notification/thread intake; "
                        "send/voice_reply = irreversible, needs confirmed=true."
                    ),
                },
                "app": {
                    "type": "string",
                    "enum": ["whatsapp", "telegram", "sms", "instagram"],
                },
                "contact": {"type": "string", "description": "Contact or chat name."},
                "text": {"type": "string", "description": "Message body for send/voice_reply."},
                "limit": {"type": "integer", "description": "Thread/message limit."},
                "confirmed": {
                    "type": "boolean",
                    "description": "True only after user voice/tap confirm.",
                },
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "name": "email_calendar_tool",
        "description": (
            "OS Agent — email & calendar. Trigger immediately when the user asks about "
            "inbox priority, draft/dictate email, today's agenda, schedule, or cancel "
            "appointments. Prefer read_email / priority_email / agenda / query_agenda first. "
            "send_draft / schedule / delete require two-step confirmation (confirmed=true)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": [
                        "read_email",
                        "priority_email",
                        "draft",
                        "send_draft",
                        "schedule",
                        "agenda",
                        "query_agenda",
                        "delete",
                    ],
                },
                "to": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "text": {"type": "string"},
                "draft_id": {"type": "string"},
                "title": {"type": "string"},
                "when": {"type": "string"},
                "duration_min": {"type": "integer"},
                "attendees": {"type": "array", "description": "Attendee names/emails."},
                "day": {"type": "string"},
                "event_id": {"type": "string"},
                "limit": {"type": "integer"},
                "confirmed": {"type": "boolean"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "name": "telephony_tool",
        "description": (
            "OS Agent — calls. Trigger immediately on incoming-call identity "
            "('who is calling'), answer/decline, or place a call. "
            "Mutating answer/decline/place_call need confirmation (confirmed=true)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["incoming", "identify", "answer", "decline", "place_call"],
                },
                "contact": {"type": "string"},
                "speaker": {"type": "boolean"},
                "confirmed": {"type": "boolean"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "name": "system_control_tool",
        "description": (
            "OS Agent — device controls. Trigger immediately for battery level, volume, "
            "sound mode, media play/pause/skip, timers, or alarms. No confirm for read/"
            "benign controls; still preview irreversible device changes when unsure."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["media", "battery", "volume", "sound_mode", "timer", "alarm"],
                },
                "media_action": {
                    "type": "string",
                    "enum": ["play", "pause", "next", "previous", "stop"],
                },
                "level": {"type": "integer", "description": "Volume 0–100."},
                "mode": {
                    "type": "string",
                    "enum": ["normal", "vibrate", "silent"],
                },
                "minutes": {"type": "integer"},
                "time": {"type": "string", "description": "Alarm HH:MM."},
                "label": {"type": "string"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "name": "system_help_tool",
        "description": (
            "Introspection manifesto — MANDATORY, trigger with zero hesitation whenever the "
            "user asks about Aether Vision project vision, what you can do, value proposition, "
            "available tools/capabilities, or system health. Returns the full wearables/"
            "earbuds OS manifesto (never a shallow WhatsApp-manager pitch), practical voice "
            "examples, and/or live health (version, TTFT, integrations). "
            "Actions: get_system_capabilities (optional category) and get_system_health. "
            "Read-only — no two-step confirmation. Do not improvise self-knowledge without it."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["get_system_capabilities", "get_system_health"],
                    "description": "Help operation to run.",
                },
                "category": {
                    "type": "string",
                    "description": (
                        "Optional capability category filter: identity, hands_free, "
                        "notifications, hardware, memory, frontier, billing, help, or all."
                    ),
                },
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
    {
        "name": "deep_research_tool",
        "description": (
            "Deep Research productivity. Trigger when the user asks to research, investigate, "
            "survey sources, or produce a detailed report on a topic. Pipeline: topic → "
            "sub-questions → parallel web search → trusted sources filter → Markdown report "
            "(opened in HUD Canvas when open_in_canvas=true)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "Research topic or question."},
                "open_in_canvas": {
                    "type": "boolean",
                    "description": "Open the Markdown report in the HUD Canvas editor.",
                    "default": True,
                },
                "max_subquestions": {
                    "type": "integer",
                    "description": "Number of sub-questions (2–8).",
                },
                "canvas_doc_id": {
                    "type": "string",
                    "description": "Optional existing Canvas doc id to overwrite.",
                },
            },
            "required": ["topic"],
            "additionalProperties": False,
        },
    },
    {
        "name": "canvas_edit_tool",
        "description": (
            "Collaborative Canvas editor. Trigger to list/create docs or propose/accept/"
            "reject semantic diffs so AI and user edit the same article/code/docs file."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["list", "create", "get", "propose", "accept", "reject"],
                },
                "doc_id": {"type": "string"},
                "title": {"type": "string"},
                "markdown": {"type": "string"},
                "kind": {
                    "type": "string",
                    "enum": ["article", "code", "docs", "research"],
                },
                "instruction": {"type": "string"},
                "text": {"type": "string"},
                "diff_id": {"type": "string"},
            },
            "required": ["action"],
            "additionalProperties": False,
        },
    },
]

ToolName = Literal[
    "solana_treasury_query",
    "onchain_lookup",
    "run_test_routine",
    "memory_payload",
    "messaging_tool",
    "email_calendar_tool",
    "telephony_tool",
    "system_control_tool",
    "system_help_tool",
    "deep_research_tool",
    "canvas_edit_tool",
]


def schema_by_name(name: str) -> ToolSchema | None:
    for schema in TOOL_SCHEMAS:
        if schema["name"] == name:
            return schema
    return None


def schemas_for_prompt() -> list[dict[str, Any]]:
    return [dict(s) for s in TOOL_SCHEMAS]
