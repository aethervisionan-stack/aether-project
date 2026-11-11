"""
Long-term vector memory index for interactions / prefs / context.

Default backend: local JSON + deterministic bag-of-tokens embeddings (no extra deps).
Optional: set AETHER_VECTOR_BACKEND=chroma when chromadb is installed.
"""

from __future__ import annotations

import json
import logging
import math
import re
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

from app.config import Settings, get_settings

logger = logging.getLogger("aether.memory.vector")

_TOKEN = re.compile(r"[a-z0-9_#@]{2,}", re.I)
DIM = 192


@dataclass
class VectorRecord:
    id: str
    profile_id: str
    kind: str  # interaction | preference | summary | context
    text: str
    embedding: list[float]
    meta: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> VectorRecord:
        return cls(
            id=str(raw.get("id") or uuid.uuid4().hex[:12]),
            profile_id=str(raw.get("profile_id") or "local"),
            kind=str(raw.get("kind") or "context"),
            text=str(raw.get("text") or "")[:2000],
            embedding=[float(x) for x in (raw.get("embedding") or [])][:DIM],
            meta=raw.get("meta") if isinstance(raw.get("meta"), dict) else {},
            created_at=float(raw.get("created_at") or time.time()),
        )


def embed_text(text: str, *, dim: int = DIM) -> list[float]:
    """Deterministic sparse-ish embedding (Gen-1; swap for gateway embeddings later)."""
    vec = [0.0] * dim
    tokens = _TOKEN.findall((text or "").lower())
    if not tokens:
        return vec
    for tok in tokens[:256]:
        h = hash(tok) % (dim * 997)
        idx = h % dim
        sign = 1.0 if (h // dim) % 2 == 0 else -1.0
        vec[idx] += sign
        # Bigram boost
        if len(tok) > 3:
            idx2 = (h * 13) % dim
            vec[idx2] += 0.35 * sign
    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    return sum(a[i] * b[i] for i in range(n))


class VectorStore:
    """File-backed vector index (LanceDB/Chroma-compatible shape)."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._records: list[VectorRecord] = []
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            items = raw.get("records") if isinstance(raw, dict) else raw
            if isinstance(items, list):
                self._records = [
                    VectorRecord.from_dict(x) for x in items if isinstance(x, dict)
                ]
        except Exception:
            logger.warning("vector store load failed path=%s", self._path, exc_info=True)
            self._records = []

    def _persist(self) -> None:
        payload = {"records": [r.to_dict() for r in self._records[-4000:]]}
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self._path)

    def upsert(
        self,
        *,
        profile_id: str,
        text: str,
        kind: str = "context",
        meta: dict[str, Any] | None = None,
        record_id: str | None = None,
    ) -> VectorRecord:
        cleaned = (text or "").strip()
        if not cleaned:
            raise ValueError("empty text")
        rec = VectorRecord(
            id=record_id or uuid.uuid4().hex[:12],
            profile_id=(profile_id or "local").strip() or "local",
            kind=kind,
            text=cleaned[:2000],
            embedding=embed_text(cleaned),
            meta=meta or {},
        )
        with self._lock:
            self._records = [r for r in self._records if r.id != rec.id]
            self._records.append(rec)
            if len(self._records) > 4000:
                self._records = self._records[-4000:]
            self._persist()
        return rec

    def query(
        self,
        text: str,
        *,
        profile_id: str = "local",
        limit: int = 6,
        kinds: Iterable[str] | None = None,
    ) -> list[dict[str, Any]]:
        q = embed_text(text)
        kind_set = set(kinds) if kinds else None
        pid = (profile_id or "local").strip() or "local"
        scored: list[tuple[float, VectorRecord]] = []
        with self._lock:
            for rec in self._records:
                if rec.profile_id != pid:
                    continue
                if kind_set and rec.kind not in kind_set:
                    continue
                scored.append((cosine(q, rec.embedding), rec))
        scored.sort(key=lambda x: x[0], reverse=True)
        out: list[dict[str, Any]] = []
        for score, rec in scored[: max(1, min(limit, 20))]:
            out.append(
                {
                    "id": rec.id,
                    "kind": rec.kind,
                    "text": rec.text,
                    "score": round(score, 4),
                    "meta": rec.meta,
                    "created_at": rec.created_at,
                }
            )
        return out

    def search(
        self,
        profile_id: str,
        text: str,
        k: int = 8,
        *,
        kinds: Iterable[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Alias used by HTTP routes / callers expecting (profile, q, k)."""
        return self.query(text, profile_id=profile_id, limit=k, kinds=kinds)

    def stats(self, profile_id: str | None = None) -> dict[str, Any]:
        with self._lock:
            records = self._records
            if profile_id:
                pid = profile_id.strip() or "local"
                records = [r for r in records if r.profile_id == pid]
            by_kind: dict[str, int] = {}
            for r in records:
                by_kind[r.kind] = by_kind.get(r.kind, 0) + 1
            return {"count": len(records), "by_kind": by_kind, "backend": "local_json"}


@lru_cache
def get_vector_store() -> VectorStore:
    settings: Settings = get_settings()
    backend_root = Path(__file__).resolve().parent.parent.parent
    path = backend_root / "data" / "vector_memory.json"
    # Optional chroma hook (not required).
    backend = (getattr(settings, "vector_backend", None) or "local").lower()
    if backend == "chroma":
        try:
            from app.memory.vector_chroma import ChromaVectorStore  # type: ignore

            return ChromaVectorStore(backend_root / "data" / "chroma")  # type: ignore[return-value]
        except Exception:
            logger.info("chroma unavailable; using local vector JSON store")
    return VectorStore(path)
