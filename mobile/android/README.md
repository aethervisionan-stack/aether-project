# Aether Vision — Android OS Bridge

`AetherAccessibilityService` walks `AccessibilityNodeInfo`, collects visible text,
and can `dispatchGesture`. Events POST to `/tools/os-bridge/mobile/inject` and
optionally keep a Live WS open for agent gesture commands.

## Enable

1. Build/install debug APK (`./gradlew :app:installDebug`).
2. Settings → Accessibility → Aether Vision Bridge → On.
3. Backend `.env`: `AETHER_OS_BRIDGE=android`, optional `AETHER_OS_BRIDGE_TOKEN`.
4. Emulator HTTP base default: `http://10.0.2.2:8000`.

Never embed API secrets in the APK — use local network + Bearer token.
