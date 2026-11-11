"""Parallel web search helpers for Deep Research (stdlib only)."""

from __future__ import annotations

import asyncio
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

logger = logging.getLogger("aether.agent.web_search")
_USER_AGENT = "AetherVision-DeepResearch/0.4.5 (+local; research)"


def _http_get(url: str, *, timeout: float = 8.0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
            "User-Agent": _USER_AGENT,
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _search_duckduckgo(query: str, *, max_results: int = 6) -> list[dict[str, Any]]:
    qs = urllib.parse.urlencode(
        {"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"}
    )
    try:
        data = json.loads(_http_get(f"https://api.duckduckgo.com/?{qs}", timeout=7.0))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        logger.info("ddg search failed query=%r err=%s", query, exc)
        return []
    out: list[dict[str, Any]] = []
    abstract = str(data.get("AbstractText") or "").strip()
    abstract_url = str(data.get("AbstractURL") or "").strip()
    heading = str(data.get("Heading") or query).strip()
    if abstract and abstract_url:
        out.append(
            {
                "title": heading,
                "url": abstract_url,
                "snippet": abstract[:500],
                "provider": "duckduckgo",
                "query": query,
            }
        )

    def walk(nodes: Any) -> None:
        if len(out) >= max_results or not isinstance(nodes, list):
            return
        for node in nodes:
            if len(out) >= max_results or not isinstance(node, dict):
                continue
            if "Topics" in node:
                walk(node.get("Topics"))
                continue
            text = str(node.get("Text") or "").strip()
            first_url = str(node.get("FirstURL") or "").strip()
            if text and first_url:
                out.append(
                    {
                        "title": text.split(" - ", 1)[0][:120],
                        "url": first_url,
                        "snippet": text[:500],
                        "provider": "duckduckgo",
                        "query": query,
                    }
                )

    walk(data.get("RelatedTopics") or [])
    return out[:max_results]


def _search_wikipedia(query: str, *, max_results: int = 4) -> list[dict[str, Any]]:
    qs = urllib.parse.urlencode(
        {
            "action": "opensearch",
            "search": query,
            "limit": max_results,
            "namespace": 0,
            "format": "json",
        }
    )
    try:
        data = json.loads(
            _http_get(f"https://en.wikipedia.org/w/api.php?{qs}", timeout=7.0)
        )
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        logger.info("wikipedia search failed query=%r err=%s", query, exc)
        return []
    if not isinstance(data, list) or len(data) < 4:
        return []
    titles = data[1] if isinstance(data[1], list) else []
    descs = data[2] if isinstance(data[2], list) else []
    links = data[3] if isinstance(data[3], list) else []
    out: list[dict[str, Any]] = []
    for i, title in enumerate(titles):
        link = str(links[i]) if i < len(links) else ""
        if not link:
            continue
        desc = str(descs[i]) if i < len(descs) else ""
        out.append(
            {
                "title": str(title),
                "url": link,
                "snippet": desc[:500] or str(title),
                "provider": "wikipedia",
                "query": query,
            }
        )
    return out


async def search_query(query: str, *, max_results: int = 8) -> list[dict[str, Any]]:
    ddg, wiki = await asyncio.gather(
        asyncio.to_thread(_search_duckduckgo, query, max_results=max_results),
        asyncio.to_thread(_search_wikipedia, query, max_results=min(4, max_results)),
    )
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in list(wiki) + list(ddg):
        url = str(item.get("url") or "")
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(item)
        if len(out) >= max_results:
            break
    return out


async def search_many(
    queries: list[str],
    *,
    max_per_query: int = 6,
    limit: int = 24,
) -> list[dict[str, Any]]:
    cleaned = [q.strip() for q in queries if q and q.strip()][:9]
    if not cleaned:
        return []
    batches = await asyncio.gather(
        *[search_query(q, max_results=max_per_query) for q in cleaned]
    )
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for batch in batches:
        for item in batch:
            url = str(item.get("url") or "")
            if not url or url in seen:
                continue
            seen.add(url)
            out.append(item)
            if len(out) >= limit:
                return out
    return out


def heuristic_subquestions(topic: str, *, max_n: int = 5) -> list[str]:
    topic = " ".join(topic.strip().split())
    if not topic:
        return []
    base = [
        f"What is {topic}?",
        f"Key facts and background on {topic}",
        f"Recent developments about {topic}",
        f"Risks, limitations, or controversies of {topic}",
        f"Practical implications of {topic}",
    ]
    if "?" in topic:
        base = [topic] + [q for q in base if q.lower() != topic.lower()]
    return base[:max_n]
