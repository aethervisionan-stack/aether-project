import path from "node:path";
import { defineConfig, loadEnv } from "vite";

/**
 * Port isolation (this project only):
 *   Preferred HUD: 5174 (avoids default 5173 collisions)
 *   strictPort: false -> Vite auto-picks next free if preferred is busy
 *   API proxy target from AETHER_API_ORIGIN / VITE_API_PROXY_TARGET (default :8001)
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const hudPort = Number(env.AETHER_HUD_PORT || process.env.AETHER_HUD_PORT || 5174);
  const apiOrigin =
    env.AETHER_API_ORIGIN ||
    process.env.AETHER_API_ORIGIN ||
    env.VITE_API_PROXY_TARGET ||
    process.env.VITE_API_PROXY_TARGET ||
    "http://127.0.0.1:8001";

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: Number.isFinite(hudPort) && hudPort > 0 ? hudPort : 5174,
      strictPort: false,
      host: "127.0.0.1",
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
          ws: true,
          timeout: 0,
          proxyTimeout: 0,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
  };
});