# Aether Vision — native hands-free mobile

Scaffold for always-on voice (Porcupine wake + continuous VAD), GPS, vision sideband frames, and FCM — plus OS Bridge native stubs in the **same** Android tree.

## Layout

```
mobile/
  README.md                 # this file
  ENV.md                    # Picovoice / FCM / backend keys
  .env.example
  shared/PROTOCOL.md        # WS + OS Bridge contract pointers
  android/                  # ONE Gradle app: com.aethervision.mobile
    .../mobile/handsfree/   # Foreground Service, wake, VAD
    .../mobile/sensors/     # GPS + camera sideband
    .../mobile/push/        # FCM
    .../mobile/osbridge/    # NotificationListener
    .../bridge/             # OS Bridge AccessibilityService + WS/HTTP IPC
  ios/AetherVision/         # Swift sources (Xcode project bring-up)
    HandsFree/              # BG audio session, wake, VAD
    Sensors/                # BG location + camera frames
    Push/                   # FCM / APNs registrar
    OSBridge/               # protocol stubs
```

OS Bridge Accessibility (`com.aethervision.bridge`) and hands-free share this single Android tree / `applicationId`. Do not add a second conflicting module.

## Android build notes

**Requirements:** Android Studio Ladybug+, JDK 17, device API 26+, USB debugging.

```bash
cd mobile/android
# optional: copy secrets
cp ../.env.example ../.env
# create secrets.properties with PICOVOICE_ACCESS_KEY=…
# drop google-services.json into app/ when Firebase is ready

./gradlew :app:assembleDebug
# Windows: .\gradlew.bat :app:assembleDebug
```

Open `mobile/android` in Android Studio if the Gradle wrapper jars are missing — Studio will regenerate the wrapper. The scaffold commits `gradlew` scripts + `gradle-wrapper.properties`; binary `gradle-wrapper.jar` may need Studio/local bootstrap.

**Permissions:** mic, fine/coarse location, camera, FOREGROUND_SERVICE*, POST_NOTIFICATIONS, and Notification Listener / Accessibility (OS Bridge) are declared in `AndroidManifest.xml`. Grant at runtime from `MainActivity`.

**Foreground Service:** `HandsFreeForegroundService` runs with `microphone|location|camera` FGS types, owns wake word + VAD loop, GPS, and periodic JPEG sideband captures.

## iOS build notes

**Requirements:** Xcode 15+, iOS 16+, physical device recommended (BG audio + location + camera).

1. Create an Xcode app target `AetherVision` (`com.aethervision.mobile`) and add all sources under `ios/AetherVision/`.
2. Capabilities: **Background Modes** → Audio, Location updates; **Push Notifications**.
3. Info.plist keys are documented in `ios/AetherVision/Info-Permissions.plist` — merge into the target Info.
4. Add `Secrets.xcconfig` / `GoogleService-Info.plist` per `ENV.md`.
5. SPM / CocoaPods: add Picovoice `Porcupine-iOS` and Firebase Messaging when linking real SDKs (hooks are stubbed behind `#if canImport`).

```bash
# after Xcode project exists:
open mobile/ios/AetherVision.xcodeproj   # or .xcworkspace
```

Until the `.xcodeproj` is generated locally, treat `ios/AetherVision/**` as the source of truth.

## Hands-free flow (both platforms)

1. Start FGS / BG audio session.
2. Porcupine listens for wake word (AccessKey required for real engine; scaffold no-ops safely without key).
3. On wake → continuous VAD arms; speech start opens Live WS PCM uplink without a tap.
4. GPS + vision frames publish as sideband JSON (see `shared/PROTOCOL.md`).
5. FCM can silently nudge the service awake or surface high-priority OS Bridge confirms.

## Related backend

- `backend/app/os_bridge/` — typed contracts this native layer implements
- `backend/app/websocket/live.py` — Live session + mobility / tool confirm
- Web reference VAD: `client/src/voice/VadController.ts`
