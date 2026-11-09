"""Classify turns as simple (low-latency) vs complex (CoT sidecar)."""

from __future__ import annotations

import re
from enum import Enum

# Heuristics for tool-heavy / analytical turns that benefit from planning.
_COMPLEX_HINTS = re.compile(
    r"\b("
    r"analy[sz]e|analysis|debug|refactor|implement|architect|design|"
    r"solana|treasury|on[- ]?chain|rpc|balance|tokenomics|"
    r"code|typescript|python|fastapi|sql|schema|"
    r"memory|preference|guideline|tool|test routine|"
    r"passo a passo|analis[ea]|implement[ae]|depure|refatore|"
    r"comando|operacional|checklist"
    r")\b",
    re.IGNORECASE,
)

_MULTI_STEP = re.compile(
    r"(?:\b(?:and then|depois|então|then|next|also|além)\b)|(?:\d+[.)]\s)|(?:;\s*\w)",
    re.IGNORECASE,
)


class Complexity(str, Enum):
    SIMPLE = "simple"
    COMPLEX = "complex"


def classify_complexity(text: str) -> Complexity:
    """
    Fast, CPU-only gate. Simple voice turns stay on the Live path with no CoT.
    Complex text/tool turns get an async planning sidecar.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return Complexity.SIMPLE
    if len(cleaned) < 28 and not _COMPLEX_HINTS.search(cleaned):
        return Complexity.SIMPLE
    if _COMPLEX_HINTS.search(cleaned) or _MULTI_STEP.search(cleaned) or len(cleaned) > 160:
        return Complexity.COMPLEX
    return Complexity.SIMPLE
