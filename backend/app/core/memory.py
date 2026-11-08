"""Adaptive client DNA — local ChromaDB for preferences and past interactions."""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import Settings, get_settings

logger = logging.getLogger("aether.memory")

# Canonical semantic tags for notes / preferences / routines / tasks.
SEMANTIC_TAGS: frozenset[str] = frozenset({"rotina", "preferência", "tarefa"})

_TAG_ALIASES: dict[str, str] = {
    "rotina": "rotina",
    "routine": "rotina",
    "preferencia": "preferência",
    "preferência": "preferência",
    "preference": "preferência",
    "prefer": "preferência",
    "tarefa": "tarefa",
    "task": "tarefa",
    "todo": "tarefa",
}


def normalize_semantic_tag(raw: str | None, *, default: str = "preferência") -> str:
    key = (raw or "").strip().lower()
    if not key:
        return default if default in SEMANTIC_TAGS else "preferência"
    # strip accents-ish for preferência alias already covered
    mapped = _TAG_ALIASES.get(key)
    if mapped:
        return mapped
    if key in SEMANTIC_TAGS:
        return key
    return default if default in SEMANTIC_TAGS else "preferência"


def infer_semantic_tag(text: str) -> str:
    """Heuristic tag from note/transcript content."""
    lower = text.lower()
    if any(
        w in lower
        for w in (
            "todo dia",
            "toda manhã",
            "rotina",
            "sempre às",
            "sempre as",
            "habitualmente",
            "routine",
        )
    ):
        return "rotina"
    if any(
        w in lower
        for w in (
            "tarefa",
            "lembrete",
            "lembrar de",
            "to-do",
            "todo:",
            "preciso fazer",
            "agendar",
        )
    ):
        return "tarefa"
    if any(
        w in lower
        for w in (
            "prefiro",
            "preferência",
            "preferencia",
            "gosto de",
            "não gosto",
            "seja breve",
            "resposta curta",
            "em português",
            "in english",
        )
    ):
        return "preferência"
    return "preferência"


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
      - user_preferences  — durable prefs / notes with semantic tags
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
        n_preferences: int = 4,
        n_interactions: int = 4,
        tag: str | None = None,
    ) -> list[MemoryHit]:
        """Load historical DNA relevant to the current utterance."""
        if not self._available or not query.strip():
            return []

        hits: list[MemoryHit] = []
        tag_norm = normalize_semantic_tag(tag) if tag else None

        for collection, name, n in (
            (self._prefs, "user_preferences", n_preferences),
            (self._interactions, "past_interactions", n_interactions),
        ):
            if collection is None or collection.count() == 0:
                continue
            where: dict[str, Any] = {"client_id": client_id}
            if tag_norm and name == "user_preferences":
                where = {
                    "$and": [
                        {"client_id": client_id},
                        {"tag": tag_norm},
                    ]
                }
            result = self._query_collection(collection, query, n=n, where=where)
            if result is None:
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

        # Prefer closer distances first (learned preferences before weak matches)
        hits.sort(
            key=lambda h: (
                0 if h.collection == "user_preferences" else 1,
                h.distance if h.distance is not None else 9.0,
            )
        )
        return hits

    def _query_collection(
        self,
        collection: Any,
        query: str,
        *,
        n: int,
        where: dict[str, Any],
    ) -> dict[str, Any] | None:
        try:
            return collection.query(
                query_texts=[query],
                n_results=min(n, max(1, collection.count())),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("memory.query retry without where: %s", exc)
            try:
                return collection.query(
                    query_texts=[query],
                    n_results=min(n, max(1, collection.count())),
                    include=["documents", "metadatas", "distances"],
                )
            except Exception as exc2:  # noqa: BLE001
                logger.warning("memory.query failed err=%s", exc2)
                return None

    def format_context_block(self, hits: list[MemoryHit]) -> str:
        if not hits:
            return ""
        lines = [
            "[Learned preferences / client DNA — apply these when drafting the reply]",
        ]
        for hit in hits:
            tag = hit.metadata.get("tag") or hit.metadata.get("key") or hit.collection
            lines.append(f"- [{tag}] {hit.document}")
        return "\n".join(lines)

    def format_learned_preferences_prompt(self, hits: list[MemoryHit]) -> str:
        """Compact block optimized for Gemini system/user injection."""
        prefs = [h for h in hits if h.collection == "user_preferences"][:4]
        others = [h for h in hits if h.collection != "user_preferences"][:3]
        if not prefs and not others:
            return ""
        lines = ["[Learned preferences — honor these]"]
        for hit in prefs:
            tag = hit.metadata.get("tag") or "preferência"
            lines.append(f"- ({tag}) {hit.document}")
        if others:
            lines.append("[Recent interactions]")
            for hit in others:
                lines.append(f"- {hit.document}")
        return "\n".join(lines)

    def remember_preference(
        self,
        text: str,
        *,
        client_id: str = "default",
        key: str = "general",
        tag: str | None = None,
    ) -> None:
        if not self._available or self._prefs is None or not text.strip():
            return
        tag_norm = normalize_semantic_tag(tag or infer_semantic_tag(text))
        doc_id = f"pref-{client_id}-{tag_norm}-{key}-{uuid.uuid4().hex[:10]}"
        try:
            self._prefs.upsert(
                ids=[doc_id],
                documents=[text.strip()],
                metadatas=[
                    {
                        "client_id": client_id,
                        "key": key,
                        "tag": tag_norm,
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
                        "tag": "tarefa" if "tarefa" in cleaned_t.lower() else "preferência",
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
        """Lightweight heuristic preference / routine / task capture from user speech."""
        lower = transcript.lower()
        cues: list[tuple[str, str, str]] = []
        if any(w in lower for w in ("português", "portugues", "pt-br", "em português")):
            cues.append(("language", "preferência", "Preferência de idioma: português (pt-BR)."))
        if any(w in lower for w in ("english", "em inglês", "in english")):
            cues.append(("language", "preferência", "Language preference: English."))
        if any(w in lower for w in ("mais curto", "resposta curta", "seja breve", "be brief")):
            cues.append(("brevity", "preferência", "Prefere respostas curtas e diretas."))
        if any(w in lower for w in ("mais detalhe", "explique melhor", "mais longo")):
            cues.append(("brevity", "preferência", "Prefere respostas mais detalhadas."))
        if any(w in lower for w in ("todo dia", "toda manhã", "rotina", "sempre às", "sempre as")):
            cues.append(("routine", "rotina", f"Rotina: {transcript[:180]}"))
        if any(w in lower for w in ("tarefa", "lembrete", "lembrar de", "preciso fazer")):
            cues.append(("task", "tarefa", f"Tarefa: {transcript[:180]}"))
        if any(w in lower for w in ("headset", "fone", "bluetooth", "auricular")):
            cues.append(("device", "preferência", f"Nota de dispositivo: {transcript[:180]}"))
        for key, tag, text in cues:
            self.remember_preference(text, client_id=client_id, key=key, tag=tag)


@lru_cache
def get_adaptive_memory() -> AdaptiveMemory:
    return AdaptiveMemory(get_settings())
