import path from "node:path";
import { defineConfig } from "vite";

/**
 * Dev proxy:
 *   browser  →  /api/ws/live  (ws)
 *   Vite     →  ws://127.0.0.1:8000/ws/live
 *
 * GeminiLiveService defaults to `ws(s)://<host>/api/ws/live` so the API key
 * stays on the FastAPI side and the path matches production reverse proxies
 * that mount the backend under `/api`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
