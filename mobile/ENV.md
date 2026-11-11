# Mobile environment keys (Picovoice / FCM)

Do **not** commit real keys. Copy `mobile/.env.example` → `mobile/.env` (gitignored) and platform secret files as below.

## Picovoice / Porcupine (wake word)

| Variable | Where used | Notes |
| --- | --- | --- |
| `PICOVOICE_ACCESS_KEY` | Android `secrets.properties`, iOS xcconfig / Info plist build setting | From [Picovoice Console](https://console.picovoice.ai/) |
| `PICOVOICE_KEYWORD_PATH` | Optional custom `.ppn` under `android/app/src/main/assets/` and iOS bundle | Default scaffold uses built-in keyword hook; replace with “Aether” custom model when trained |
| `PICOVOICE_SENSITIVITY` | `0.0`–`1.0` | Default `0.65` |

### Android wiring

1. Create `mobile/android/secrets.properties` (gitignored):

```properties
PICOVOICE_ACCESS_KEY=your_picovoice_access_key
```

2. `app/build.gradle.kts` already reads `secrets.properties` into `BuildConfig.PICOVOICE_ACCESS_KEY`.
3. Place custom keyword at `android/app/src/main/assets/keywords/aether_android.ppn` when ready.

### iOS wiring

1. Create `mobile/ios/Secrets.xcconfig` (gitignored; see example):

```
PICOVOICE_ACCESS_KEY = your_picovoice_access_key
```

2. Or set `PICOVOICE_ACCESS_KEY` in the Xcode scheme environment / user-defined build setting consumed by `WakeWordEngine`.
3. Bundle custom keyword as `keywords/aether_ios.ppn` when ready.

## Firebase Cloud Messaging (FCM)

| Variable / file | Platform | Notes |
| --- | --- | --- |
| `google-services.json` | Android `app/` | From Firebase Console → Project settings → Android app (`com.aethervision.mobile`) |
| `GoogleService-Info.plist` | iOS app root | From Firebase Console → iOS app (`com.aethervision.mobile`) |
| `FCM_SENDER_ID` | Optional shared | Project number / sender id |
| `AETHER_PUSH_REGISTER_URL` | Both | Backend endpoint that stores device tokens (default `https://api.example/push/register`) |

### Android FCM

1. Drop `google-services.json` into `mobile/android/app/`.
2. Ensure Google Services Gradle plugin is applied (already in scaffold).
3. Runtime: `AetherFirebaseMessagingService` receives pushes; `FcmTokenRegistrar` POSTs the token to `AETHER_PUSH_REGISTER_URL`.

### iOS FCM / APNs

1. Enable Push Notifications + Background Modes in Xcode capabilities.
2. Upload APNs key/cert to Firebase.
3. Add `GoogleService-Info.plist`.
4. `FcmPushRegistrar` mirrors Android token registration.

## Optional backend / live session

| Variable | Default / purpose |
| --- | --- |
| `AETHER_LIVE_WS_URL` | `wss://…/ws/live` — Gemini Live / mobility WS used after VAD speech start |
| `AETHER_OS_BRIDGE_BASE_URL` | REST base for OS Bridge tool confirms / listener poll |
| `VISION_SIDEBAND_INTERVAL_MS` | Periodic camera frame interval (default `2500`) |
| `GPS_MIN_INTERVAL_MS` | Continuous GPS min interval (default `2000`) |
| `GPS_MIN_DISTANCE_M` | GPS min displacement meters (default `3`) |

## Quick checklist

- [ ] Picovoice AccessKey in platform secrets
- [ ] Custom wake `.ppn` (optional; built-in keyword works for bring-up)
- [ ] Firebase Android + iOS apps registered
- [ ] `google-services.json` / `GoogleService-Info.plist` present locally
- [ ] Backend push register URL reachable
- [ ] Mic, location, camera, notification listener permissions granted on device
