/** InfinitePay order tracking — memory + optional Neon for serverless poll. */

export type InfinitePayOrderRecord = {
  order_nsu: string;
  tier: string;
  sessionId: string;
  amountCentavos: number;
  status: "created" | "paid" | "failed";
  url?: string;
  simulated?: boolean;
  paidAt?: number;
  transaction_nsu?: string;
  slug?: string;
  createdAt: number;
};

type GlobalStore = typeof globalThis & {
  __infinitepayOrders?: Map<string, InfinitePayOrderRecord>;
  __infinitepayWebhookSeen?: Set<string>;
  __infinitepayTableReady?: boolean;
};

const g = globalThis as GlobalStore;

function orders(): Map<string, InfinitePayOrderRecord> {
  if (!g.__infinitepayOrders) g.__infinitepayOrders = new Map();
  return g.__infinitepayOrders;
}

function webhookSeen(): Set<string> {
  if (!g.__infinitepayWebhookSeen) g.__infinitepayWebhookSeen = new Set();
  return g.__infinitepayWebhookSeen;
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
    console.error("[infinitepay] Neon query failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function ensureTable(): Promise<void> {
  if (!postgresUrl() || g.__infinitepayTableReady) return;
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS infinitepay_orders (
      order_nsu TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  g.__infinitepayTableReady = true;
}

function fromPayload(raw: unknown): InfinitePayOrderRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.order_nsu !== "string") return null;
  return p as unknown as InfinitePayOrderRecord;
}

export function putInfinitePayOrder(record: InfinitePayOrderRecord): void {
  orders().set(record.order_nsu, record);
  void persistOrder(record);
}

export async function putInfinitePayOrderAsync(
  record: InfinitePayOrderRecord,
): Promise<void> {
  orders().set(record.order_nsu, record);
  await persistOrder(record);
}

async function persistOrder(record: InfinitePayOrderRecord): Promise<void> {
  if (!postgresUrl()) return;
  await ensureTable();
  await pgQuery(
    `INSERT INTO infinitepay_orders (order_nsu, payload, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (order_nsu) DO UPDATE
     SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [record.order_nsu, JSON.stringify(record)],
  );
}

export function getInfinitePayOrder(
  orderNsu: string,
): InfinitePayOrderRecord | undefined {
  return orders().get(orderNsu);
}

export async function getInfinitePayOrderAsync(
  orderNsu: string,
): Promise<InfinitePayOrderRecord | undefined> {
  const mem = orders().get(orderNsu);
  if (mem) return mem;
  if (!postgresUrl()) return undefined;
  await ensureTable();
  const rows = await pgQuery<{ payload: unknown }>(
    `SELECT payload FROM infinitepay_orders WHERE order_nsu = $1 LIMIT 1`,
    [orderNsu],
  );
  const parsed = fromPayload(rows[0]?.payload);
  if (parsed) {
    orders().set(orderNsu, parsed);
    return parsed;
  }
  return undefined;
}

export function markInfinitePayPaid(
  orderNsu: string,
  extras?: { transaction_nsu?: string; slug?: string },
): InfinitePayOrderRecord | null {
  const existing = orders().get(orderNsu);
  if (!existing) return null;
  const next: InfinitePayOrderRecord = {
    ...existing,
    status: "paid",
    paidAt: Date.now(),
    transaction_nsu: extras?.transaction_nsu ?? existing.transaction_nsu,
    slug: extras?.slug ?? existing.slug,
  };
  orders().set(orderNsu, next);
  void persistOrder(next);
  return next;
}

export async function markInfinitePayPaidAsync(
  orderNsu: string,
  extras?: { transaction_nsu?: string; slug?: string },
): Promise<InfinitePayOrderRecord | null> {
  let existing = orders().get(orderNsu);
  if (!existing) {
    existing = await getInfinitePayOrderAsync(orderNsu);
  }
  if (!existing) {
    // Webhook may arrive before create-link memory is warm — synthesize paid shell.
    const shell: InfinitePayOrderRecord = {
      order_nsu: orderNsu,
      tier: orderNsu.split("__")[1] ?? "unknown",
      sessionId: orderNsu.split("__")[0] ?? "webhook",
      amountCentavos: 0,
      status: "paid",
      paidAt: Date.now(),
      transaction_nsu: extras?.transaction_nsu,
      slug: extras?.slug,
      createdAt: Date.now(),
    };
    orders().set(orderNsu, shell);
    await persistOrder(shell);
    return shell;
  }
  const next: InfinitePayOrderRecord = {
    ...existing,
    status: "paid",
    paidAt: Date.now(),
    transaction_nsu: extras?.transaction_nsu ?? existing.transaction_nsu,
    slug: extras?.slug ?? existing.slug,
  };
  orders().set(orderNsu, next);
  await persistOrder(next);
  return next;
}

/** Returns true if this webhook key was already processed. */
export function claimWebhookIdempotency(key: string): boolean {
  const seen = webhookSeen();
  if (seen.has(key)) return true;
  seen.add(key);
  if (seen.size > 5000) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return false;
}
