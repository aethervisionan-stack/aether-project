"""Test defaults: force mock audio so pytest does not require OPENAI_API_KEY."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

# Apply before app/settings import in collection of dependent modules.
os.environ["USE_MOCK_AUDIO"] = "true"
os.environ["PIPELINE_MODE"] = "mock"
os.environ["STT_PROVIDER"] = "mock"
os.environ["TTS_PROVIDER"] = "mock"
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ["MEMORY_ENABLED"] = "false"

# Default isolated SQLite for the suite (overridden per-test via tmp_path when needed).
_DEFAULT_TEST_DB = Path(tempfile.gettempdir()) / "aether_vision_pytest.db"
os.environ["SQLITE_PATH"] = str(_DEFAULT_TEST_DB)


@pytest.fixture(autouse=True)
def _clear_settings_caches(tmp_path: Path) -> None:
    from app.config import get_settings
    from app.core.memory import get_adaptive_memory
    from app.db.session import init_db, reset_db_caches
    from app.deps import get_pipeline

    db_file = tmp_path / "aether_vision.db"
    os.environ["SQLITE_PATH"] = str(db_file)
    get_settings.cache_clear()
    get_pipeline.cache_clear()
    get_adaptive_memory.cache_clear()
    reset_db_caches()
    init_db()
    yield
    get_settings.cache_clear()
    get_pipeline.cache_clear()
    get_adaptive_memory.cache_clear()
    reset_db_caches()
