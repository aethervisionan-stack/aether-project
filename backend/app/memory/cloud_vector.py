"""
Cloud episodic vector memory (Pinecone or Qdrant), isolated by user_id.

Maps interactions / summaries / preferences for cross-device context.
Uses REST only (no hard SDK deps). Disabled when CLOUD_VECTOR_BACKEND=off
or required keys are missing — local VectorStore remains the Gen-1 floor.

Pinecone: namespace == user_id.
Qdrant: collection with payload filter user_id == ...
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
import uuid
from typing import Any, Iterable

from app.config import Settings, get_settings
from app.memory.vector_store import DIM, embed_text

logger = logging.getLogger("aether.memory.cloud_vector")

KINDS = frozenset({"interaction", "summary", "preference", "context"})


def _http(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    body: Any | None = None,
    timeout: float = 10.0,
) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8") or "null"
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw
            return int(resp.status), parsed
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(detail) if detail else {"error": str(exc)}
        except json.JSONDecodeError:
            parsed = {"error": detail or str(exc)}
        return int(exc.code), parsed
    except Exception as exc:
        logger.debug("cloud vector HTTP failed: %s", exc, exc_info=True)
        return 0, {"error": str(exc)}


def _normalize_kind(kind: str) -> str:
    k = (kind or "context").strip().lower()
    return k if k in KINDS else "context"


def cloud_vector_stats(user_id: str) -> dict[str, Any]:
    settings = get_settings()
    backend = settings.cloud_vector_backend_resolved()
    return {
        "ok": True,
        "user_id": (user_id or "local").strip() or "local",
        "backend": backend,
        "configured": backend != "off",
        "isolation": "user_id",
        "dim": DIM,
        "kinds": sorted(KINDS),
        "pinecone_index": settings.pinecone_index or None,
        "qdrant_collection": settings.qdrant_collection or None,
    }


def upsert_cloud_vector(
    user_id: str,
    *,
    text: str,
    kind: str = "interaction",
    meta: dict[str, Any] | None = None,
    record_id: str | None = None,
) -> dict[str, Any]:
    uid = (user_id or "local").strip() or "local"
    cleaned = (text or "").strip()
    if not cleaned:
        return {"ok": False, "reason": "empty_text"}
    if uid == "local":
        return {"ok": False, "reason": "local_user_skipped", "backend": "off"}

    settings = get_settings()
    backend = settings.cloud_vector_backend_resolved()
    if backend == "off":
        return {"ok": False, "reason": "cloud_vector_off", "backend": "off"}

    rid = record_id or uuid.uuid4().hex[:16]
    kind_n = _normalize_kind(kind)
    values = embed_text(cleaned)
    payload_meta = {
        **(meta or {}),
        "user_id": uid,
        "kind": kind_n,
        "text": cleaned[:2000],
        "created_at": time.time(),
    }

    if backend == "pinecone":
        return _pinecone_upsert(settings, uid, rid, values, payload_meta)
    if backend == "qdrant":
        return _qdrant_upsert(settings, uid, rid, values, payload_meta)
    return {"ok": False, "reason": f"unknown_backend:{backend}"}


def query_cloud_vectors(
    user_id: str,
    *,
    text: str,
    limit: int = 6,
    kinds: Iterable[str] | None = None,
) -> list[dict[str, Any]]:
    uid = (user_id or "local").strip() or "local"
    cleaned = (text or "").strip()
    if not cleaned or uid == "local":
        return []

    settings = get_settings()
    backend = settings.cloud_vector_backend_resolved()
    if backend == "off":
        return []

    values = embed_text(cleaned)
    top_k = max(1, min(int(limit), 32))
    kind_list = [_normalize_kind(k) for k in kinds] if kinds else None

    if backend == "pinecone":
        return _pinecone_query(settings, uid, values, top_k, kind_list)
    if backend == "qdrant":
        return _qdrant_query(settings, uid, values, top_k, kind_list)
    return []


def mirror_local_upsert(
    *,
    profile_id: str,
    text: str,
    kind: str = "interaction",
    meta: dict[str, Any] | None = None,
    record_id: str | None = None,
) -> None:
    try:
        upsert_cloud_vector(
            profile_id,
            text=text,
            kind=kind,
            meta=meta,
            record_id=record_id,
        )
    except Exception:
        logger.debug("cloud vector mirror skipped", exc_info=True)


def _pinecone_headers(settings: Settings) -> dict[str, str]:
    return {
        "Api-Key": settings.pinecone_api_key.strip(),
        "Content-Type": "application/json",
    }


def _pinecone_host(settings: Settings) -> str:
    host = settings.pinecone_host.strip().rstrip("/")
    if host:
        return host if host.startswith("http") else f"https://{host}"
    return ""


def _pinecone_upsert(
    settings: Settings,
    user_id: str,
    record_id: str,
    values: list[float],
    meta: dict[str, Any],
) -> dict[str, Any]:
    host = _pinecone_host(settings)
    if not host or not settings.pinecone_api_key.strip():
        return {"ok": False, "reason": "pinecone_host_or_key_missing", "backend": "pinecone"}
    body = {
        "vectors": [
            {
                "id": record_id,
                "values": values,
                "metadata": {
                    "user_id": user_id,
                    "kind": meta.get("kind"),
                    "text": meta.get("text"),
                    "created_at": meta.get("created_at"),
                },
            }
        ],
        "namespace": user_id,
    }
    status, resp = _http(
        "POST",
        f"{host}/vectors/upsert",
        headers=_pinecone_headers(settings),
        body=body,
    )
    ok = bool(status) and 200 <= status < 300
    return {
        "ok": ok,
        "backend": "pinecone",
        "user_id": user_id,
        "record_id": record_id,
        "namespace": user_id,
        "http_status": status,
        "response": resp if not ok else {"upserted": True},
    }


def _pinecone_query(
    settings: Settings,
    user_id: str,
    values: list[float],
    top_k: int,
    kinds: list[str] | None,
) -> list[dict[str, Any]]:
    host = _pinecone_host(settings)
    if not host or not settings.pinecone_api_key.strip():
        return []
    body: dict[str, Any] = {
        "vector": values,
        "topK": top_k,
        "includeMetadata": True,
        "namespace": user_id,
    }
    if kinds:
        body["filter"] = {"kind": {"$in": kinds}}
    status, resp = _http(
        "POST",
        f"{host}/query",
        headers=_pinecone_headers(settings),
        body=body,
    )
    if not (status and 200 <= status < 300 and isinstance(resp, dict)):
        return []
    out: list[dict[str, Any]] = []
    for m in resp.get("matches") or []:
        if not isinstance(m, dict):
            continue
        md = m.get("metadata") if isinstance(m.get("metadata"), dict) else {}
        out.append(
            {
                "id": str(m.get("id") or ""),
                "kind": str(md.get("kind") or "context"),
                "text": str(md.get("text") or ""),
                "score": float(m.get("score") or 0),
                "meta": md,
                "created_at": md.get("created_at"),
                "source": "pinecone",
            }
        )
    return out


def _qdrant_headers(settings: Settings) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    key = settings.qdrant_api_key.strip()
    if key:
        headers["api-key"] = key
    return headers


def _qdrant_base(settings: Settings) -> str:
    return settings.qdrant_url.strip().rstrip("/")


def _qdrant_ensure_collection(settings: Settings) -> bool:
    base = _qdrant_base(settings)
    coll = settings.qdrant_collection.strip() or "aether_episodic"
    if not base:
        return False
    status, _ = _http(
        "GET",
        f"{base}/collections/{coll}",
        headers=_qdrant_headers(settings),
        body=None,
        timeout=5.0,
    )
    if status == 200:
        return True
    put_status, _ = _http(
        "PUT",
        f"{base}/collections/{coll}",
        headers=_qdrant_headers(settings),
        body={"vectors": {"size": DIM, "distance": "Cosine"}},
        timeout=10.0,
    )
    return bool(put_status) and 200 <= put_status < 300


def _qdrant_upsert(
    settings: Settings,
    user_id: str,
    record_id: str,
    values: list[float],
    meta: dict[str, Any],
) -> dict[str, Any]:
    base = _qdrant_base(settings)
    coll = settings.qdrant_collection.strip() or "aether_episodic"
    if not base:
        return {"ok": False, "reason": "qdrant_url_missing", "backend": "qdrant"}
    _qdrant_ensure_collection(settings)
    try:
        point_id = int(record_id[:16], 16) % (2**63 - 1)
    except ValueError:
        point_id = uuid.uuid5(uuid.NAMESPACE_URL, f"{user_id}:{record_id}").int % (
            2**63 - 1
        )
    body = {
        "points": [
            {
                "id": point_id,
                "vector": values,
                "payload": {
                    "record_id": record_id,
                    "user_id": user_id,
                    "kind": meta.get("kind"),
                    "text": meta.get("text"),
                    "created_at": meta.get("created_at"),
                },
            }
        ]
    }
    status, resp = _http(
        "PUT",
        f"{base}/collections/{coll}/points?wait=true",
        headers=_qdrant_headers(settings),
        body=body,
    )
    ok = bool(status) and 200 <= status < 300
    return {
        "ok": ok,
        "backend": "qdrant",
        "user_id": user_id,
        "record_id": record_id,
        "collection": coll,
        "http_status": status,
        "response": resp if not ok else {"upserted": True},
    }


def _qdrant_query(
    settings: Settings,
    user_id: str,
    values: list[float],
    top_k: int,
    kinds: list[str] | None,
) -> list[dict[str, Any]]:
    base = _qdrant_base(settings)
    coll = settings.qdrant_collection.strip() or "aether_episodic"
    if not base:
        return []
    must: list[dict[str, Any]] = [{"key": "user_id", "match": {"value": user_id}}]
    if kinds:
        must.append({"key": "kind", "match": {"any": kinds}})
    body = {
        "vector": values,
        "limit": top_k,
        "with_payload": True,
        "filter": {"must": must},
    }
    status, resp = _http(
        "POST",
        f"{base}/collections/{coll}/points/search",
        headers=_qdrant_headers(settings),
        body=body,
    )
    if not (status and 200 <= status < 300):
        return []
    rows = resp.get("result") if isinstance(resp, dict) else None
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for m in rows:
        if not isinstance(m, dict):
            continue
        md = m.get("payload") if isinstance(m.get("payload"), dict) else {}
        out.append(
            {
                "id": str(md.get("record_id") or m.get("id") or ""),
                "kind": str(md.get("kind") or "context"),
                "text": str(md.get("text") or ""),
                "score": float(m.get("score") or 0),
                "meta": md,
                "created_at": md.get("created_at"),
                "source": "qdrant",
            }
        )
    return out
