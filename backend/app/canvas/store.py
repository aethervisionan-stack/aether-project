"""In-memory (+ optional JSON) Canvas document store for HUD collaboration."""

from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from app.canvas.semantic_diff import (
    SemanticDiff,
    apply_semantic_diff,
    propose_semantic_diff,
)

DocKind = Literal["article", "research", "notes", "code"]


@dataclass
class CanvasDocument:
    id: str
    title: str
    kind: DocKind
    markdown: str
    revision: int = 1
    profile_id: str = "local"
    updated_at: float = field(default_factory=time.time)
    pending_diffs: list[dict[str, Any]] = field(default_factory=list)
    history: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "kind": self.kind,
            "markdown": self.markdown,
            "revision": self.revision,
            "profile_id": self.profile_id,
            "updated_at": self.updated_at,
            "pending_diffs": list(self.pending_diffs),
            "history_len": len(self.history),
        }


class RevisionConflict(Exception):
    def __init__(self, current: int, expected: int) -> None:
        super().__init__(f"revision conflict: current={current} expected={expected}")
        self.current = current
        self.expected = expected


class CanvasStore:
    def __init__(self, path: str | Path | None = None) -> None:
        self._lock = threading.RLock()
        self._docs: dict[str, CanvasDocument] = {}
        raw = path or "data/canvas_docs.json"
        self._path = Path(raw)
        if not self._path.is_absolute():
            backend_root = Path(__file__).resolve().parent.parent.parent
            self._path = backend_root / self._path
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        docs = raw.get("docs") if isinstance(raw, dict) else None
        if not isinstance(docs, list):
            return
        loaded: dict[str, CanvasDocument] = {}
        for item in docs:
            if not isinstance(item, dict):
                continue
            doc_id = str(item.get("id") or "").strip()
            if not doc_id:
                continue
            pending = item.get("pending_diffs") or []
            history = item.get("history") or []
            if not isinstance(pending, list):
                pending = []
            if not isinstance(history, list):
                history = []
            loaded[doc_id] = CanvasDocument(
                id=doc_id,
                title=str(item.get("title") or "Untitled"),
                kind=str(item.get("kind") or "article"),  # type: ignore[arg-type]
                markdown=str(item.get("markdown") or ""),
                revision=int(item.get("revision") or 1),
                profile_id=str(item.get("profile_id") or "local"),
                updated_at=float(item.get("updated_at") or time.time()),
                pending_diffs=[d for d in pending if isinstance(d, dict)],
                history=[h for h in history if isinstance(h, dict)],
            )
        self._docs = loaded

    def _persist(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"docs": [asdict(doc) for doc in self._docs.values()]}
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._path)

    def list_docs(self, profile_id: str = "local") -> list[dict[str, Any]]:
        with self._lock:
            items = [
                d.to_dict()
                for d in self._docs.values()
                if d.profile_id == profile_id
            ]
            items.sort(key=lambda d: d.get("updated_at") or 0, reverse=True)
            return items

    def get(self, doc_id: str) -> CanvasDocument | None:
        with self._lock:
            return self._docs.get(doc_id)

    def create(
        self,
        *,
        title: str = "Untitled",
        markdown: str = "",
        kind: DocKind = "article",
        profile_id: str = "local",
        doc_id: str | None = None,
    ) -> CanvasDocument:
        with self._lock:
            body = markdown if not markdown or markdown.endswith("\n") else markdown + "\n"
            doc = CanvasDocument(
                id=(doc_id or uuid.uuid4().hex[:12]),
                title=(title or "Untitled").strip() or "Untitled",
                kind=kind,
                markdown=body,
                profile_id=(profile_id or "local").strip() or "local",
            )
            self._docs[doc.id] = doc
            self._persist()
            return doc

    def save_user_edit(
        self,
        doc_id: str,
        markdown: str,
        *,
        title: str | None = None,
        expected_revision: int | None = None,
    ) -> CanvasDocument:
        with self._lock:
            doc = self._docs.get(doc_id)
            if doc is None:
                raise KeyError(doc_id)
            if expected_revision is not None and expected_revision != doc.revision:
                raise RevisionConflict(current=doc.revision, expected=expected_revision)
            body = markdown if not markdown or markdown.endswith("\n") else markdown + "\n"
            doc.history.append(
                {
                    "at": time.time(),
                    "author": "user",
                    "revision": doc.revision,
                    "chars": len(doc.markdown),
                }
            )
            if len(doc.history) > 40:
                doc.history = doc.history[-40:]
            doc.markdown = body
            if title is not None and title.strip():
                doc.title = title.strip()
            doc.revision += 1
            doc.updated_at = time.time()
            self._persist()
            return doc

    def queue_diff(self, doc_id: str, diff: SemanticDiff | dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            doc = self._docs.get(doc_id)
            if doc is None:
                return None
            if isinstance(diff, SemanticDiff):
                payload = diff.to_dict()
            else:
                payload = dict(diff)
            payload.setdefault("id", uuid.uuid4().hex[:12])
            payload.setdefault("base_revision", doc.revision)
            doc.pending_diffs.append(payload)
            doc.updated_at = time.time()
            self._persist()
            return payload

    def apply_pending(
        self,
        doc_id: str,
        diff_id: str,
        *,
        accept: bool = True,
        op_ids: list[str] | None = None,
    ) -> CanvasDocument | None:
        with self._lock:
            doc = self._docs.get(doc_id)
            if doc is None:
                return None
            idx = next(
                (i for i, d in enumerate(doc.pending_diffs) if d.get("id") == diff_id),
                None,
            )
            if idx is None:
                return None
            pending = doc.pending_diffs.pop(idx)
            if not accept:
                doc.updated_at = time.time()
                self._persist()
                return doc

            ops = list(pending.get("ops") or [])
            if op_ids:
                want = set(op_ids)
                ops = [op for op in ops if isinstance(op, dict) and op.get("id") in want]
            before = doc.markdown
            after = apply_semantic_diff(before, {"ops": ops})
            doc.history.append(
                {
                    "at": time.time(),
                    "author": pending.get("author") or "ai",
                    "summary": pending.get("summary") or "",
                    "diff_id": diff_id,
                    "revision": doc.revision,
                    "chars": len(before),
                }
            )
            if len(doc.history) > 40:
                doc.history = doc.history[-40:]
            doc.markdown = after if not after or after.endswith("\n") else after + "\n"
            doc.revision += 1
            doc.updated_at = time.time()
            self._persist()
            return doc

    def propose_from_instruction(
        self,
        doc_id: str,
        instruction: str,
        *,
        author: str = "ai",
    ) -> dict[str, Any] | None:
        with self._lock:
            doc = self._docs.get(doc_id)
            if doc is None:
                return None
            diff = propose_semantic_diff(
                doc_id=doc.id,
                base_revision=doc.revision,
                instruction=instruction,
                current_markdown=doc.markdown,
                author=author,
            )
            return self.queue_diff(doc_id, diff)

    def upsert_research_report(
        self,
        *,
        topic: str,
        markdown: str,
        profile_id: str = "local",
        doc_id: str | None = None,
    ) -> CanvasDocument:
        title = f"Research: {topic.strip()}" if topic.strip() else "Research"
        body = markdown if not markdown or markdown.endswith("\n") else markdown + "\n"
        with self._lock:
            if doc_id and doc_id in self._docs:
                doc = self._docs[doc_id]
                doc.history.append(
                    {
                        "at": time.time(),
                        "author": "research",
                        "revision": doc.revision,
                        "chars": len(doc.markdown),
                    }
                )
                if len(doc.history) > 40:
                    doc.history = doc.history[-40:]
                doc.markdown = body
                doc.title = title
                doc.kind = "research"
                doc.revision += 1
                doc.updated_at = time.time()
                self._persist()
                return doc
        return self.create(
            title=title,
            markdown=body,
            kind="research",
            profile_id=profile_id,
            doc_id=doc_id,
        )


@lru_cache
def get_canvas_store() -> CanvasStore:
    return CanvasStore()
