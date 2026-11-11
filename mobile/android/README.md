# Aether Vision — Android (hands-free + OS Bridge)

**One** Gradle app (`com.aethervision.mobile`). OS Bridge Accessibility lives under
`com.aethervision.bridge` in this same tree — do not create a second Android module/applicationId.

## Packages

| Package | Role |
| --- | --- |
| `com.aethervision.mobile.handsfree` | Foreground Service, Porcupine wake, continuous VAD, PCM capture |
| `com.aethervision.mobile.sensors` | Continuous GPS + periodic camera sideband |
| `com.aethervision.mobile.push` | FCM service + token registrar |
| `com.aethervision.mobile.osbridge` | NotificationListener → inject path |
| `com.aethervision.bridge` | AccessibilityService (node tree + gestures) + `BridgeWebSocketClient` |

## Enable

1. Copy `secrets.properties.example` → `secrets.properties` (Picovoice + URLs).
2. Optional: `google-services.json` into `app/` (see `../ENV.md`).
3. Open `mobile/android` in Android Studio → sync → `assembleDebug`.
4. Grant mic / location / camera; tap **Start hands-free**.
5. **Settings → Accessibility → Aether Vision → On** for OS Bridge.
6. Tap **Connect OS Bridge** (HTTP/WS targets; emulator defaults use `10.0.2.2`).

| Setting | Purpose |
| --- | --- |
| `PICOVOICE_ACCESS_KEY` | Porcupine wake word |
| `AETHER_LIVE_WS_URL` / `BRIDGE_WS_URL` | Live WS |
| `AETHER_OS_BRIDGE_BASE_URL` / `BRIDGE_HTTP_BASE` | REST inject base |
| `AETHER_OS_BRIDGE_TOKEN` | Optional Bearer for `/tools/os-bridge/mobile/inject` |
| `AETHER_PUSH_REGISTER_URL` | FCM token POST |

## Security

Accessibility can read on-screen text and inject gestures — treat as full device control.
Backend scopes + two-step confirm still gate irreversible agent actions.
