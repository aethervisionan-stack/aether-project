/**
 * Optional nut-js desktop companion.
 * Env: AETHER_BRIDGE_HTTP, AETHER_OS_BRIDGE_TOKEN (never paste secrets).
 */
import { mouse, keyboard, Button, Point } from "@nut-tree-fork/nut-js";

const HTTP = (process.env.AETHER_BRIDGE_HTTP || "http://127.0.0.1:8000").replace(/\/$/, "");
const TOKEN = process.env.AETHER_OS_BRIDGE_TOKEN || "";

async function bridgeFetch(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${HTTP}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, confirmed: true }),
  });
  return res.json();
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help") {
    console.log("Usage: status | click <x> <y> | type <text> | capture");
    process.exit(0);
  }
  if (cmd === "status") {
    const headers = {};
    if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
    const res = await fetch(`${HTTP}/tools/os-bridge/status`, { headers });
    console.log(JSON.stringify(await res.json(), null, 2));
    return;
  }
  if (cmd === "click") {
    const x = Number(rest[0]);
    const y = Number(rest[1]);
    const gate = await bridgeFetch("/tools/os-bridge/mouse", { mode: "click", x, y, button: "left" });
    if (gate.status === "pending_confirmation") {
      console.error("pending confirmation", gate);
      process.exit(2);
    }
    if (!gate.ok) {
      await mouse.setPosition(new Point(x, y));
      await mouse.click(Button.LEFT);
      console.log(JSON.stringify({ ok: true, via: "nut-js", x, y }));
      return;
    }
    console.log(JSON.stringify(gate));
    return;
  }
  if (cmd === "type") {
    const text = rest.join(" ");
    const gate = await bridgeFetch("/tools/os-bridge/keyboard", { mode: "type", text });
    if (gate.status === "pending_confirmation") {
      console.error("pending confirmation", gate);
      process.exit(2);
    }
    if (!gate.ok) {
      await keyboard.type(text);
      console.log(JSON.stringify({ ok: true, via: "nut-js", length: text.length }));
      return;
    }
    console.log(JSON.stringify(gate));
    return;
  }
  if (cmd === "capture") {
    const gate = await bridgeFetch("/tools/os-bridge/desktop-capture", { max_width: 1280 });
    console.log(JSON.stringify({ ...gate, data: { ...(gate.data || {}), image_base64: gate?.data?.image_base64 ? "[omitted]" : null } }));
    return;
  }
  console.error("unknown command", cmd);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
