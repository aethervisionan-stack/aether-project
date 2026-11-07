# Visão do Éter / Aether Vision (Android)

Jetpack Compose client for the **Visão do Éter** voice copiloto (Headset M100 → STT → Gemini / Firebase AI → Consenso Alfa → TTS).

This module lives under `android/` so it does not collide with the Next.js `app/` router at the repo root.

## Stack

- Kotlin **2.2** / Compose BOM **2024.09.00** / Room **2.7.0**
- Retrofit + Moshi + OkHttp
- Firebase AI Logic (`gemini-3.8-flash`) + App Check
- Cleartext backend default: `http://10.0.2.2:8000/`

## Open in Android Studio

1. **File → Open** → select the `android/` directory (not the monorepo root).
2. Replace `app/google-services.json` with a real Firebase Android app config for `com.example.aethervision`.
3. Set `recaptcha_site_key` in `app/src/main/res/values/strings.xml` for release App Check.
4. Run on an emulator or device with microphone / Bluetooth permissions.

## Backend

Point Settings → backend URL at the FastAPI Phase 1 service (`POST /process-audio`). Emulator loopback: `http://10.0.2.2:8000/`.
