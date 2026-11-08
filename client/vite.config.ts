import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // fail loudly if :5173 is taken (no silent hop)
    // Bind all interfaces so LAN / phone testing works; start_dev.ps1 can still
    // override with --host 127.0.0.1 for desktop-only sessions.
    host: true,
    // localtunnel / ngrok / LAN hostnames must not be blocked by Vite 6 DNS rebinding checks
    allowedHosts: true,
    proxy: {
      "/api": {
        // Always hit the local FastAPI; phone → tunnel/LAN → Vite → this target.
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
