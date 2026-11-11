"""HTTP surface for collaborative Canvas documents + semantic diffs."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.canvas.semantic_diff import preview_ops
from app.canvas.store import RevisionConflict, get_canvas_store

router = APIRouter(prefix="/canvas", tags=["canvas"])


class CreateDocBody(BaseModel):
    title: str = "Untitled"
    markdown: str = ""
    kind: str = "article"
    profile_id: str = "local"
    doc_id: str | None = None


class SaveDocBody(BaseModel):
    markdown: str
    title: str | None = None
    expected_revision: int | None = None


class ProposeBody(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=8000)
    author: str = "ai"


class QueueDiffBody(BaseModel):
    ops: list[dict[str, Any]] = Field(default_factory=list)
    summary: str = ""
    author: str = "ai"
    base_revision: int | None = None
    id: str | None = None


class ApplyDiffBody(BaseModel):
    accept: bool = True
    op_ids: list[str] | None = None


class PreviewBody(BaseModel):
    markdown: str = ""
    ops: list[dict[str, Any]] = Field(default_factory=list)


@router.get("/docs")
async def list_docs(profile_id: str = "local") -> dict[str, Any]:
    store = get_canvas_store()
    docs = store.list_docs(profile_id=profile_id)
    return {"ok": True, "docs": docs, "count": len(docs)}


@router.post("/docs")
async def create_doc(body: CreateDocBody) -> dict[str, Any]:
    store = get_canvas_store()
    kind = body.kind if body.kind in {"article", "research", "notes", "code"} else "article"
    doc = store.create(
        title=body.title,
        markdown=body.markdown,
        kind=kind,  # type: ignore[arg-type]
        profile_id=body.profile_id,
        doc_id=body.doc_id,
    )
    return {"ok": True, "doc": doc.to_dict()}


@router.get("/docs/{doc_id}")
async def get_doc(doc_id: str) -> dict[str, Any]:
    store = get_canvas_store()
    doc = store.get(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    return {"ok": True, "doc": doc.to_dict()}


@router.put("/docs/{doc_id}")
async def save_doc(doc_id: str, body: SaveDocBody) -> dict[str, Any]:
    store = get_canvas_store()
    try:
        doc = store.save_user_edit(
            doc_id,
            body.markdown,
            title=body.title,
            expected_revision=body.expected_revision,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="document not found") from exc
    except RevisionConflict as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "revision_conflict",
                "current": exc.current,
                "expected": exc.expected,
            },
        ) from exc
    return {"ok": True, "doc": doc.to_dict()}


@router.post("/docs/{doc_id}/propose")
async def propose_doc(doc_id: str, body: ProposeBody) -> dict[str, Any]:
    store = get_canvas_store()
    pending = store.propose_from_instruction(
        doc_id,
        body.instruction,
        author=body.author or "ai",
    )
    if pending is None:
        raise HTTPException(status_code=404, detail="document not found")
    doc = store.get(doc_id)
    return {
        "ok": True,
        "diff": pending,
        "doc": doc.to_dict() if doc else None,
    }


@router.post("/docs/{doc_id}/diffs")
async def queue_diff(doc_id: str, body: QueueDiffBody) -> dict[str, Any]:
    store = get_canvas_store()
    doc = store.get(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    payload: dict[str, Any] = {
        "ops": body.ops,
        "summary": body.summary,
        "author": body.author or "ai",
        "doc_id": doc_id,
        "base_revision": body.base_revision if body.base_revision is not None else doc.revision,
    }
    if body.id:
        payload["id"] = body.id
    pending = store.queue_diff(doc_id, payload)
    refreshed = store.get(doc_id)
    return {
        "ok": True,
        "diff": pending,
        "doc": refreshed.to_dict() if refreshed else None,
    }


@router.post("/docs/{doc_id}/diffs/{diff_id}/apply")
async def apply_diff(doc_id: str, diff_id: str, body: ApplyDiffBody) -> dict[str, Any]:
    store = get_canvas_store()
    doc = store.apply_pending(
        doc_id,
        diff_id,
        accept=body.accept,
        op_ids=body.op_ids,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="document or diff not found")
    return {
        "ok": True,
        "accepted": body.accept,
        "doc": doc.to_dict(),
    }


@router.post("/preview")
async def preview(body: PreviewBody) -> dict[str, Any]:
    result = preview_ops(body.markdown, body.ops)
    return {"ok": True, **result}
