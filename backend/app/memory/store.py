"""
JSON-backed long-term memory store (Gen-1).

Persists interaction history + learned preferences under backend/data/.
Designed for async background writes — never block the Live audio path.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import Settings, get_settings

logger = logging.getLogger("aether.memory.store")

HISTORY_CAP = 80


@dataclass
class Preferences:
    tone: str = "direct"  # direct | warm | formal
    style: str = "concise"  # concise | technical | detailed
    language: str | None = None
    technical_level: str = "balanced"  # simple | balanced | advanced
    notes: str = ""
    frequent_commands: list[str] = field(default_factory=list)
    updated_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> Preferences:
        if not isinstance(raw, dict):
            return cls()
        cmds = raw.get("frequent_commands") or []
        if not isinstance(cmds, list):
            cmds = []
        return cls(
            tone=str(raw.get("tone") or "direct"),
            style=str(raw.get("style") or "concise"),
            language=(str(raw["language"]) if raw.get("language") else None),
            technical_level=str(raw.get("technical_level") or "balanced"),
            notes=str(raw.get("notes") or ""),
            frequent_commands=[str(c) for c in cmds if str(c).strip()][:12],
            updated_at=float(raw.get("updated_at") or 0),
        )


@dataclass
class Interaction:
    role: str  # user | aether
    text: str
    at: float
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Profile:
    profile_id: str
    preferences: Preferences = field(default_factory=Preferences)
    history: list[Interaction] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "preferences": self.preferences.to_dict(),
            "history": [h.to_dict() for h in self.history[-HISTORY_CAP:]],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> Profile:
        history_raw = raw.get("history") or []
        history: list[Interaction] = []
        if isinstance(history_raw, list):
            for item in history_raw:
                if not isinstance(item, dict):
                    continue
                text = str(item.get("text") or "").strip()
                role = str(item.get("role") or "user")
                if not text:
                    continue
                history.append(
                    Interaction(
                        id=str(item.get("id") or uuid.uuid4().hex[:12]),
                        role=role if role in {"user", "aether"} else "user",
                        text=text[:800],
                        at=float(item.get("at") or time.time()),
                    )
                )
        return cls(
            profile_id=str(raw.get("profile_id") or "local"),
            preferences=Preferences.from_dict(
                raw.get("preferences") if isinstance(raw.get("preferences"), dict) else {}
            ),
            history=history[-HISTORY_CAP:],
            created_at=float(raw.get("created_at") or time.time()),
            updated_at=float(raw.get("updated_at") or time.time()),
        )


class MemoryStore:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._profiles: dict[str, Profile] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            profiles = raw.get("profiles", {}) if isinstance(raw, dict) else {}
            if isinstance(profiles, dict):
                for key, value in profiles.items():
                    if isinstance(value, dict):
                        value.setdefault("profile_id", key)
                        self._profiles[str(key)] = Profile.from_dict(value)
        except Exception as exc:
            logger.warning("failed to load memory store %s: %s", self._path, exc)

    def _persist(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "profiles": {pid: p.to_dict() for pid, p in self._profiles.items()},
            "updated_at": time.time(),
        }
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp.replace(self._path)

    def _ensure_unlocked(self, profile_id: str) -> Profile:
        """Must be called while holding ``self._lock``."""
        pid = (profile_id or "local").strip() or "local"
        existing = self._profiles.get(pid)
        if existing:
            return existing
        profile = Profile(profile_id=pid)
        self._profiles[pid] = profile
        return profile

    def get_or_create(self, profile_id: str) -> Profile:
        pid = (profile_id or "local").strip() or "local"
        with self._lock:
            existed = pid in self._profiles
            profile = self._ensure_unlocked(pid)
            if not existed:
                self._persist()
            return profile

    def snapshot(self, profile_id: str) -> dict[str, Any]:
        with self._lock:
            return self._ensure_unlocked(profile_id).to_dict()

    def append_interaction(self, profile_id: str, role: str, text: str) -> Interaction | None:
        cleaned = (text or "").strip()
        if not cleaned:
            return None
        role_n = "aether" if role == "aether" else "user"
        with self._lock:
            profile = self._ensure_unlocked(profile_id)
            # Skip near-duplicate of the latest turn (text + transcript can both fire).
            if profile.history:
                last = profile.history[-1]
                if last.role == role_n and last.text == cleaned[:800]:
                    return last
            entry = Interaction(role=role_n, text=cleaned[:800], at=time.time())
            profile.history.append(entry)
            if len(profile.history) > HISTORY_CAP:
                profile.history = profile.history[-HISTORY_CAP:]
            profile.updated_at = time.time()
            self._persist()
            return entry

    def update_preferences(
        self,
        profile_id: str,
        *,
        preferences: dict[str, Any] | None = None,
        merge: bool = True,
    ) -> Preferences:
        with self._lock:
            profile = self._ensure_unlocked(profile_id)
            if not merge or not preferences:
                if preferences is not None:
                    profile.preferences = Preferences.from_dict(preferences)
            else:
                current = profile.preferences.to_dict()
                current.update({k: v for k, v in preferences.items() if v is not None})
                profile.preferences = Preferences.from_dict(current)
            profile.preferences.updated_at = time.time()
            profile.updated_at = time.time()
            self._persist()
            return profile.preferences

    def clear_profile(self, profile_id: str, *, keep_preferences: bool = False) -> dict[str, Any]:
        pid = (profile_id or "local").strip() or "local"
        with self._lock:
            if keep_preferences and pid in self._profiles:
                prefs = self._profiles[pid].preferences
                self._profiles[pid] = Profile(profile_id=pid, preferences=prefs)
            else:
                self._profiles[pid] = Profile(profile_id=pid)
            self._persist()
            return self._profiles[pid].to_dict()

    def clear_history(self, profile_id: str) -> dict[str, Any]:
        return self.clear_profile(profile_id, keep_preferences=True)


@lru_cache
def get_memory_store() -> MemoryStore:
    settings: Settings = get_settings()
    path = Path(settings.memory_path)
    if not path.is_absolute():
        # Prefer backend/data relative to package, fall back to cwd.
        backend_root = Path(__file__).resolve().parent.parent.parent
        path = backend_root / path
    return MemoryStore(path)
