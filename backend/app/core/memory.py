"""Adaptive client DNA — local ChromaDB for preferences and past interactions."""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import Settings, get_settings

logger = logging.getLogger("aether.memory")


@dataclass(frozen=True)
class MemoryHit:
    collection: str
    document: str
    metadata: dict[str, Any]
    distance: float | None = None


class AdaptiveMemory:
    """
    Local ChromaDB-backed memory for per-client DNA.

    Collections:
      - user_preferences  — durable prefs (language, tone, headset notes)
      - past_interactions — recent transcript/reply pairs for adaptation
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._persist_dir = Path(settings.chroma_persist_dir).resolve()
        self._persist_dir.mkdir(parents=True, exist_ok=True)
        self._client: Any | None = None
        self._prefs: Any | None = None
        self._interactions: Any | None = None
        self._available = False
        self._init_error: str | None = None
        self._bootstrap()

    def _bootstrap(self) -> None:
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
        except ImportError as exc:  # pragma: no cover
            self._init_error = f"chromadb_missing: {exc}"
            logger.warning("Adaptive memory disabled: %s", self._init_error)
            return

        try:
            self._client = chromadb.PersistentClient(
                path=str(self._persist_dir),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._prefs = self._client.get_or_create_collection(
                name="user_preferences",
                metadata={"hnsw:space": "cosine"},
            )
            self._interactions = self._client.get_or_create_collection(
                name="past_interactions",
                metadata={"hnsw:space": "cosine"},
            )
            self._available = True
            logger.info(
                "Adaptive memory ready path=%s prefs=%s interactions=%s",
                self._persist_dir,
                self._prefs.count(),
                self._interactions.count(),
            )
        except Exception as exc:  # noqa: BLE001
            self._init_error = f"{type(exc).__name__}: {exc}"
            logger.warning("Adaptive memory init failed: %s", self._init_error)

    @property
    def available(self) -> bool:
        return self._available

    @property
    def init_error(self) -> str | None:
        return self._init_error

    def search_context(
        self,
        query: str,
        *,
        client_id: str = "default",
        n_preferences: int = 3,
        n_interactions: int = 5,
    ) -> list[MemoryHit]:
        """Load historical DNA relevant to the current utterance."""
        if not self._available or not query.strip():
            return []

        hits: list[MemoryHit] = []
        where = {"client_id": client_id}

        for collection, name, n in (
            (self._prefs, "user_preferences", n_preferences),
            (self._interactions, "past_interactions", n_interactions),
        ):
            if collection is None or collection.count() == 0:
                continue
            try:
                result = collection.query(
                    query_texts=[query],
                    n_results=min(n, max(1, collection.count())),
                    where=where,
                    include=["documents", "metadatas", "distances"],
                )
            except Exception as exc:  # noqa: BLE001
                # Fallback without where filter if metadata mismatch
                logger.debug("memory.query retry without where: %s", exc)
                try:
                    result = collection.query(
                        query_texts=[query],
                        n_results=min(n, max(1, collection.count())),
                        include=["documents", "metadatas", "distances"],
                    )
                except Exception as exc2:  # noqa: BLE001
                    logger.warning("memory.query failed collection=%s err=%s", name, exc2)
                    continue

            docs = (result.get("documents") or [[]])[0]
            metas = (result.get("metadatas") or [[]])[0]
            dists = (result.get("distances") or [[]])[0]
            for doc, meta, dist in zip(docs, metas, dists, strict=False):
                if not doc:
                    continue
                hits.append(
                    MemoryHit(
                        collection=name,
                        document=str(doc),
                        metadata=dict(meta or {}),
                        distance=float(dist) if dist is not None else None,
                    )
                )
        return hits

    def format_context_block(self, hits: list[MemoryHit]) -> str:
        if not hits:
            return ""
        lines = ["[Client DNA / historical context]"]
        for hit in hits:
            label = hit.collection
            lines.append(f"- ({label}) {hit.document}")
        return "\n".join(lines)

    def remember_preference(
        self,
        text: str,
        *,
        client_id: str = "default",
        key: str = "general",
    ) -> None:
        if not self._available or self._prefs is None or not text.strip():
            return
        doc_id = f"pref-{client_id}-{key}-{uuid.uuid4().hex[:10]}"
        try:
            self._prefs.upsert(
                ids=[doc_id],
                documents=[text.strip()],
                metadatas=[
                    {
                        "client_id": client_id,
                        "key": key,
                        "ts": time.time(),
                    }
                ],
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("memory.remember_preference failed: %s", exc)

    def remember_interaction(
        self,
        *,
        transcript: str,
        response: str,
        client_id: str = "default",
        request_id: str | None = None,
    ) -> None:
        if not self._available or self._interactions is None:
            return
        cleaned_t = " ".join(transcript.split())
        cleaned_r = " ".join(response.split())
        if not cleaned_t and not cleaned_r:
            return
        doc = f"User: {cleaned_t}\nAssistant: {cleaned_r}"
        doc_id = request_id or f"ix-{uuid.uuid4().hex}"
        try:
            self._interactions.upsert(
                ids=[doc_id],
                documents=[doc],
                metadatas=[
                    {
                        "client_id": client_id,
                        "ts": time.time(),
                        "transcript_chars": len(cleaned_t),
                        "response_chars": len(cleaned_r),
                    }
                ],
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("memory.remember_interaction failed: %s", exc)

    def extract_and_store_preferences(
        self,
        transcript: str,
        *,
        client_id: str = "default",
    ) -> None:
        """Lightweight heuristic preference capture from user speech."""
        lower = transcript.lower()
        cues: list[tuple[str, str]] = []
        if any(w in lower for w in ("português", "portugues", "pt-br", "em português")):
            cues.append(("language", "Preferência de idioma: português (pt-BR)."))
        if any(w in lower for w in ("english", "em inglês", "in english")):
            cues.append(("language", "Language preference: English."))
        if any(w in lower for w in ("mais curto", "resposta curta", "seja breve", "be brief")):
            cues.append(("brevity", "Prefere respostas curtas e diretas."))
        if any(w in lower for w in ("mais detalhe", "explique melhor", "mais longo")):
            cues.append(("brevity", "Prefere respostas mais detalhadas."))
        if any(w in lower for w in ("headset", "fone", "bluetooth", "auricular")):
            cues.append(("device", f"Nota de dispositivo: {transcript[:180]}"))
        for key, text in cues:
            self.remember_preference(text, client_id=client_id, key=key)


@lru_cache
def get_adaptive_memory() -> AdaptiveMemory:
    return AdaptiveMemory(get_settings())
