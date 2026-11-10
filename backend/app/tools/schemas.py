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
        "description": "Read or patch long-term memory preferences / history for the active profile.",
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
            "Read/summarize/voice-reply WhatsApp, Telegram, SMS, Instagram Direct. "
            "Send/voice_reply require two-step voice confirmation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["read", "summarize", "send", "voice_reply"],
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
            "Priority email read, dictation drafts, schedule appointments, agenda query. "
            "send_draft/schedule/delete require two-step confirmation."
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
            "Incoming call ID ('Carlos is calling. Speaker or decline?'), "
            "answer/decline, place calls. Mutating call actions need confirmation."
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
        "description": "Media playback, battery, volume/sound modes, timers/alarms via OS adapters.",
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
            "REQUIRED for questions about Aether Vision project vision, what the AI can do, "
            "value proposition, available tools, or system health. Returns the full manifesto "
            "(hands-free wearables/earbuds OS — not a WhatsApp-manager pitch), capabilities, "
            "practical voice examples, and/or live health (version, TTFT, integrations). "
            "Actions: get_system_capabilities (optional category) and get_system_health. "
            "Read-only — no two-step confirmation."
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
]


def schema_by_name(name: str) -> ToolSchema | None:
    for schema in TOOL_SCHEMAS:
        if schema["name"] == name:
            return schema
    return None


def schemas_for_prompt() -> list[dict[str, Any]]:
    return [dict(s) for s in TOOL_SCHEMAS]
