# Aether Vision iOS (hands-free scaffold)

Swift sources for Background Audio + Location, Porcupine wake hooks, continuous VAD, GPS, vision sideband, and FCM/APNs registration.

## Bring-up

1. Xcode 15+ → New App → Product Name `AetherVision`, Bundle ID `com.aethervision.mobile`, Language Swift.
2. Replace / add files from `AetherVision/` into the target (keep group structure).
3. Merge keys from `AetherVision/Info-Permissions.plist` into the target Info.
4. Signing & Capabilities:
   - Background Modes: **Audio, AirPlay, and Picture in Picture**, **Location updates**
   - Push Notifications
5. Add Picovoice `Porcupine-iOS` (SPM/CocoaPods) and Firebase Messaging when ready.
6. Secrets: copy `Secrets.xcconfig.example` → `Secrets.xcconfig` (gitignored) or set build settings per `../ENV.md`.
7. Drop `GoogleService-Info.plist` into the target.

Hooks compile without Porcupine/Firebase via `#if canImport(...)` stubs.

## Entry

`HandsFreeSession.shared.start()` from `AetherVisionApp` after mic/location/camera permission prompts.
