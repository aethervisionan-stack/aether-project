"""SQLite engine / session factory — default file: backend/aether_vision.db."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import BACKEND_DIR
from app.db.models import Base

logger = logging.getLogger("aether.db")

DEFAULT_SQLITE_NAME = "aether_vision.db"


def resolve_sqlite_path(configured: str | None = None) -> Path:
    raw = (configured or DEFAULT_SQLITE_NAME).strip() or DEFAULT_SQLITE_NAME
    path = Path(raw)
    if not path.is_absolute():
        path = (BACKEND_DIR / path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@lru_cache
def get_engine(sqlite_url: str = "") -> Engine:
    """
    Create a cached SQLite engine.

    Empty `sqlite_url` → Settings.sqlite_path (default backend/aether_vision.db).
    Tests can pass an explicit `sqlite:///` URL then call reset_db_caches().
    """
    if sqlite_url:
        url = sqlite_url
        path_hint = sqlite_url
    else:
        from app.config import get_settings

        path = resolve_sqlite_path(get_settings().sqlite_path)
        url = f"sqlite:///{path.as_posix()}"
        path_hint = str(path)

    # StaticPool for :memory: so create_all and sessions share one connection.
    connect_args: dict[str, bool] = {"check_same_thread": False}
    engine_kwargs: dict[str, Any] = {
        "future": True,
        "connect_args": connect_args,
    }
    if ":memory:" in url:
        engine_kwargs["poolclass"] = StaticPool

    engine = create_engine(url, **engine_kwargs)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
        _ = connection_record
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    logger.info("sqlite engine ready url=%s", path_hint)
    return engine


@lru_cache
def get_session_factory(sqlite_url: str = "") -> sessionmaker[Session]:
    engine = get_engine(sqlite_url)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db(sqlite_url: str = "") -> Path | None:
    """Create tables if missing. Returns filesystem path when using file SQLite."""
    engine = get_engine(sqlite_url)
    Base.metadata.create_all(bind=engine)
    if sqlite_url.startswith("sqlite:///") and ":memory:" not in sqlite_url:
        return Path(sqlite_url.removeprefix("sqlite:///"))
    if not sqlite_url:
        from app.config import get_settings

        return resolve_sqlite_path(get_settings().sqlite_path)
    return None


def reset_db_caches() -> None:
    get_engine.cache_clear()
    get_session_factory.cache_clear()
