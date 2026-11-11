"""Native OS bridge — confirmation scope + factory + capture gate (isolated app)."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AETHER_OS_BRIDGE", "mock")
    monkeypatch.setenv("AETHER_DESKTOP_CAPTURE_ENABLED", "true")
    monkeypatch.setenv("AETHER_DESKTOP_INPUT_ENABLED", "true")
    monkeypatch.setenv("AETHER_DESKTOP_NOTIFICATIONS_ENABLED", "true")
    monkeypatch.setenv("AETHER_OS_BRIDGE_TOKEN", "")

    from app.config import get_settings
    from app.os_bridge.bridge_routes import router as bridge_router
    from app.os_bridge.confirmation import get_confirmation_engine
    from app.os_bridge.factory import reset_os_bridge_cache
    from app.os_bridge.scope import get_scope_registry
    from app.tools.routes import router as tools_router

    get_settings.cache_clear()
    reset_os_bridge_cache()
    get_confirmation_engine()._pending.clear()  # noqa: SLF001
    get_scope_registry()._grants.clear()  # noqa: SLF001

    app = FastAPI()
    app.include_router(tools_router)
    app.include_router(bridge_router)

    @app.get("/health")
    async def health():
        settings = get_settings()
        from app.os_bridge.factory import get_os_bridge

        return {
            "hands_free": {
                "two_step_confirm": True,
                "scoped_confirm": True,
                "os_bridge": get_os_bridge().platform,
                "desktop_capture": settings.aether_desktop_capture_enabled,
            },
            "unlocked_routes": ["/tools/os-bridge/desktop-capture"],
        }

    with TestClient(app) as c:
        yield c

    get_settings.cache_clear()
    reset_os_bridge_cache()


def test_health_exposes_os_bridge_flags(client: TestClient):
    body = client.get("/health").json()
    assert body["hands_free"]["scoped_confirm"] is True
    assert "/tools/os-bridge/desktop-capture" in body["unlocked_routes"]


def test_desktop_capture_requires_confirm(client: TestClient):
    body = client.post(
        "/tools/os-bridge/desktop-capture",
        json={"max_width": 640, "confirmed": False},
    ).json()
    assert body["status"] == "pending_confirmation"
    assert body["scope"] == "desktop_capture"
    assert body["pending_id"]


def test_confirm_then_scope_grant(client: TestClient):
    pending = client.post(
        "/tools/os-bridge/scopes/grant",
        json={"scope": "keyboard", "confirmed": False},
    ).json()
    pid = pending["pending_id"]
    done = client.post(
        "/tools/confirm",
        json={"pending_id": pid, "confirm": True, "profile_id": "local"},
    ).json()
    assert done["ok"] is True
    assert done.get("grant", {}).get("scope") == "keyboard"
    scopes = client.get("/tools/os-bridge/scopes").json()
    assert "keyboard" in scopes["active_scopes"]


def test_system_control_battery_ok(client: TestClient):
    body = client.post(
        "/tools/invoke",
        json={"name": "system_control_tool", "arguments": {"action": "battery"}},
    ).json()
    assert body["ok"] is True


def test_system_control_capture_pending(client: TestClient):
    body = client.post(
        "/tools/invoke",
        json={
            "name": "system_control_tool",
            "arguments": {"action": "desktop_capture", "max_width": 640},
        },
    ).json()
    payload = body.get("result") or body
    status = payload.get("status")
    if status is None and isinstance(payload.get("result"), dict):
        status = payload["result"].get("status")
    assert status == "pending_confirmation"


def test_mobile_inject(client: TestClient):
    body = client.post(
        "/tools/os-bridge/mobile/inject",
        json={
            "package": "com.whatsapp",
            "title": "Carlos",
            "body": "Oi",
            "sender": "Carlos",
            "favorite": True,
            "visible_text": ["Oi", "Enviar"],
        },
    ).json()
    assert body["ok"] is True
    assert body["event"]["package"] == "com.whatsapp"


def test_bridge_token_enforced(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AETHER_OS_BRIDGE_TOKEN", "test-token-not-a-secret-example")
    monkeypatch.setenv("AETHER_DESKTOP_CAPTURE_ENABLED", "true")
    from app.config import get_settings
    from app.os_bridge.bridge_routes import router as bridge_router
    from app.os_bridge.factory import reset_os_bridge_cache

    get_settings.cache_clear()
    reset_os_bridge_cache()
    app = FastAPI()
    app.include_router(bridge_router)
    with TestClient(app) as client:
        assert client.get("/tools/os-bridge/status").status_code in {401, 403}
        ok = client.get(
            "/tools/os-bridge/status",
            headers={"Authorization": "Bearer test-token-not-a-secret-example"},
        )
        assert ok.status_code == 200
        assert ok.json().get("active_driver") in {"mock", "desktop", "android"}
        insp = client.get(
            "/tools/os-bridge/inspector",
            headers={"Authorization": "Bearer test-token-not-a-secret-example"},
        )
        assert insp.status_code == 200
        assert insp.json()["active_driver"] in {"mock", "desktop", "android"}
    get_settings.cache_clear()
    reset_os_bridge_cache()
    monkeypatch.delenv("AETHER_OS_BRIDGE_TOKEN", raising=False)


def test_bridge_inspector_active_driver(client: TestClient):
    body = client.get("/tools/os-bridge/inspector").json()
    assert body["ok"] is True
    assert body["active_driver"] == "mock"
    assert body["configured_driver"] == "mock"
    assert body["driver"] == "mock"
    status = client.get("/tools/os-bridge/status").json()
    assert status["active_driver"] == "mock"



def test_confirmation_phrases_cover_desktop():
    from app.os_bridge.confirmation import build_speak_summary, requires_confirmation

    assert requires_confirmation("system_control_tool", "desktop_capture")
    assert requires_confirmation("system_control_tool", "keyboard")
    speak = build_speak_summary("system_control_tool", "desktop_capture", {}).lower()
    assert "captur" in speak or "tela" in speak


def test_desktop_bundle_status():
    from app.os_bridge.desktop import build_desktop_bundle

    status = build_desktop_bundle().status()
    assert status["platform"] == "desktop"
    assert status["mock"] is False
    assert status["desktop_capture"] is True
