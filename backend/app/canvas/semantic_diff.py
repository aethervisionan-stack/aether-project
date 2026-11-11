"""
Semantic diffs for Canvas documents (articles / code / docs).

Ops are heading- and paragraph-anchored rather than raw character offsets,
so AI and human edits can merge without fighting line numbers.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

OpKind = Literal[
    "replace_section",
    "insert_after",
    "insert_before",
    "delete_section",
    "replace_paragraph",
    "append",
    "set_document",
]

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)


@dataclass
class DiffOp:
    op: OpKind
    content: str = ""
    heading: str | None = None
    match: str | None = None
    anchor: str | None = None
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v != ""}


@dataclass
class SemanticDiff:
    doc_id: str
    base_revision: int
    ops: list[DiffOp] = field(default_factory=list)
    author: str = "ai"
    summary: str = ""
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "doc_id": self.doc_id,
            "base_revision": self.base_revision,
            "author": self.author,
            "summary": self.summary,
            "ops": [op.to_dict() for op in self.ops],
        }


def _normalize_heading(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip())
    return cleaned.lstrip("#").strip().lower()


def _split_sections(markdown: str) -> list[tuple[str | None, str]]:
    """Return [(heading_or_None, body_including_heading_line)]."""
    text = markdown.replace("\r\n", "\n")
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return [(None, text)] if text else []
    sections: list[tuple[str | None, str]] = []
    if matches[0].start() > 0:
        preamble = text[: matches[0].start()]
        if preamble.strip():
            sections.append((None, preamble))
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        heading = match.group(2)
        sections.append((heading, text[match.start() : end]))
    return sections


def _join_sections(sections: list[tuple[str | None, str]]) -> str:
    body = "".join(body for _h, body in sections)
    if body and not body.endswith("\n"):
        body += "\n"
    return body


def apply_ops(markdown: str, ops: list[DiffOp | dict[str, Any]]) -> str:
    """Apply semantic ops sequentially to Markdown text."""
    current = markdown.replace("\r\n", "\n")
    normalized: list[DiffOp] = []
    for raw in ops:
        if isinstance(raw, DiffOp):
            normalized.append(raw)
            continue
        normalized.append(
            DiffOp(
                op=raw.get("op", "append"),  # type: ignore[arg-type]
                content=str(raw.get("content") or ""),
                heading=(str(raw["heading"]) if raw.get("heading") else None),
                match=(str(raw["match"]) if raw.get("match") else None),
                anchor=(str(raw["anchor"]) if raw.get("anchor") else None),
                id=str(raw.get("id") or uuid.uuid4().hex[:12]),
            )
        )

    for op in normalized:
        kind = op.op
        content = op.content or ""

        if kind == "set_document":
            current = content if not content or content.endswith("\n") else content + "\n"
            continue

        if kind == "append":
            if current and not current.endswith("\n"):
                current += "\n"
            block = content if not content or content.endswith("\n") else content + "\n"
            current += block
            continue

        if kind == "replace_paragraph":
            needle = op.match or ""
            if needle and needle in current:
                current = current.replace(needle, content, 1)
            continue

        if kind == "delete_section":
            target = _normalize_heading(op.heading or op.match or "")
            if not target:
                continue
            sections = _split_sections(current)
            new_sections = [
                (heading, body)
                for heading, body in sections
                if heading is None or _normalize_heading(heading) != target
            ]
            current = _join_sections(new_sections)
            continue

        if kind == "replace_section":
            target = _normalize_heading(op.heading or "")
            sections = _split_sections(current)
            replaced = False
            new_sections: list[tuple[str | None, str]] = []
            for heading, body in sections:
                if heading is not None and target and _normalize_heading(heading) == target:
                    m = _HEADING_RE.match(body.lstrip())
                    level = len(m.group(1)) if m else 2
                    hashes = "#" * max(1, min(level, 6))
                    title = (op.heading or heading or "Section").strip()
                    block = content
                    if not block.lstrip().startswith("#"):
                        block = f"{hashes} {title}\n\n{content.strip()}\n"
                    if not block.endswith("\n"):
                        block += "\n"
                    new_sections.append((title, block))
                    replaced = True
                else:
                    new_sections.append((heading, body))
            if not replaced:
                title = (op.heading or "Section").strip()
                block = content
                if not block.lstrip().startswith("#"):
                    block = f"## {title}\n\n{content.strip()}\n"
                if not block.endswith("\n"):
                    block += "\n"
                new_sections.append((title, block))
            current = _join_sections(new_sections)
            continue

        if kind in {"insert_after", "insert_before"}:
            anchor = _normalize_heading(op.anchor or op.heading or "")
            sections = _split_sections(current)
            insert = content
            if insert and not insert.endswith("\n"):
                insert += "\n"
            if not sections:
                current = insert
                continue
            inserted = False
            new_sections = []
            for idx, (heading, body) in enumerate(sections):
                hit = heading is not None and anchor and _normalize_heading(heading) == anchor
                if hit and kind == "insert_before":
                    new_sections.append((None, insert))
                    new_sections.append((heading, body))
                    inserted = True
                elif hit and kind == "insert_after":
                    new_sections.append((heading, body))
                    new_sections.append((None, insert))
                    inserted = True
                else:
                    new_sections.append((heading, body))
            if not inserted:
                new_sections.append((None, insert))
            current = _join_sections(new_sections)
            continue

    return current


def apply_semantic_diff(markdown: str, diff: SemanticDiff | dict[str, Any]) -> str:
    if isinstance(diff, SemanticDiff):
        return apply_ops(markdown, diff.ops)
    ops = diff.get("ops") or []
    return apply_ops(markdown, list(ops))


def propose_semantic_diff(
    *,
    doc_id: str,
    base_revision: int,
    instruction: str,
    current_markdown: str,
    author: str = "ai",
) -> SemanticDiff:
    """
    Heuristic AI proposal without requiring a Live turn.

    Produces structured ops the HUD can accept/reject individually.
    """
    text = " ".join((instruction or "").strip().split())
    ops: list[DiffOp] = []
    summary = "AI edit"
    lower = text.lower()

    if lower.startswith("replace document") or lower.startswith("set document"):
        payload = text.split(":", 1)[1].strip() if ":" in text else text
        ops.append(DiffOp(op="set_document", content=payload if payload.endswith("\n") else payload + "\n"))
        summary = "Replace entire document"
    elif lower.startswith("append") or lower.startswith("append:"):
        payload = text.split(":", 1)[1].strip() if ":" in text else text[len("append") :].strip()
        ops.append(DiffOp(op="append", content=payload if payload.endswith("\n") else payload + "\n"))
        summary = "Append content"
    elif lower.startswith("replace section") or lower.startswith("section:"):
        rest = text
        if ":" in text:
            rest = text.split(":", 1)[1].strip()
        if "::" in rest:
            heading, body = rest.split("::", 1)
        else:
            parts = rest.split("\n", 1)
            heading = parts[0].strip() or "Notes"
            body = parts[1].strip() if len(parts) > 1 else rest
        heading = heading.strip() or "Notes"
        body = body.strip()
        block = body if body.endswith("\n") else body + "\n"
        ops.append(DiffOp(op="replace_section", heading=heading, content=block))
        summary = f"Replace section {heading}"
    else:
        notes_body = (
            f"## AI Notes\n\n{text}\n\n_Proposed against revision {base_revision}._\n"
        )
        if re.search(r"^##\s+AI Notes\s*$", current_markdown or "", re.MULTILINE | re.IGNORECASE):
            ops.append(DiffOp(op="replace_section", heading="AI Notes", content=notes_body))
            summary = "Update AI Notes"
        else:
            ops.append(DiffOp(op="append", content=("\n" + notes_body) if current_markdown else notes_body))
            summary = "Add AI Notes"

    return SemanticDiff(
        doc_id=doc_id,
        base_revision=base_revision,
        ops=ops,
        author=author or "ai",
        summary=summary,
    )


def preview_ops(markdown: str, ops: list[DiffOp | dict[str, Any]]) -> dict[str, Any]:
    """Return before/after preview for HUD."""
    after = apply_ops(markdown, ops)
    return {
        "before": markdown,
        "after": after,
        "before_len": len(markdown),
        "after_len": len(after),
    }
