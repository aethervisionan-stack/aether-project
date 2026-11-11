#!/usr/bin/env python3
"""
Validate backend/.env for Google OAuth + Gemini without printing secret values.

Usage (from backend/):
  python scripts/verify_env.py
  python -m scripts.verify_env
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Allow `python scripts/verify_env.py` from backend/ without installing a package.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from dotenv import load_dotenv  # noqa: E402

ENV_PATH = _BACKEND_ROOT / ".env"
EXPECTED_CALLBACK_PATH = "/auth/google/callback"
EXPECTED_LOCAL_REDIRECT = "http://127.0.0.1:8000/auth/google/callback"


def _mask(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return "(empty)"
    if len(raw) <= 8:
        return "***"
    return f"{raw[:4]}…{raw[-4:]} (len={len(raw)})"


def _is_placeholder(value: str) -> bool:
    lowered = (value or "").strip().lower()
    if not lowered:
        return True
    return any(
        token in lowered
        for token in ("placeholder", "replace_me", "your-", "example", "changeme")
    )


def _present(value: str) -> bool:
    return bool((value or "").strip()) and not _is_placeholder(value)


def _load_env() -> dict[str, str]:
    load_dotenv(ENV_PATH, override=False)
    keys = (
        "GEMINI_API_KEY",
        "GOOGLE_OAUTH_CLIENT_ID",
        "GOOGLE_OAUTH_CLIENT_SECRET",
        "GOOGLE_OAUTH_CLIENT_SECRETS_FILE",
        "GOOGLE_OAUTH_REDIRECT_URI",
        "GOOGLE_REDIRECT_URI",
        "GOOGLE_MAPS_API_KEY",
        "GOOGLE_TOKEN_FERNET_KEY",
        "AETHER_OS_BRIDGE",
    )
    return {k: os.environ.get(k, "") for k in keys}


def verify() -> int:
    print(f"verify-env: loading {ENV_PATH}")
    if not ENV_PATH.is_file():
        print("FAIL  backend/.env missing — copy from .env.example and fill secrets locally")
        return 1

    env = _load_env()
    errors: list[str] = []
    warnings: list[str] = []

    gemini = env["GEMINI_API_KEY"]
    client_id = env["GOOGLE_OAUTH_CLIENT_ID"]
    client_secret = env["GOOGLE_OAUTH_CLIENT_SECRET"]
    secrets_file = env["GOOGLE_OAUTH_CLIENT_SECRETS_FILE"]
    redirect_canonical = env["GOOGLE_OAUTH_REDIRECT_URI"]
    redirect_alias = env["GOOGLE_REDIRECT_URI"]
    maps_key = env["GOOGLE_MAPS_API_KEY"]
    fernet = env["GOOGLE_TOKEN_FERNET_KEY"]
    bridge = (env["AETHER_OS_BRIDGE"] or "mock").strip().lower() or "mock"

    # --- Gemini ---
    if _present(gemini):
        print(f"OK    GEMINI_API_KEY={_mask(gemini)}")
    else:
        print("FAIL  GEMINI_API_KEY missing or placeholder")
        errors.append("GEMINI_API_KEY")

    # --- OAuth client ---
    secrets_path_ok = False
    if _present(secrets_file):
        path = Path(secrets_file)
        if not path.is_absolute():
            path = _BACKEND_ROOT / path
        if path.is_file():
            secrets_path_ok = True
            print(f"OK    GOOGLE_OAUTH_CLIENT_SECRETS_FILE={path.name} (present)")
        else:
            print(f"FAIL  GOOGLE_OAUTH_CLIENT_SECRETS_FILE path not found: {path}")
            errors.append("GOOGLE_OAUTH_CLIENT_SECRETS_FILE")

    id_ok = _present(client_id)
    secret_ok = _present(client_secret)
    if id_ok:
        print(f"OK    GOOGLE_OAUTH_CLIENT_ID={_mask(client_id)}")
    else:
        print("MISS  GOOGLE_OAUTH_CLIENT_ID")
    if secret_ok:
        print(f"OK    GOOGLE_OAUTH_CLIENT_SECRET={_mask(client_secret)}")
    else:
        print("MISS  GOOGLE_OAUTH_CLIENT_SECRET")

    oauth_creds_ok = secrets_path_ok or (id_ok and secret_ok)
    if not oauth_creds_ok:
        errors.append("GOOGLE_OAUTH_CLIENT_ID/SECRET")
        print(
            "FAIL  OAuth client credentials incomplete — set CLIENT_ID+SECRET "
            "or a valid CLIENT_SECRETS_FILE"
        )

    # --- Redirect URI consistency ---
    effective_redirect = (redirect_canonical or redirect_alias or "").strip()
    if not effective_redirect:
        effective_redirect = EXPECTED_LOCAL_REDIRECT
        warnings.append("redirect_uri_defaulted")
        print(f"WARN  no redirect env set — app default is {EXPECTED_LOCAL_REDIRECT}")

    if redirect_canonical and redirect_alias:
        if redirect_canonical.strip() != redirect_alias.strip():
            print(
                "FAIL  URI inconsistency: GOOGLE_OAUTH_REDIRECT_URI "
                f"({redirect_canonical.strip()!r}) != GOOGLE_REDIRECT_URI "
                f"({redirect_alias.strip()!r})"
            )
            errors.append("redirect_uri_mismatch")
        else:
            print(
                "OK    GOOGLE_OAUTH_REDIRECT_URI and GOOGLE_REDIRECT_URI agree "
                f"({redirect_canonical.strip()})"
            )
    elif redirect_canonical:
        print(f"OK    GOOGLE_OAUTH_REDIRECT_URI={redirect_canonical.strip()}")
    elif redirect_alias:
        print(
            f"OK    GOOGLE_REDIRECT_URI={redirect_alias.strip()} "
            "(alias; prefer GOOGLE_OAUTH_REDIRECT_URI)"
        )

    parsed = urlparse(effective_redirect)
    path_ok = (parsed.path or "").rstrip("/") == EXPECTED_CALLBACK_PATH.rstrip("/")
    if not path_ok:
        print(
            f"FAIL  URI inconsistency: redirect path {parsed.path!r} "
            f"must be {EXPECTED_CALLBACK_PATH!r}"
        )
        errors.append("redirect_path")
    else:
        print(f"OK    redirect path matches {EXPECTED_CALLBACK_PATH}")

    if effective_redirect.rstrip("/") != EXPECTED_LOCAL_REDIRECT.rstrip("/"):
        print(
            "WARN  redirect URI differs from local default "
            f"{EXPECTED_LOCAL_REDIRECT!r} — ensure Google Cloud Console matches exactly"
        )
        warnings.append("redirect_not_local_default")
    else:
        print("OK    redirect matches local Console default (127.0.0.1:8000)")

    # --- Optional helpers ---
    if _present(maps_key):
        print(f"OK    GOOGLE_MAPS_API_KEY={_mask(maps_key)}")
    else:
        print("WARN  GOOGLE_MAPS_API_KEY missing — Maps test route will fail until set")
        warnings.append("maps_key")

    if _present(fernet):
        print(f"OK    GOOGLE_TOKEN_FERNET_KEY={_mask(fernet)}")
    else:
        print("WARN  GOOGLE_TOKEN_FERNET_KEY empty — a runtime key may be derived/created")
        warnings.append("fernet")

    if bridge in {"mock", "desktop", "android"}:
        print(f"OK    AETHER_OS_BRIDGE={bridge}")
    else:
        print(f"FAIL  AETHER_OS_BRIDGE={bridge!r} (expected mock|desktop|android)")
        errors.append("os_bridge")

    # --- Verdict ---
    oauth_ready = oauth_creds_ok and "redirect_uri_mismatch" not in errors and "redirect_path" not in errors
    print("")
    if oauth_ready and not errors:
        print("RESULT: OAuth-ready — login at http://127.0.0.1:8000/auth/google/login")
    elif oauth_ready and errors:
        print("RESULT: OAuth-ready (client+redirect OK) but other FAIL items remain")
    else:
        print("RESULT: NOT OAuth-ready — fix FAIL lines above before /auth/google/login")

    if warnings:
        print(f"warnings={len(warnings)}: {', '.join(warnings)}")
    if errors:
        print(f"errors={len(errors)}: {', '.join(errors)}")
        return 1
    print("all required checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(verify())
