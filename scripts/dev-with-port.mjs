/**
 * Multi-project-safe local Next.js launcher for aether-project.
 * Prefers PORT from env / .env.local (default 3010). If busy, picks the next free
 * port — never kills other listeners.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const DEFAULT_PORT = 3010;
const MAX_SCAN = 40;

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
    // eslint-disable-next-line no-await-in-loop
    if (await canBind(port)) return port;
  }
  throw new Error(
    `No free TCP port in ${start}..${start + MAX_SCAN - 1}. Refusing to kill other processes.`,
  );
}

const fileEnv = {
  ...parseEnvFile(join(root, ".env")),
  ...parseEnvFile(join(root, ".env.local")),
};

const preferredRaw = process.env.PORT || fileEnv.PORT || String(DEFAULT_PORT);
const preferred = Number.parseInt(preferredRaw, 10);
if (!Number.isFinite(preferred) || preferred < 1 || preferred > 65535) {
  throw new Error(`Invalid PORT "${preferredRaw}"`);
}

const port = await nextFreePort(preferred);
const url = `http://localhost:${port}`;

if (port !== preferred) {
  console.warn(
    `[aether-project] Port ${preferred} busy — using next free ${port} (did not kill other processes).`,
  );
} else {
  console.log(`[aether-project] Dedicated local port ${port} is free.`);
}

const appUrlFromEnv =
  process.env.NEXT_PUBLIC_APP_URL || fileEnv.NEXT_PUBLIC_APP_URL || "";
const syncedAppUrl =
  !appUrlFromEnv || /localhost:\d+/i.test(appUrlFromEnv)
    ? url
    : appUrlFromEnv.replace(/\/$/, "");

if (syncedAppUrl !== appUrlFromEnv) {
  console.log(
    `[aether-project] NEXT_PUBLIC_APP_URL → ${syncedAppUrl} (local sync for this run)`,
  );
}

console.log(`[aether-project] Dev server URL: ${url}`);

const nextCli = join(root, "node_modules", "next", "dist", "bin", "next");
const args = existsSync(nextCli)
  ? [nextCli, "dev", "--turbopack", "-p", String(port)]
  : ["next", "dev", "--turbopack", "-p", String(port)];
const command = existsSync(nextCli)
  ? process.execPath
  : process.platform === "win32"
    ? "npx.cmd"
    : "npx";

const child = spawn(command, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port),
    NEXT_PUBLIC_APP_URL: syncedAppUrl,
  },
  shell: command.endsWith(".cmd"),
});

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
