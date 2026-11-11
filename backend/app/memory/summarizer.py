"""
Background semantic summaries for long chats — keeps the Live context window clean.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

from app.memory.store import get_memory_store
from app.memory.vector_store import get_vector_store

logger = logging.getLogger("aether.memory.summarizer")

_SUMMARY_EVERY_N = 8
_MIN_TURNS = 6
_locks: dict[str, threading.Lock] = {}
_counts: dict[str, int] = {}


def _lock_for(profile_id: str) -> threading.Lock:
    if profile_id not in _locks:
        _locks[profile_id] = threading.Lock()
    return _locks[profile_id]


def summarize_profile(profile_id: str = "local", *, force: bool = False) -> dict[str, Any]:
    """
    Build a compact rolling summary from recent history and upsert into vector memory.
    CPU-only heuristic (no LLM call) so Live TTFT stays untouched.
    """
    pid = (profile_id or "local").strip() or "local"
    with _lock_for(pid):
        store = get_memory_store()
        snap = store.snapshot(pid)
        history = snap.get("history") or []
        if not isinstance(history, list):
            history = []
        if not force and len(history) < _MIN_TURNS:
            return {"ok": True, "skipped": True, "reason": "too_few_turns"}

        recent = history[-24:]
        user_bits: list[str] = []
        aether_bits: list[str] = []
        for item in recent:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            role = str(item.get("role") or "user")
            if role == "aether":
                aether_bits.append(text[:160])
            else:
                user_bits.append(text[:160])

        prefs = snap.get("preferences") if isinstance(snap.get("preferences"), dict) else {}
        pref_line = ""
        if prefs:
            pref_line = (
                f"tone={prefs.get('tone')}; style={prefs.get('style')}; "
                f"tech={prefs.get('technical_level')}; lang={prefs.get('language')}"
            )

        summary = (
            f"Rolling memory summary @ {time.strftime('%Y-%m-%d %H:%M')}. "
            + (f"Prefs: {pref_line}. " if pref_line else "")
            + ("User themes: " + " | ".join(user_bits[-6:]) + ". " if user_bits else "")
            + ("Aether themes: " + " | ".join(aether_bits[-4:]) + "." if aether_bits else "")
        ).strip()

        vectors = get_vector_store()
        rec = vectors.upsert(
            profile_id=pid,
            text=summary,
            kind="summary",
            meta={"turns": len(history), "source": "summarizer"},
            record_id=f"summary-{pid}",
        )
        try:
            from app.memory.cloud_vector import mirror_local_upsert

            mirror_local_upsert(
                profile_id=pid,
                text=summary,
                kind="summary",
                meta={"turns": len(history), "source": "summarizer"},
                record_id=f"summary-{pid}",
            )
        except Exception:
            logger.debug("cloud summary mirror skipped", exc_info=True)

        if prefs:
            pref_text = pref_line or str(prefs)
            try:
                vectors.upsert(
                    profile_id=pid,
                    text=f"User preferences: {pref_text}",
                    kind="preference",
                    meta={"source": "summarizer"},
                    record_id=f"pref-{pid}",
                )
                from app.memory.cloud_vector import mirror_local_upsert

                mirror_local_upsert(
                    profile_id=pid,
                    text=f"User preferences: {pref_text}",
                    kind="preference",
                    meta={"source": "summarizer"},
                    record_id=f"pref-{pid}",
                )
            except Exception:
                logger.debug("preference vector mirror skipped", exc_info=True)

        # Also index last user turns for retrieval.
        for item in recent[-6:]:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            vectors.upsert(
                profile_id=pid,
                text=text,
                kind="interaction",
                meta={"role": item.get("role"), "at": item.get("at")},
            )
            try:
                from app.memory.cloud_vector import mirror_local_upsert

                mirror_local_upsert(
                    profile_id=pid,
                    text=text,
                    kind="interaction",
                    meta={"role": item.get("role"), "at": item.get("at")},
                )
            except Exception:
                logger.debug("cloud interaction mirror skipped", exc_info=True)

        return {
            "ok": True,
            "skipped": False,
            "summary_id": rec.id,
            "summary": summary[:500],
            "indexed_turns": min(6, len(recent)),
        }


def maybe_summarize_after_turn(profile_id: str = "local") -> None:
    """Fire-and-forget counter; summarize every N user/aether turns."""
    pid = (profile_id or "local").strip() or "local"
    _counts[pid] = _counts.get(pid, 0) + 1
    if _counts[pid] % _SUMMARY_EVERY_N != 0:
        return

    def _bg() -> None:
        try:
            summarize_profile(pid)
        except Exception:
            logger.debug("background summarize failed", exc_info=True)

    threading.Thread(target=_bg, name=f"mem-sum-{pid}", daemon=True).start()
