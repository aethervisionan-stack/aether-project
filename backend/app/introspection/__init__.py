"""Self-awareness / introspection: capabilities manifest + help tools + prompt sync."""

from app.introspection.manifest import (
    CAPABILITY_CATEGORIES,
    build_feature_flags,
    capabilities_for_category,
    list_capability_summaries,
)
from app.introspection.prompt import (
    build_communication_guidelines,
    build_self_knowledge_block,
)
from app.introspection.telemetry import get_latency_telemetry, record_latency_sample

__all__ = [
    "CAPABILITY_CATEGORIES",
    "build_communication_guidelines",
    "build_feature_flags",
    "build_self_knowledge_block",
    "capabilities_for_category",
    "get_latency_telemetry",
    "list_capability_summaries",
    "record_latency_sample",
]
