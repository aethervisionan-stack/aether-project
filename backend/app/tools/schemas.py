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
]

ToolName = Literal[
    "solana_treasury_query",
    "onchain_lookup",
    "run_test_routine",
    "memory_payload",
]


def schema_by_name(name: str) -> ToolSchema | None:
    for schema in TOOL_SCHEMAS:
        if schema["name"] == name:
            return schema
    return None


def schemas_for_prompt() -> list[dict[str, Any]]:
    return [dict(s) for s in TOOL_SCHEMAS]
