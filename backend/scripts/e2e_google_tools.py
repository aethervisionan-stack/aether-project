#!/usr/bin/env python3
"""
Hit Google Workspace / Maps GET test routes against a running backend.

Requires:
  - uvicorn on BASE (default http://127.0.0.1:8000)
  - OAuth session for gmail/calendar/drive (visit /auth/google/login first)
  - GOOGLE_MAPS_API_KEY for maps

Usage:
  python scripts/e2e_google_tools.py
  python scripts/e2e_google_tools.py --base http://127.0.0.1:8000 --profile local
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


def _get(url: str) -> tuple[int, dict]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
            body = json.loads(resp.read().decode("utf-8"))
            return resp.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"error": raw[:400]}
        return exc.code, body
    except urllib.error.URLError as exc:
        return 0, {"error": f"connection failed: {exc.reason}"}


def main() -> int:
    parser = argparse.ArgumentParser(description="E2E Google tools test routes")
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--profile", default="local")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    profile = urllib.parse.quote(args.profile)

    paths = [
        f"/tools/google/test?profile_id={profile}",
        f"/tools/gmail/test?profile_id={profile}&limit=3",
        f"/tools/calendar/test?profile_id={profile}&day=today",
        f"/tools/drive/test?profile_id={profile}&limit=3",
        "/tools/maps/test",
        "/tools/os-bridge/status",
        "/tools/os-bridge/inspector",
    ]

    hard_failures = 0
    for path in paths:
        url = f"{base}{path}"
        status, body = _get(url)
        workspace = any(name in path for name in ("/gmail/", "/calendar/", "/drive/"))

        if status == 401 and workspace:
            label = "NEED_AUTH"
        elif status == 503 and "/maps/" in path:
            label = "NEED_MAPS_KEY"  # soft: set GOOGLE_MAPS_API_KEY locally
        elif status == 0:
            label = "FAIL"
            hard_failures += 1
        elif status == 200 and body.get("ok", True):
            label = "OK"
        elif status == 200 and "active_driver" in body:
            label = "OK"
        else:
            label = "FAIL"
            hard_failures += 1


        print(f"{label:12} {status} {path}")
        if label != "OK":
            detail = body.get("detail") or body.get("error") or body
            print(f"             {json.dumps(detail, ensure_ascii=False)[:240]}")

    print("")
    if hard_failures:
        print(f"e2e: {hard_failures} hard failure(s)")
        return 1
    print("e2e: completed (NEED_AUTH means finish /auth/google/login then re-run)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
