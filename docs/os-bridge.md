# Native OS Bridge

There is **no** `/server/src/bridge` tree in this repo. The bridge lives in FastAPI:

| Path | Role |
| --- | --- |
| `backend/app/os_bridge/` | Contracts, confirmation, scopes, desktop Win32, routes |
| `backend/app/tools/os_handlers.py` | `system_control_tool` |
| `tools/desktop-bridge/` | Optional nut-js Node companion |
| `mobile/android/` | `AetherAccessibilityService` + WS/HTTP IPC |

## Modes

| `AETHER_OS_BRIDGE` | Behavior |
| --- | --- |
| `mock` | **DEV fallback (default, off for production).** `system_control_tool` uses mock system APIs. |
| `desktop` | Real Win32 path — volume/media + desktop capture / keyboard / mouse when flags enabled. |
| `android` | Mobile AccessibilityService IPC + desktop companion helpers. |

`system_control_tool` always resolves the bridge via `app.os_bridge.factory.get_os_bridge` — production must set `desktop` or `android`, not `mock`.

## Enable (desktop)

In `backend/.env` (never commit real tokens):

```env
AETHER_OS_BRIDGE=desktop
AETHER_OS_BRIDGE_TOKEN=
AETHER_DESKTOP_CAPTURE_ENABLED=true
AETHER_DESKTOP_INPUT_ENABLED=true
AETHER_DESKTOP_NOTIFICATIONS_ENABLED=true
```

Restart uvicorn. `/health` → `hands_free.os_bridge` should be `desktop`.

Capture / input / notification flags default **false** (off). Enable explicitly for production desktops.

## Confirm / scope

1. Sensitive actions (`desktop_capture`, `notification_read`, `keyboard`, `mouse`) are in `IRREVERSIBLE`.
2. First invoke → `pending_confirmation` + `speak` + `pending_id` (same loop as messaging send).
3. Confirm via voice / `POST /tools/confirm` → execute and grant a TTL scope (~5 min).
4. Feature flags must be on; otherwise routes return 403.
5. If `AETHER_OS_BRIDGE_TOKEN` is set, send `Authorization: Bearer …`.

## Routes

- `GET  /tools/os-bridge/status` — includes `active_driver` (`mock` \| `desktop` \| `android`)
- `GET  /tools/os-bridge/inspector` — same payload + `summary` string for ops/UI
- `POST /tools/os-bridge/desktop-capture`
- `POST /tools/os-bridge/notifications/read`
- `POST /tools/os-bridge/keyboard`
- `POST /tools/os-bridge/mouse`
- `POST /tools/os-bridge/scopes/grant`
- `POST /tools/os-bridge/mobile/inject`

```powershell
pytest tests\test_os_bridge_native.py -q
# curl http://127.0.0.1:8000/tools/os-bridge/inspector
```


## Android

See `mobile/android/README.md`. Set `AETHER_OS_BRIDGE=android`.
