/**
 * Server-side IQ unlock registry keyed by sessionId.
 * Client localStorage / query alone cannot unlock — only paid/verified rows here.
 */

export type IqUnlockRecord = {
  sessionId: string;
  unlocked: boolean;
  order_nsu?: string;
  amountCentavos: number;
  status: "pending" | "paid" | "failed";
  simulated?: boolean;
  paidAt?: number;
  transaction_nsu?: string;
  slug?: string;
  createdAt: number;
  updatedAt: number;
};

type GlobalStore = typeof globalThis & {
  __iqUnlockSessions?: Map<string, IqUnlockRecord>;
  __iqUnlockByOrder?: Map<string, string>;
  __iqUnlockTableReady?: boolean;
};

const g = globalThis as GlobalStore;

function sessions(): Map<string, IqUnlockRecord> {
  if (!g.__iqUnlockSessions) g.__iqUnlockSessions = new Map();
  return g.__iqUnlockSessions;
}

function byOrder(): Map<string, string> {
  if (!g.__iqUnlockByOrder) g.__iqUnlockByOrder = new Map();
  return g.__iqUnlockByOrder;
}

function postgresUrl(): string | null {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  let url = raw.replace(/^['"]+|['"]+$/g, "").trim();
  if (!url) return null;
  if (/^postgres:\/\//i.test(url)) {
    url = `postgresql://${url.slice("postgres://".length)}`;
  }
  if (!/^postgresql:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.get("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function pgQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const url = postgresUrl();
  if (!url) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sqlFn = neon(url);
    const rows = await sqlFn.query(sql, params);
    return rows as T[];
  } catch (error) {
    console.error("[iq-unlock] Neon query failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function ensureTable(): Promise<void> {
  if (!postgresUrl() || g.__iqUnlockTableReady) return;
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS iq_unlock_sessions (
      session_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  g.__iqUnlockTableReady = true;
}

function fromPayload(raw: unknown): IqUnlockRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.sessionId !== "string") return null;
  return p as unknown as IqUnlockRecord;
}

async function persist(record: IqUnlockRecord): Promise<void> {
  if (!postgresUrl()) return;
  await ensureTable();
  await pgQuery(
    `INSERT INTO iq_unlock_sessions (session_id, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (session_id) DO UPDATE
     SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [record.sessionId, JSON.stringify(record)],
  );
}

export async function putIqUnlockSession(
  record: IqUnlockRecord,
): Promise<void> {
  sessions().set(record.sessionId, record);
  if (record.order_nsu) {
    byOrder().set(record.order_nsu, record.sessionId);
  }
  await persist(record);
}

export async function getIqUnlockSession(
  sessionId: string,
): Promise<IqUnlockRecord | undefined> {
  const mem = sessions().get(sessionId);
  if (mem) return mem;
  if (!postgresUrl()) return undefined;
  await ensureTable();
  const rows = await pgQuery<{ payload: unknown }>(
    `SELECT payload FROM iq_unlock_sessions WHERE session_id = $1 LIMIT 1`,
    [sessionId],
  );
  const parsed = fromPayload(rows[0]?.payload);
  if (parsed) {
    sessions().set(sessionId, parsed);
    if (parsed.order_nsu) byOrder().set(parsed.order_nsu, sessionId);
    return parsed;
  }
  return undefined;
}

export async function getIqUnlockByOrderNsu(
  orderNsu: string,
): Promise<IqUnlockRecord | undefined> {
  const sid = byOrder().get(orderNsu);
  if (sid) return getIqUnlockSession(sid);
  // Scan memory
  for (const rec of sessions().values()) {
    if (rec.order_nsu === orderNsu) return rec;
  }
  if (!postgresUrl()) return undefined;
  await ensureTable();
  const rows = await pgQuery<{ payload: unknown }>(
    `SELECT payload FROM iq_unlock_sessions
     WHERE payload->>'order_nsu' = $1
     LIMIT 1`,
    [orderNsu],
  );
  const parsed = fromPayload(rows[0]?.payload);
  if (parsed) {
    sessions().set(parsed.sessionId, parsed);
    if (parsed.order_nsu) byOrder().set(parsed.order_nsu, parsed.sessionId);
    return parsed;
  }
  return undefined;
}

export async function isIqSessionUnlocked(sessionId: string): Promise<boolean> {
  if (!sessionId.trim()) return false;
  const rec = await getIqUnlockSession(sessionId.trim());
  return Boolean(rec?.unlocked && rec.status === "paid");
}

export async function markIqSessionPaid(
  sessionId: string,
  extras?: {
    order_nsu?: string;
    transaction_nsu?: string;
    slug?: string;
    simulated?: boolean;
    amountCentavos?: number;
  },
): Promise<IqUnlockRecord> {
  const now = Date.now();
  const existing = await getIqUnlockSession(sessionId);
  const next: IqUnlockRecord = {
    sessionId,
    unlocked: true,
    status: "paid",
    order_nsu: extras?.order_nsu ?? existing?.order_nsu,
    amountCentavos:
      extras?.amountCentavos ?? existing?.amountCentavos ?? 0,
    simulated: extras?.simulated ?? existing?.simulated,
    paidAt: now,
    transaction_nsu:
      extras?.transaction_nsu ?? existing?.transaction_nsu,
    slug: extras?.slug ?? existing?.slug,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await putIqUnlockSession(next);
  return next;
}

export function extractSessionIdFromOrderNsu(
  orderNsu: string | null | undefined,
): string | null {
  if (!orderNsu || typeof orderNsu !== "string") return null;
  // Format: iq__${sessionId}__${timestamp}
  const parts = orderNsu.split("__");
  if (parts.length >= 3 && parts[0] === "iq") {
    return parts[1] || null;
  }
  // Fallback: first segment if it looks like an iq session id
  if (parts[0]?.startsWith("iq_")) return parts[0];
  return null;
}
