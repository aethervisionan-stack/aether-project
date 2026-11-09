"""
Motor de Segurança / Guardrails — lightweight sanitization for Live text.

Designed for open-ear / HUD delivery: strip fluff and formatting noise with
pure in-memory rules so realtime latency stays in the milliseconds range.
Audio PCM is never processed here.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any

logger = logging.getLogger("aether.safety")

# Soft cap for a single transcript fragment (HUD stays scannable).
_MAX_FRAGMENT_CHARS = 480

# Event types that carry AI-facing prose to the browser.
_AI_TEXT_EVENT_TYPES = frozenset({"aether_transcript"})

# Conversational openers that waste open-ear airtime (EN + PT).
_PROLIX_INTRO = re.compile(
    r"^\s*(?:"
    r"(?:sure|certainly|absolutely|of course|great question|good question|"
    r"no problem|happy to help|"
    r"i(?:'d| would) be happy to(?: help)?|"
    r"as an ai(?: language model)?|as a language model|"
    r"let me (?:help|explain|clarify)|i(?:'m| am) (?:glad|happy) (?:to help|to|you asked)|"
    r"claro(?: que sim)?|com certeza|sem problemas|boa pergunta|"
    r"fico feliz em ajudar|como (?:uma? )?ia|deixe[- ]me (?:ajudar|explicar)|"
    r"obrigad[oa] por (?:perguntar|a pergunta)"
    r")"
    r"[\s,!:.\-—–]*"
    r")+",
    re.IGNORECASE,
)

# Markdown / chat artifacts that pollute a minimal HUD line.
_MD_BOLD_ITALIC = re.compile(r"(\*\*|__|\*|_|&quot;)+")
_MD_CODE_FENCE = re.compile(r"```[\w+-]*\n?|```")
_MD_INLINE_CODE = re.compile(r"`([^`]+)`")
_MD_HEADING = re.compile(r"(?m)^\s{0,3}#{1,6}\s+|#{1,6}\s+")
_MD_BULLET = re.compile(r"(?m)^\s*[-*+]\s+")
_MD_NUMBERED = re.compile(r"(?m)^\s*\d+[.)]\s+")
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_HTML_TAG = re.compile(r"</?[a-zA-Z][^>]*>")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")
_MULTI_NL = re.compile(r"\n{3,}")
# Replacement chars / nulls / most C0 controls (keep \n \t).
_CORRUPT_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]")


def _sync_sanitize(text: str) -> str | None:
    """CPU-bound sanitize path — keep tiny and allocation-light."""
    if not isinstance(text, str):
        return None

    cleaned = unicodedata.normalize("NFKC", text)
    cleaned = _CORRUPT_CTRL.sub("", cleaned)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = _HTML_TAG.sub("", cleaned)
    cleaned = _MD_CODE_FENCE.sub("", cleaned)
    cleaned = _MD_INLINE_CODE.sub(r"\1", cleaned)
    cleaned = _MD_LINK.sub(r"\1", cleaned)
    cleaned = _MD_HEADING.sub("", cleaned)
    cleaned = _MD_BULLET.sub("", cleaned)
    cleaned = _MD_NUMBERED.sub("", cleaned)
    cleaned = _MD_BOLD_ITALIC.sub("", cleaned)
    cleaned = _PROLIX_INTRO.sub("", cleaned)
    cleaned = _MULTI_NL.sub("\n\n", cleaned)
    cleaned = _MULTI_SPACE.sub(" ", cleaned)
    cleaned = cleaned.strip(" \t\n\"'“”‘’")

    if not cleaned or cleaned.isspace():
        return None

    # Reject fragments that are only punctuation / symbols after cleanup.
    if not any(ch.isalnum() for ch in cleaned):
        return None

    if len(cleaned) > _MAX_FRAGMENT_CHARS:
        trimmed = cleaned[: _MAX_FRAGMENT_CHARS - 1].rstrip()
        # Prefer cutting on a word boundary when cheap.
        space = trimmed.rfind(" ")
        if space >= int(_MAX_FRAGMENT_CHARS * 0.6):
            trimmed = trimmed[:space]
        cleaned = trimmed + "…"

    return cleaned


async def sanitize_and_validate_response(text: str) -> str | None:
    """
    Sanitize AI-generated text before WebSocket delivery.

    Returns cleaned text, or ``None`` when the fragment should be dropped
    (empty / corrupt after rules). Pure in-memory; safe to await on the
    Live event path without offloading.
    """
    return _sync_sanitize(text)


async def sanitize_outbound_event(event: dict[str, Any]) -> dict[str, Any] | None:
    """
    Apply guardrails to outbound Live JSON events that carry AI text.

    Heartbeat/control events and non-text payloads pass through unchanged.
    Returns ``None`` when the event should be suppressed entirely.
    """
    if not isinstance(event, dict):
        return None

    event_type = event.get("type")
    if event_type not in _AI_TEXT_EVENT_TYPES:
        return event

    raw = event.get("text")
    original = "" if raw is None else str(raw)
    cleaned = await sanitize_and_validate_response(original)
    if cleaned is None:
        logger.debug("guardrails dropped empty/corrupt %s fragment", event_type)
        return None

    if cleaned == original:
        return event

    out = dict(event)
    out["text"] = cleaned
    return out
