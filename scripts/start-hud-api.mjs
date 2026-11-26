#!/usr/bin/env node
/**
 * Aether HUD + API local launcher with port isolation.
 * - Never kills processes on other ports / other projects.
 * - If preferred ports are busy, picks the next free TCP ports.
 * - Prints exact assigned URLs, then leaves children running.
 */
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const PREFERRED = {
  api: Number(process.env.AETHER_API_PORT || 8001),
  hud: Number(process.env.AETHER_HUD_PORT || 5174),
  landing: Number(process.env.AETHER_LANDING_PORT || process.env.PORT || 3010),
};

const MAX_SCAN = 40;

function canBind(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function nextFree(start) {
  for (let port = start; port < start + MAX_SCAN; port += 1) {
    if (await canBind(port)) return port;
  }
  throw new Error(
    `No free TCP port in ${start}..${start + MAX_SCAN - 1}. Refusing to kill other processes.`,
  );
}

function spawnLogged(command, args, cwd, env, label) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const prefix = `[${label}]`;
  child.stdout.on("data", (buf) => {
    process.stdout.write(`${prefix} ${buf}`);
  });
  child.stderr.on("data", (buf) => {
    process.stderr.write(`${prefix} ${buf}`);
  });
  child.on("exit", (code, signal) => {
    console.error(`${prefix} exited code=${code} signal=${signal ?? ""}`);
  });
  return child;
}

const apiPort = await nextFree(PREFERRED.api);
const hudPort = await nextFree(PREFERRED.hud);
const landingPort = await nextFree(PREFERRED.landing);

const apiOrigin = `http://127.0.0.1:${apiPort}`;
const hudOrigin = `http://127.0.0.1:${hudPort}`;
const landingOrigin = `http://127.0.0.1:${landingPort}`;
const cors = [
  hudOrigin,
  `http://localhost:${hudPort}`,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
].join(",");

console.log("=== Aether port isolation (no foreign process kills) ===");
console.log(
  `Preferred → API ${PREFERRED.api} / HUD ${PREFERRED.hud} / Landing ${PREFERRED.landing}`,
);
console.log(
  `Assigned  → API ${apiPort} / HUD ${hudPort} / Landing ${landingPort}`,
);
console.log(`API URL      ${apiOrigin}`);
console.log(`HUD URL      ${hudOrigin}`);
console.log(
  `Landing URL  ${landingOrigin} (not auto-started; use npm run dev:landing)`,
);
console.log(`Health       ${apiOrigin}/health`);
console.log(
  "Unlock       BILLING_DEV_UNLOCK + BYPASS_SUBSCRIPTION_CHECK + VITE_DEV_UNLOCK",
);
console.log("=========================================================");

const pyWin = path.join(root, "backend", ".venv", "Scripts", "python.exe");
const pyUnix = path.join(root, "backend", ".venv", "bin", "python");
const python = existsSync(pyWin) ? pyWin : existsSync(pyUnix) ? pyUnix : "python";

const apiEnv = {
  ...process.env,
  PORT: String(apiPort),
  HOST: "127.0.0.1",
  CORS_ORIGINS: cors,
  BILLING_DEV_UNLOCK: process.env.BILLING_DEV_UNLOCK || "true",
  BYPASS_SUBSCRIPTION_CHECK: process.env.BYPASS_SUBSCRIPTION_CHECK || "true",
  GOOGLE_OAUTH_REDIRECT_URI:
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${apiOrigin}/auth/google/callback`,
  STRIPE_SUCCESS_URL:
    process.env.STRIPE_SUCCESS_URL ||
    `${hudOrigin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  STRIPE_CANCEL_URL:
    process.env.STRIPE_CANCEL_URL || `${hudOrigin}/?checkout=cancel`,
};

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const hudEnv = {
  ...process.env,
  AETHER_HUD_PORT: String(hudPort),
  AETHER_API_ORIGIN: apiOrigin,
  AETHER_API_PORT: String(apiPort),
  VITE_API_PROXY_TARGET: apiOrigin,
  VITE_DEV_UNLOCK: process.env.VITE_DEV_UNLOCK || "true",
};

const api = spawnLogged(
  python,
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(apiPort),
    "--reload",
  ],
  path.join(root, "backend"),
  apiEnv,
  "api",
);

const hud = spawnLogged(
  npmCmd,
  [
    "run",
    "dev",
    "--",
    "--port",
    String(hudPort),
    "--host",
    "127.0.0.1",
    "--strictPort",
  ],
  path.join(root, "client"),
  hudEnv,
  "hud",
);

function shutdown(signal) {
  for (const child of [api, hud]) {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        /* ignore */
      }
    }
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});

await new Promise(() => {});