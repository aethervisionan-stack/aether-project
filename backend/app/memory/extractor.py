"""
Lightweight preference extraction from recent interactions.

Rule-based and CPU-cheap — scheduled via asyncio.create_task / to_thread so
Live voice RTT is never blocked.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from typing import Any

from app.memory.store import MemoryStore, Preferences

logger = logging.getLogger("aether.memory.extractor")

_TECH_HINTS = re.compile(
    r"\b(api|latency|rpc|solana|websocket|fft|pcm|sdk|json|typescript|fastapi|"
    r"técnic[oa]|tecnico|detalh[ea]|advanced|debug|stack)\b",
    re.IGNORECASE,
)
_SIMPLE_HINTS = re.compile(
    r"\b(simple|simples|eli5|explain like|menos t[eé]cnico|leigo|beginner)\b",
    re.IGNORECASE,
)
_DIRECT_HINTS = re.compile(
    r"\b(direct|direto|curto|brief|concise|objetivo|sem enrola|"
    r"be short|keep it short|resum[ae])\b",
    re.IGNORECASE,
)
_WARM_HINTS = re.compile(
    r"\b(friendly|amig[aá]vel|please|por favor|gentil|warm)\b",
    re.IGNORECASE,
)
_DETAILED_HINTS = re.compile(
    r"\b(more detail|mais detalhe|explain more|explica melhor|expand)\b",
    re.IGNORECASE,
)
_PT_HINTS = re.compile(
    r"\b(obrigad[oa]|por favor|como|quero|preciso|voc[eê]|n[aã]o|sim)\b",
    re.IGNORECASE,
)
_EN_HINTS = re.compile(
    r"\b(please|thanks|need|want|how|what|the|and|you)\b",
    re.IGNORECASE,
)
_TOKEN = re.compile(r"[a-zA-ZÀ-ÿ0-9]{3,}")


def extract_preferences_from_history(
    history: list[dict[str, Any]] | list[Any],
    current: Preferences | None = None,
) -> Preferences:
    """Derive prefs from recent user turns. Pure sync — call via to_thread."""
    base = current or Preferences()
    user_texts = []
    for item in history:
        if isinstance(item, dict):
            role = item.get("role")
            text = str(item.get("text") or "")
        else:
            role = getattr(item, "role", None)
            text = str(getattr(item, "text", "") or "")
        if role == "user" and text.strip():
            user_texts.append(text.strip())

    if not user_texts:
        return base

    recent = user_texts[-24:]
    blob = "\n".join(recent)

    tone = base.tone
    style = base.style
    level = base.technical_level
    language = base.language

    if _DIRECT_HINTS.search(blob):
        tone = "direct"
        style = "concise"
    if _WARM_HINTS.search(blob) and not _DIRECT_HINTS.search(blob):
        tone = "warm"
    if _DETAILED_HINTS.search(blob):
        style = "detailed"
    if _TECH_HINTS.search(blob):
        style = "technical" if style != "detailed" else style
        level = "advanced"
    if _SIMPLE_HINTS.search(blob):
        level = "simple"
        if style == "technical":
            style = "concise"

    pt = len(_PT_HINTS.findall(blob))
    en = len(_EN_HINTS.findall(blob))
    if pt > en + 2:
        language = "pt"
    elif en > pt + 2:
        language = "en"

    # Frequent short commands / intents (3–5 token phrases).
    counter: Counter[str] = Counter()
    for text in recent:
        tokens = [t.lower() for t in _TOKEN.findall(text)]
        if 1 <= len(tokens) <= 6:
            phrase = " ".join(tokens[:5])
            if len(phrase) >= 4:
                counter[phrase] += 1
        for i in range(len(tokens) - 1):
            bigram = f"{tokens[i]} {tokens[i + 1]}"
            counter[bigram] += 1

    frequent = [p for p, n in counter.most_common(8) if n >= 2][:8]
    if not frequent:
        frequent = list(base.frequent_commands)

    notes = base.notes
    if level == "advanced" and "technical" not in notes:
        notes = (notes + " Prefers technical precision.").strip()
    if level == "simple" and "simple" not in notes.lower():
        notes = (notes + " Prefers simple explanations.").strip()

    return Preferences(
        tone=tone,
        style=style,
        language=language,
        technical_level=level,
        notes=notes[:400],
        frequent_commands=frequent or base.frequent_commands,
        updated_at=base.updated_at,
    )


def run_extraction(store: MemoryStore, profile_id: str) -> Preferences:
    """Load history, extract, persist — intended for background tasks."""
    snap = store.snapshot(profile_id)
    current = Preferences.from_dict(snap.get("preferences") or {})
    history = snap.get("history") or []
    prefs = extract_preferences_from_history(history, current)
    store.update_preferences(profile_id, preferences=prefs.to_dict(), merge=False)
    logger.debug(
        "memory extraction profile=%s tone=%s style=%s level=%s lang=%s",
        profile_id,
        prefs.tone,
        prefs.style,
        prefs.technical_level,
        prefs.language,
    )
    return prefs
