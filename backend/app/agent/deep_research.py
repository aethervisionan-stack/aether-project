"""
Deep Research pipeline — adapted from `/server/src/agent/deepResearch.ts`
to Aether Vision FastAPI layout (`backend/app/agent/`).

Flow: topic → sub-questions → parallel web search → trusted sources → Markdown report
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.agent.trusted_sources import filter_trusted
from app.agent.web_search import heuristic_subquestions, search_many
from app.config import Settings, get_settings

logger = logging.getLogger("aether.agent.deep_research")
_TEXT_MODEL_CANDIDATES = (
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
)


@dataclass
class DeepResearchResult:
    ok: bool
    topic: str
    subquestions: list[str] = field(default_factory=list)
    sources: list[dict[str, Any]] = field(default_factory=list)
    report_markdown: str = ""
    elapsed_ms: float = 0.0
    model: str | None = None
    error: str | None = None
    stages: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


async def _gemini_text(
    prompt: str,
    *,
    settings: Settings,
    max_tokens: int = 2048,
) -> tuple[str | None, str | None]:
    if not settings.has_api_key():
        return None, None
    try:
        from google import genai
        from google.genai import types
    except Exception as exc:  # noqa: BLE001
        logger.info("google-genai unavailable: %s", exc)
        return None, None
    client = genai.Client(api_key=settings.gemini_api_key.strip())
    last_err = "no model"
    for model in _TEXT_MODEL_CANDIDATES:
        try:
            resp = await asyncio.to_thread(
                client.models.generate_content,
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.35,
                    max_output_tokens=max_tokens,
                ),
            )
            text = (getattr(resp, "text", None) or "").strip()
            if text:
                return text, model
            last_err = "empty response"
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)[:160]
            logger.info("gemini text failed model=%s err=%s", model, last_err)
    return None, None


async def decompose_topic(topic: str, *, settings: Settings, max_n: int = 5) -> list[str]:
    fallback = heuristic_subquestions(topic, max_n=max_n)
    prompt = (
        f"Decompose into {max_n} sharp web-search sub-questions.\n"
        "Return ONLY a JSON array of strings.\n"
        f"Topic: {topic.strip()}"
    )
    text, _model = await _gemini_text(prompt, settings=settings, max_tokens=512)
    if not text:
        return fallback
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            qs = [str(x).strip() for x in data if str(x).strip()]
            return (qs or fallback)[:max_n]
    except json.JSONDecodeError:
        lines = [
            re.sub(r"^[-*\u2022\d.)\s]+", "", ln).strip()
            for ln in cleaned.splitlines()
            if ln.strip()
        ]
        qs = [ln for ln in lines if len(ln) > 8][:max_n]
        if qs:
            return qs
    return fallback


def _synthesize_fallback(
    topic: str,
    subquestions: list[str],
    sources: list[dict[str, Any]],
) -> str:
    lines = [
        f"# Deep Research: {topic}",
        "",
        f"_Generated {_utc_stamp()} · Aether Vision Deep Research_",
        "",
        "## Executive summary",
        "",
        (
            f"This report surveys **{topic}** across {len(subquestions)} sub-questions "
            f"and {len(sources)} trusted sources."
        ),
        "",
        "## Research questions",
        "",
    ]
    for i, q in enumerate(subquestions, 1):
        lines.append(f"{i}. {q}")
    lines.extend(["", "## Findings by question", ""])
    by_q: dict[str, list[dict[str, Any]]] = {q: [] for q in subquestions}
    for src in sources:
        q = str(src.get("query") or "")
        if q in by_q:
            by_q[q].append(src)
        elif subquestions:
            by_q[subquestions[0]].append(src)
    for q in subquestions:
        lines.append(f"### {q}")
        lines.append("")
        bucket = by_q.get(q) or []
        if not bucket:
            lines.append("_No trusted snippets recovered for this question._")
            lines.append("")
            continue
        for src in bucket[:4]:
            title = str(src.get("title") or "Source")
            url = str(src.get("url") or "")
            snippet = str(src.get("snippet") or "").strip()
            trust = src.get("trust_score")
            trust_bit = f" · trust {trust}" if trust is not None else ""
            lines.append(f"- **[{title}]({url})**{trust_bit}")
            if snippet:
                lines.append(f"  - {snippet}")
        lines.append("")
    lines.extend(["## Sources", ""])
    if not sources:
        lines.append("_No trusted sources passed the filter._")
    else:
        for i, src in enumerate(sources, 1):
            lines.append(
                f"{i}. [{src.get('title') or 'Source'}]({src.get('url') or ''}) — trust {src.get('trust_score')}"
            )
    lines.extend(
        [
            "",
            "## Method",
            "",
            "1. Decompose topic into sub-questions",
            "2. Parallel web search (Wikipedia + DuckDuckGo)",
            "3. Trusted-source filter",
            "4. Assemble Markdown report",
            "",
        ]
    )
    return "\n".join(lines).strip() + "\n"


async def synthesize_report(
    topic: str,
    subquestions: list[str],
    sources: list[dict[str, Any]],
    *,
    settings: Settings,
) -> tuple[str, str | None]:
    fallback = _synthesize_fallback(topic, subquestions, sources)
    compact = [
        {
            "title": s.get("title"),
            "url": s.get("url"),
            "snippet": s.get("snippet"),
            "query": s.get("query"),
            "trust_score": s.get("trust_score"),
        }
        for s in sources[:16]
    ]
    prompt = (
        "Write a detailed Markdown research report. Cite as [Title](url).\n"
        f"# Deep Research: {topic}\n"
        "## Executive summary / Key findings / Detailed analysis / Sources\n"
        f"Questions:\n{json.dumps(subquestions, ensure_ascii=False)}\n"
        f"Sources:\n{json.dumps(compact, ensure_ascii=False)}"
    )
    text, model = await _gemini_text(prompt, settings=settings, max_tokens=3072)
    if text and text.lstrip().startswith("#"):
        return text.strip() + "\n", model
    if text:
        return f"# Deep Research: {topic}\n\n{text.strip()}\n", model
    return fallback, None


async def run_deep_research(
    topic: str,
    *,
    settings: Settings | None = None,
    max_subquestions: int = 5,
    min_trust: float = 0.5,
    source_limit: int = 12,
) -> DeepResearchResult:
    started = time.perf_counter()
    cfg = settings or get_settings()
    cleaned = " ".join((topic or "").strip().split())
    if not cleaned:
        return DeepResearchResult(
            ok=False,
            topic="",
            error="topic is required",
            elapsed_ms=(time.perf_counter() - started) * 1000.0,
        )
    stages: dict[str, Any] = {}
    subqs = await decompose_topic(cleaned, settings=cfg, max_n=max_subquestions)
    stages["decompose"] = {"count": len(subqs), "subquestions": subqs}
    raw_hits = await search_many(subqs, max_per_query=6, limit=28)
    stages["search"] = {"raw_hits": len(raw_hits)}
    trusted = filter_trusted(raw_hits, min_score=min_trust, limit=source_limit)
    if len(trusted) < 2 and raw_hits:
        trusted = filter_trusted(raw_hits, min_score=0.15, limit=source_limit)
        stages["search"]["relaxed_trust"] = True
    stages["filter"] = {"trusted": len(trusted)}
    report, model = await synthesize_report(cleaned, subqs, trusted, settings=cfg)
    stages["synthesize"] = {"model": model, "chars": len(report)}
    return DeepResearchResult(
        ok=True,
        topic=cleaned,
        subquestions=subqs,
        sources=trusted,
        report_markdown=report,
        elapsed_ms=(time.perf_counter() - started) * 1000.0,
        model=model,
        stages=stages,
    )
