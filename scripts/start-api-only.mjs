#!/usr/bin/env node
/**
 * FastAPI-only launcher with port isolation (never kills foreign listeners).
 * Preferred PORT: AETHER_API_PORT / backend .env PORT / 8001.
 */
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");
const DEFAULT_PORT = 8001;
const MAX_SCAN = 40;

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

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

async function nextFreePort(start) {
  for (let port = start; port < start + MAX_SCAN; port += 1) {
    if (await canBind(port)) return port;
  }
  throw new Error(
    `No free TCP port in ${start}..${start + MAX_SCAN - 1}. Refusing to kill other processes.`,
  );
}

const fileEnv = parseEnvFile(path.join(backend, ".env"));
const preferredRaw =
  process.env.AETHER_API_PORT ||
  process.env.PORT ||
  fileEnv.PORT ||
  String(DEFAULT_PORT);
const preferred = Number.parseInt(preferredRaw, 10);
if (!Number.isFinite(preferred) || preferred < 1 || preferred > 65535) {
  throw new Error(`Invalid API PORT "${preferredRaw}"`);
}

const port = await nextFreePort(preferred);
const origin = `http://127.0.0.1:${port}`;

if (port !== preferred) {
  console.warn(
    `[aether-api] Port ${preferred} busy — using next free ${port} (did not kill other processes).`,
  );
} else {
  console.log(`[aether-api] Dedicated API port ${port} is free.`);
}
console.log(`[aether-api] URL: ${origin}`);
console.log(`[aether-api] Health: ${origin}/health`);

const pyWin = path.join(backend, ".venv", "Scripts", "python.exe");
const pyUnix = path.join(backend, ".venv", "bin", "python");
const python = existsSync(pyWin) ? pyWin : existsSync(pyUnix) ? pyUnix : "python";

const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--reload",
  ],
  {
    cwd: backend,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      BILLING_DEV_UNLOCK: process.env.BILLING_DEV_UNLOCK || "true",
      BYPASS_SUBSCRIPTION_CHECK:
        process.env.BYPASS_SUBSCRIPTION_CHECK || "true",
      GOOGLE_OAUTH_REDIRECT_URI:
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        `${origin}/auth/google/callback`,
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}