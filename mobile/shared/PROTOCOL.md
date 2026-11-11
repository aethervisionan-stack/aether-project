# Shared mobile ↔ backend protocol (hands-free + OS Bridge)

Native apps under `/mobile` speak JSON over the existing Live WebSocket and REST surfaces. Contracts for OS actions live in `backend/app/os_bridge/contracts.py` — do not invent parallel schemas.

## Hands-free voice path

1. **Wake word (Porcupine)** → enter “armed” listening.
2. **Continuous VAD** (energy RMS, mirrors `client/src/voice/VadController.ts`) → speech start without a tap.
3. Stream PCM 16-bit mono @ 16 kHz on Live WS (`/ws/live`) same as web client.
4. On barge-in / end-of-speech, emit the same mobility events the web client uses (`ptt`, `barge_in`, etc.).

## Sidebands

| Channel | Payload | Cadence |
| --- | --- | --- |
| GPS | `{ "type": "geo", "lat", "lon", "accuracy_m", "speed_mps", "ts" }` | continuous / paced |
| Vision | `{ "type": "vision_frame", "mime": "image/jpeg", "b64", "ts", "facing" }` | periodic (`VISION_SIDEBAND_INTERVAL_MS`) |
| Push | FCM data messages → local notification or silent wake of FGS / BG audio |

## OS Bridge (extend, don’t fork)

Android package `com.aethervision.mobile.osbridge` implements Accessibility / NotificationListener stubs that map to:

- `MessagingBridge`, `TelephonyBridge`, `SystemControlBridge`, `AccessibilityBridge`
- Confirmation loop: irreversible tools stay `pending_confirmation` until voice/text confirm (see hands-free OS agent).

iOS ships stub protocols under `OSBridge/` until AX / Intents entitlements are provisioned.

## Tree ownership

```
mobile/
  android/     ← single Android tree
                 com.aethervision.mobile.*  (hands-free, sensors, FCM, NotificationListener)
                 com.aethervision.bridge.*  (AccessibilityService + BridgeWebSocketClient)
  ios/         ← Background Audio/Location + wake/VAD + sensors + FCM
  shared/      ← cross-platform protocol notes
```

Never create a second Android app module / applicationId. OS Bridge inject: `POST /tools/os-bridge/mobile/inject`.
