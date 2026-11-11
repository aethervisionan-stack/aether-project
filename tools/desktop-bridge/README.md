# Desktop bridge (nut-js companion)

Optional Node helper. **Primary automation is Python Win32** in
`backend/app/os_bridge/desktop.py`.

```bash
cd tools/desktop-bridge
npm install
set AETHER_BRIDGE_HTTP=http://127.0.0.1:8000
npm start -- status
```

Sensitive actions still go through FastAPI scoped confirmation.
