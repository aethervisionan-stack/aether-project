"""Test defaults: force mock audio so pytest does not require OPENAI_API_KEY."""

from __future__ import annotations

import os

import pytest

# Apply before app/settings import in collection of dependent modules.
os.environ["USE_MOCK_AUDIO"] = "true"
os.environ["PIPELINE_MODE"] = "mock"
os.environ["STT_PROVIDER"] = "mock"
os.environ["TTS_PROVIDER"] = "mock"
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ["MEMORY_ENABLED"] = "false"


@pytest.fixture(autouse=True)
def _clear_settings_caches() -> None:
    from app.config import get_settings
    from app.core.memory import get_adaptive_memory
    from app.deps import get_pipeline

    get_settings.cache_clear()
    get_pipeline.cache_clear()
    get_adaptive_memory.cache_clear()
    yield
    get_settings.cache_clear()
    get_pipeline.cache_clear()
    get_adaptive_memory.cache_clear()
