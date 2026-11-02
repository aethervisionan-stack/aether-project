# Aether Vision — Frontend (Expo)

App Expo Router com Carteira Fortaleza e Voice Copilot.

## Scripts

```bash
npm install
npm start          # Expo Go / Dev Client
npm run web        # Expo Web (npx expo start --web)
npm run go         # Expo Go
npm run export:web # Validação de build web
```

## Env

Copie `.env.example` → `.env`:

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

## Rotas

- `/` → redirect para Carteira
- `/(tabs)/wallet` — Carteira Fortaleza (SOL + $VISION)
- `/(tabs)/copilot` — Voice Copilot (expo-audio + VAD)
