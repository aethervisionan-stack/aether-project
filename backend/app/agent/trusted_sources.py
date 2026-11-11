"""Trusted-source filter for Deep Research citations."""

from __future__ import annotations

from urllib.parse import urlparse

TRUSTED_HOST_SUFFIXES: tuple[str, ...] = (
    "wikipedia.org",
    "wikidata.org",
    "arxiv.org",
    "nature.com",
    "science.org",
    "nih.gov",
    "ncbi.nlm.nih.gov",
    "who.int",
    "cdc.gov",
    "europa.eu",
    "unesco.org",
    "oecd.org",
    "imf.org",
    "worldbank.org",
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "bbc.co.uk",
    "nytimes.com",
    "theguardian.com",
    "mit.edu",
    "stanford.edu",
    "harvard.edu",
    "ox.ac.uk",
    "cam.ac.uk",
    "gov.br",
    "gov.uk",
    "gov",
    "edu",
    "ac.uk",
)

ALLOWLIST_SOFT: tuple[str, ...] = (
    "github.com",
    "developer.mozilla.org",
    "docs.python.org",
    "fastapi.tiangolo.com",
    "react.dev",
    "openai.com",
    "google.com",
    "deepmind.google",
    "anthropic.com",
)


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower().removeprefix("www.")
    except Exception:  # noqa: BLE001
        return ""


def trust_score(url: str) -> float:
    host = _host(url)
    if not host:
        return 0.0
    for suffix in TRUSTED_HOST_SUFFIXES:
        if host == suffix or host.endswith("." + suffix) or host.endswith(suffix):
            if suffix in {"gov", "edu"}:
                if host.split(".")[-1] == suffix:
                    return 0.95
                continue
            if suffix in {"gov.br", "gov.uk", "ac.uk"}:
                return 0.93
            return 1.0 if "wikipedia" in suffix or "arxiv" in suffix else 0.9
    for soft in ALLOWLIST_SOFT:
        if host == soft or host.endswith("." + soft):
            return 0.55
    return 0.15


def filter_trusted(
    items: list[dict[str, object]],
    *,
    min_score: float = 0.5,
    limit: int = 12,
) -> list[dict[str, object]]:
    scored: list[tuple[float, dict[str, object]]] = []
    for item in items:
        url = str(item.get("url") or "")
        score = trust_score(url)
        if score < min_score:
            continue
        enriched = dict(item)
        enriched["trust_score"] = round(score, 3)
        scored.append((score, enriched))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    seen: set[str] = set()
    out: list[dict[str, object]] = []
    for _score, item in scored:
        url = str(item.get("url") or "")
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(item)
        if len(out) >= limit:
            break
    return out
