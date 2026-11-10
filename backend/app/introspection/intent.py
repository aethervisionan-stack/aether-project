"""Detect self-knowledge / vision / capabilities questions that require system_help_tool."""

from __future__ import annotations

import re

# Capability / vision / value / tools questions — MUST route through system_help_tool.
_HELP_INTENT = re.compile(
    r"(?:"
    r"what\s+can\s+you|"
    r"what\s+do\s+you\s+(?:do|offer)|"
    r"what\s+are\s+you|"
    r"who\s+are\s+you|"
    r"your\s+(?:capabilities|features|tools|vision|purpose|value)|"
    r"system\s+health|system\s+status|"
    r"self[- ]?aware|introspection|"
    r"capabilities|capacidade|capacidades|"
    r"o\s+que\s+(?:voc[eê]|tu)\s+(?:consegue|pode|faz|sabe)|"
    r"o\s+que\s+(?:voc[eê]|tu)\s+[eé]|"
    r"quem\s+[eé]\s+(?:voc[eê]|tu)|"
    r"o\s+que\s+[eé]\s+(?:a\s+)?aether|"
    r"vis[aã]o\s+(?:do\s+)?(?:projeto|aether|produto)|"
    r"proposta\s+de\s+valor|value\s+proposition|"
    r"ferramentas?\s+(?:ativas|dispon|available)|"
    r"(?:available|active)\s+tools|"
    r"\bajuda\b|\bhelp\b|"
    r"sa[uú]de\s+do\s+sistema|\bttft\b|"
    r"o\s+que\s+consegue"
    r")",
    re.IGNORECASE,
)

_HEALTH_KEYS = (
    "health",
    "ttft",
    "latency",
    "status",
    "integra",
    "saúde",
    "saude",
)


def is_self_knowledge_intent(text: str) -> bool:
    """True when the user asks about vision, capabilities, value, tools, or health."""
    cleaned = (text or "").strip()
    if not cleaned:
        return False
    return bool(_HELP_INTENT.search(cleaned))


def help_tool_action(text: str) -> str:
    """Pick get_system_health vs get_system_capabilities from user text."""
    lower = (text or "").lower()
    if any(k in lower for k in _HEALTH_KEYS):
        return "get_system_health"
    return "get_system_capabilities"
