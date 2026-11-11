/**
 * Cloud session + HUD sync client.
 *
 * Uses Vite `/api` → FastAPI `/cloud/*`. Optional Supabase Realtime WS when
 * VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set; otherwise HTTP poll.
 * Empty env keeps local-only MemoryStore working.
 */

import { loadSubscriberId } from "./BillingService";

const DEVICE_KEY = "aether.cloud.device_id";
const USER_KEY = "aether.cloud.user_id";
const HUD_POLL_MS = 2_500;

export interface CloudStatus {
  enabled: boolean;
  supabase: {
    configured: boolean;
    auth: boolean;
    session_sync: boolean;
    realtime_hud: boolean;
    url_host: string | null;
  };
  vector: {
    backend: string;
    configured: boolean;
    isolation: string;
    kinds: string[];
  };
  latency: {
    target_hud_ms: number;
    note: string;
  };
}

export interface CloudUserInfo {
  ok: boolean;
  user_id: string;
  email?: string | null;
  source?: string;
  channel?: string;
}

export interface CloudSessionResult {
  ok: boolean;
  source: string;
  user_id: string;
  session?: Record<string, unknown>;
  synced_at?: number | null;
}

function apiUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

function uuidLite(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadCloudDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const id = uuidLite();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "anonymous-device";
  }
}

/** Prefer explicit cloud user, then billing subscriber, else local. */
export function loadCloudUserId(): string {
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch {
    // ignore
  }
  const sub = loadSubscriberId();
  if (sub && sub.trim()) {
    return sub.trim();
  }
  return "local";
}

export function saveCloudUserId(userId: string): void {
  try {
    localStorage.setItem(USER_KEY, userId.trim());
  } catch {
    // ignore
  }
}

function cloudHeaders(userId?: string): Record<string, string> {
  const uid = (userId ?? loadCloudUserId()).trim() || "local";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Aether-User-Id": uid,
  };
  return headers;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchCloudStatus(): Promise<CloudStatus> {
  const res = await fetch(apiUrl("/cloud/status"));
  return readJson<CloudStatus>(res);
}

export async function fetchCloudMe(userId?: string): Promise<CloudUserInfo> {
  const uid = userId ?? loadCloudUserId();
  const q = new URLSearchParams({ user_id: uid });
  const res = await fetch(apiUrl(`/cloud/me?${q}`), {
    headers: cloudHeaders(uid),
  });
  return readJson<CloudUserInfo>(res);
}

export async function pullCloudSession(userId?: string): Promise<CloudSessionResult> {
  const uid = userId ?? loadCloudUserId();
  const q = new URLSearchParams({ user_id: uid });
  const res = await fetch(apiUrl(`/cloud/session?${q}`), {
    headers: cloudHeaders(uid),
  });
  return readJson<CloudSessionResult>(res);
}

export async function pushCloudSession(options: {
  preferences?: Record<string, unknown>;
  hud?: Record<string, unknown>;
  userId?: string;
  deviceId?: string;
}): Promise<CloudSessionResult> {
  const uid = options.userId ?? loadCloudUserId();
  const q = new URLSearchParams({ user_id: uid });
  const res = await fetch(apiUrl(`/cloud/session?${q}`), {
    method: "PUT",
    headers: cloudHeaders(uid),
    body: JSON.stringify({
      preferences: options.preferences ?? null,
      hud: options.hud ?? {},
      device_id: options.deviceId ?? loadCloudDeviceId(),
      merge_prefs: true,
    }),
  });
  return readJson<CloudSessionResult>(res);
}

export async function publishHudTelemetry(payload: Record<string, unknown>, userId?: string): Promise<void> {
  const uid = userId ?? loadCloudUserId();
  if (!uid || uid === "local") {
    return;
  }
  const q = new URLSearchParams({ user_id: uid });
  await fetch(apiUrl(`/cloud/hud?${q}`), {
    method: "POST",
    headers: cloudHeaders(uid),
    body: JSON.stringify({
      event_type: "hud_telemetry",
      payload,
      device_id: loadCloudDeviceId(),
    }),
  }).catch(() => undefined);
}

export async function fetchRecentHudEvents(
  userId?: string,
  limit = 20,
): Promise<{ ok: boolean; events: unknown[] }> {
  const uid = userId ?? loadCloudUserId();
  const q = new URLSearchParams({
    user_id: uid,
    limit: String(limit),
  });
  const res = await fetch(apiUrl(`/cloud/hud?${q}`), {
    headers: cloudHeaders(uid),
  });
  return readJson(res);
}

type HudHandler = (event: unknown) => void;

export class CloudSyncService {
  private pollTimer: number | null = null;
  private realtime: WebSocket | null = null;
  private stopped = true;
  private onHud: HudHandler | null = null;
  private lastEventAt = 0;

  start(options?: { onHudEvent?: HudHandler }): void {
    this.stopped = false;
    this.onHud = options?.onHudEvent ?? null;
    void this.bootstrap();
  }

  stop(): void {
    this.stopped = true;
    if (this.pollTimer != null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.realtime) {
      try {
        this.realtime.close();
      } catch {
        // ignore
      }
      this.realtime = null;
    }
  }

  /** Fire-and-forget HUD sample for cloud mirror / Realtime. */
  syncHudTelemetry(payload: Record<string, unknown>): void {
    void publishHudTelemetry(payload);
  }

  private async bootstrap(): Promise<void> {
    try {
      const me = await fetchCloudMe();
      if (me.user_id && me.user_id !== "local") {
        saveCloudUserId(me.user_id);
      }
      await pullCloudSession(me.user_id);
    } catch {
      // offline / unset — keep local
    }
    if (this.stopped) {
      return;
    }
    if (!this.tryRealtime()) {
      this.startPoll();
    }
  }

  private tryRealtime(): boolean {
    const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!url || !key) {
      return false;
    }
    const userId = loadCloudUserId();
    if (!userId || userId === "local") {
      return false;
    }
    try {
      const base = url.replace(/^http/i, "ws").replace(/\/$/, "");
      const channel = `hud:${userId}`;
      const wsUrl =
        `${base}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}` +
        `&vsn=1.0.0`;
      const ws = new WebSocket(wsUrl);
      this.realtime = ws;
      ws.onopen = () => {
        const joinRef = "1";
        ws.send(
          JSON.stringify({
            topic: `realtime:${channel}`,
            event: "phx_join",
            payload: { config: { broadcast: { self: false } } },
            ref: joinRef,
          }),
        );
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            event?: string;
            payload?: unknown;
          };
          if (msg.event && msg.event !== "phx_reply" && msg.event !== "phx_close") {
            this.lastEventAt = Date.now();
            this.onHud?.(msg.payload ?? msg);
          }
        } catch {
          // ignore malformed
        }
      };
      ws.onerror = () => {
        this.fallbackToPoll();
      };
      ws.onclose = () => {
        if (!this.stopped) {
          this.fallbackToPoll();
        }
      };
      // Safety net: if Realtime is quiet, still poll occasionally.
      this.pollTimer = window.setInterval(() => {
        if (Date.now() - this.lastEventAt > HUD_POLL_MS * 3) {
          void this.pollOnce();
        }
      }, HUD_POLL_MS * 2);
      return true;
    } catch {
      return false;
    }
  }

  private fallbackToPoll(): void {
    if (this.realtime) {
      try {
        this.realtime.close();
      } catch {
        // ignore
      }
      this.realtime = null;
    }
    this.startPoll();
  }

  private startPoll(): void {
    if (this.pollTimer != null) {
      return;
    }
    void this.pollOnce();
    this.pollTimer = window.setInterval(() => void this.pollOnce(), HUD_POLL_MS);
  }

  private async pollOnce(): Promise<void> {
    try {
      const res = await fetchRecentHudEvents(undefined, 8);
      const events = Array.isArray(res.events) ? res.events : [];
      for (const ev of events.slice(0, 3)) {
        this.onHud?.(ev);
      }
    } catch {
      // ignore transient poll errors
    }
  }
}

let singleton: CloudSyncService | null = null;

export function getCloudSync(): CloudSyncService {
  if (!singleton) {
    singleton = new CloudSyncService();
  }
  return singleton;
}
