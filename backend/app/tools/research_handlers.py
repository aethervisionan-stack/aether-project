"""Tool handlers for Deep Research + Canvas semantic edits."""

from __future__ import annotations

from typing import Any

from app.agent.deep_research import run_deep_research
from app.canvas.store import get_canvas_store
from app.config import Settings, get_settings


async def deep_research_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    cfg = settings or get_settings()
    topic = str(args.get("topic") or args.get("query") or "").strip()
    if not topic:
        return {
            "ok": False,
            "error": "topic is required",
            "tool": "deep_research_tool",
        }

    max_subquestions = int(args.get("max_subquestions") or 5)
    min_trust = float(args.get("min_trust") or 0.5)
    source_limit = int(args.get("source_limit") or 12)
    open_in_canvas = bool(args.get("open_in_canvas", True))
    canvas_doc_id = str(args.get("canvas_doc_id") or "").strip() or None
    pid = str(args.get("profile_id") or profile_id or "local").strip() or "local"

    result = await run_deep_research(
        topic,
        settings=cfg,
        max_subquestions=max(2, min(8, max_subquestions)),
        min_trust=max(0.0, min(1.0, min_trust)),
        source_limit=max(3, min(24, source_limit)),
    )
    payload = result.to_dict()
    payload["tool"] = "deep_research_tool"
    payload["canvas"] = None

    if result.ok and open_in_canvas:
        store = get_canvas_store()
        doc = store.upsert_research_report(
            topic=result.topic,
            markdown=result.report_markdown,
            profile_id=pid,
            doc_id=canvas_doc_id,
        )
        payload["canvas"] = doc.to_dict()
        payload["speak"] = f"Deep research ready on {result.topic}."
    elif result.ok:
        payload["speak"] = f"Deep research complete for {result.topic}."
    else:
        payload["speak"] = payload.get("error") or "Deep research failed."

    return payload


async def canvas_edit_tool(
    args: dict[str, Any],
    *,
    settings: Settings | None = None,
    profile_id: str = "local",
) -> dict[str, Any]:
    del settings  # canvas store is local JSON; no LLM key required for heuristic propose
    store = get_canvas_store()
    action = str(args.get("action") or "propose").strip().lower() or "propose"
    doc_id = str(args.get("doc_id") or args.get("canvas_doc_id") or "").strip()
    pid = str(args.get("profile_id") or profile_id or "local").strip() or "local"

    if action == "list":
        docs = store.list_docs(profile_id=pid)
        return {
            "ok": True,
            "tool": "canvas_edit_tool",
            "action": "list",
            "docs": docs,
            "count": len(docs),
        }

    if action == "create":
        title = str(args.get("title") or "Untitled").strip() or "Untitled"
        markdown = str(args.get("markdown") or "")
        kind_raw = str(args.get("kind") or "article").strip().lower()
        kind = kind_raw if kind_raw in {"article", "research", "notes", "code"} else "article"
        doc = store.create(
            title=title,
            markdown=markdown,
            kind=kind,  # type: ignore[arg-type]
            profile_id=pid,
            doc_id=doc_id or None,
        )
        return {
            "ok": True,
            "tool": "canvas_edit_tool",
            "action": "create",
            "doc": doc.to_dict(),
            "speak": f"Created canvas document {doc.title}.",
        }

    if not doc_id:
        return {
            "ok": False,
            "error": "doc_id is required",
            "tool": "canvas_edit_tool",
            "action": action,
        }

    doc = store.get(doc_id)
    if doc is None:
        return {
            "ok": False,
            "error": "document not found",
            "tool": "canvas_edit_tool",
            "action": action,
            "doc_id": doc_id,
        }

    if action == "get":
        return {
            "ok": True,
            "tool": "canvas_edit_tool",
            "action": "get",
            "doc": doc.to_dict(),
        }

    if action == "save":
        markdown = str(args.get("markdown") if args.get("markdown") is not None else doc.markdown)
        title = args.get("title")
        expected = args.get("expected_revision")
        expected_revision = int(expected) if expected is not None else None
        try:
            saved = store.save_user_edit(
                doc_id,
                markdown,
                title=str(title) if title is not None else None,
                expected_revision=expected_revision,
            )
        except Exception as exc:  # noqa: BLE001
            return {
                "ok": False,
                "error": str(exc),
                "tool": "canvas_edit_tool",
                "action": "save",
                "doc_id": doc_id,
            }
        return {
            "ok": True,
            "tool": "canvas_edit_tool",
            "action": "save",
            "doc": saved.to_dict(),
            "speak": f"Saved canvas revision {saved.revision}.",
        }

    if action in {"propose", "edit"}:
        instruction = str(args.get("instruction") or args.get("text") or "").strip()
        if not instruction:
            return {
                "ok": False,
                "error": "instruction is required",
                "tool": "canvas_edit_tool",
                "action": action,
                "doc_id": doc_id,
            }
        author = str(args.get("author") or "ai").strip() or "ai"
        pending = store.propose_from_instruction(doc_id, instruction, author=author)
        refreshed = store.get(doc_id)
        return {
            "ok": True,
            "tool": "canvas_edit_tool",
            "action": "propose",
            "diff": pending,
            "doc": refreshed.to_dict() if refreshed else None,
            "speak": "Canvas edit proposed — accept or reject in the HUD.",
        }

    if action in {"apply", "accept", "reject"}:
        diff_id = str(args.get("diff_id") or "").strip()
        if not diff_id:
            return {
                "ok": False,
                "error": "diff_id is required",
                "tool": "canvas_edit_tool",
                "action": action,
                "doc_id": doc_id,
            }
        accept = action != "reject" and bool(args.get("accept", True))
        if action == "reject":
            accept = False
        op_ids = args.get("op_ids")
        ids = [str(x) for x in op_ids] if isinstance(op_ids, list) else None
        updated = store.apply_pending(doc_id, diff_id, accept=accept, op_ids=ids)
        if updated is None:
            return {
                "ok": False,
                "error": "document or diff not found",
                "tool": "canvas_edit_tool",
                "action": action,
                "doc_id": doc_id,
                "diff_id": diff_id,
            }
        return {
            "ok": True,
            "tool": "canvas_edit_tool",
            "action": action,
            "accepted": accept,
            "doc": updated.to_dict(),
            "speak": "Canvas diff applied." if accept else "Canvas diff rejected.",
        }

    return {
        "ok": False,
        "error": f"unknown action: {action}",
        "tool": "canvas_edit_tool",
    }
