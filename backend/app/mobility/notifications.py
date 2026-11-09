"""Parse raw notifications into actionable operational summaries."""

from __future__ import annotations

import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class NotificationAction:
    id: str
    source: str
    title: str
    body: str
    summary: str
    suggested_reply: str | None
    awaiting_confirmation: bool = True
    priority: str = "normal"  # critical | normal | secondary
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_LATE_RE = re.compile(
    r"(atrasad|atrasar|late|chegar|arrive|chegada|on my way|a caminho)",
    re.IGNORECASE,
)
_MEETING_RE = re.compile(
    r"(reuni[aã]o|meeting|call|zoom|teams|hangouts)",
    re.IGNORECASE,
)
_ASK_RE = re.compile(
    r"(pergunt|asked|ask(?:ed)?|quer saber|pode|can you|could you|\?)",
    re.IGNORECASE,
)
_URGENT_RE = re.compile(
    r"(urgent|urgente|asap|emerg|911|sos|critical|cr[ií]tic)",
    re.IGNORECASE,
)


def parse_notification(
    *,
    source: str = "unknown",
    title: str = "",
    body: str = "",
    raw: str | None = None,
    sender: str | None = None,
) -> NotificationAction:
    """
    Turn a raw notification into an operational summary waiting for voice/tap confirm.

    Examples:
      João: "Você vai se atrasar?" →
      "João asked if you'll be late. Reply that you arrive in 10 min?"
    """
    text = (raw or "").strip()
    if not text:
        text = f"{title}\n{body}".strip()
    title_s = (title or "").strip() or _guess_title(text)
    body_s = (body or "").strip() or text
    who = (sender or "").strip() or _guess_sender(title_s, text) or "Someone"

    suggested: str | None = None
    summary: str

    if _LATE_RE.search(text) and _ASK_RE.search(text):
        summary = f"{who} asked if you'll be late. Reply that you arrive in 10 min?"
        suggested = "I'll arrive in about 10 minutes."
    elif _MEETING_RE.search(text) and _ASK_RE.search(text):
        summary = f"{who} messaged about a meeting. Confirm you'll join on time?"
        suggested = "Yes — I'll be there on time."
    elif _ASK_RE.search(text):
        summary = f"{who} asked something. Draft a short yes/ack reply?"
        suggested = "Got it — I'll get back to you shortly."
    else:
        summary = f"New from {who}: {_clip(body_s or title_s, 120)}. Read aloud or dismiss?"
        suggested = None

    priority = "critical" if _URGENT_RE.search(text) else "normal"
    return NotificationAction(
        id=uuid.uuid4().hex[:12],
        source=(source or "unknown").strip() or "unknown",
        title=title_s[:160],
        body=_clip(body_s, 400),
        summary=summary,
        suggested_reply=suggested,
        awaiting_confirmation=True,
        priority=priority,
    )


def _guess_sender(title: str, text: str) -> str | None:
    for candidate in (title, text.split(":", 1)[0] if ":" in text else ""):
        cleaned = candidate.strip()
        if not cleaned or len(cleaned) > 40:
            continue
        if re.match(r"^[\w][\w .\-]{1,38}$", cleaned, re.UNICODE):
            # Avoid treating app names as people when obviously system-y.
            if cleaned.lower() in {"sms", "whatsapp", "telegram", "mail", "gmail", "slack"}:
                continue
            return cleaned
    return None


def _guess_title(text: str) -> str:
    first = (text.split("\n", 1)[0] or "").strip()
    return first[:80] if first else "Notification"


def _clip(value: str, n: int) -> str:
    s = value.strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"
