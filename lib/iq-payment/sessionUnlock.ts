/**
 * Server-side IQ unlock registry keyed by sessionId.
 * Client localStorage / query alone cannot unlock — only paid/verified rows here.
 *
 * Two-tier flags on the same session:
 * - resultUnlocked (legacy `unlocked`) — full results, Hall of Fame, share
 * - aiUnlocked — Gemini profile assistant
 */

import type { IqUnlockItemType } from "@/lib/iq-payment/config";

export type { IqUnlockItemType };

export type IqUnlockRecord = {
  sessionId: string;
  /** Legacy alias of resultUnlocked — kept for older clients/rows. */
  unlocked: boolean;
  resultUnlocked: boolean;
  aiUnlocked: boolean;
  /** Item type of the latest pending/active checkout on this session. */
  itemType?: IqUnlockItemType;
  /** InfinitePay order_nsu / payment id (or sim_… locally) for latest checkout. */
  paymentId?: string;
  order_nsu?: string;
  amountCentavos: number;
  status: "pending" | "paid" | "failed";
  simulated?: boolean;
  paidAt?: number;
  transaction_nsu?: string;
  slug?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  expiresAt?: string;
  createdAt: number;
  updatedAt: number;
  resultPaymentId?: string;
  resultOrderNsu?: string;
  aiPaymentId?: string;
  aiOrderNsu?: string;
  /**
   * Completed quiz client state (results) so InfinitePay return tabs /
   * wiped localStorage can restore without dumping on landing.
   */
  quizSnapshot?: Record<string, unknown> | null;
};

type GlobalStore = typeof globalThis & {
  __iqUnlockSessions?: Map<string, IqUnlockRecord>;
  __iqUnlockByOrder?: Map<string, string>;
  __iqUnlockByPayment?: Map<string, string>;
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

function byPayment(): Map<string, string> {
  if (!g.__iqUnlockByPayment) g.__iqUnlockByPayment = new Map();
  return g.__iqUnlockByPayment;
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

/** Normalize legacy rows that only had `unlocked`. */
export function normalizeIqUnlockRecord(
  raw: Partial<IqUnlockRecord> & { sessionId: string },
): IqUnlockRecord {
  const resultUnlocked = Boolean(
    raw.resultUnlocked ?? raw.unlocked ?? false,
  );
  const aiUnlocked = Boolean(raw.aiUnlocked ?? false);
  const itemType: IqUnlockItemType =
    raw.itemType === "ai_upsell" ||
    raw.itemType === "result" ||
    raw.itemType === "combo"
      ? raw.itemType
      : "result";
  const quizSnapshot =
    raw.quizSnapshot &&
    typeof raw.quizSnapshot === "object" &&
    !Array.isArray(raw.quizSnapshot)
      ? (raw.quizSnapshot as Record<string, unknown>)
      : null;
  return {
    sessionId: raw.sessionId,
    unlocked: resultUnlocked,
    resultUnlocked,
    aiUnlocked,
    itemType,
    paymentId: raw.paymentId,
    order_nsu: raw.order_nsu,
    amountCentavos:
      typeof raw.amountCentavos === "number" ? raw.amountCentavos : 0,
    status: raw.status === "paid" || raw.status === "failed" ? raw.status : "pending",
    simulated: raw.simulated,
    paidAt: raw.paidAt,
    transaction_nsu: raw.transaction_nsu,
    slug: raw.slug,
    qrCode: raw.qrCode,
    qrCodeBase64: raw.qrCodeBase64,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
    resultPaymentId: raw.resultPaymentId,
    resultOrderNsu: raw.resultOrderNsu,
    aiPaymentId: raw.aiPaymentId,
    aiOrderNsu: raw.aiOrderNsu,
    quizSnapshot,
  };
}

function fromPayload(raw: unknown): IqUnlockRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.sessionId !== "string") return null;
  return normalizeIqUnlockRecord(
    p as unknown as Partial<IqUnlockRecord> & { sessionId: string },
  );
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
  record: IqUnlockRecord | (Partial<IqUnlockRecord> & { sessionId: string }),
): Promise<void> {
  let next = normalizeIqUnlockRecord(record);
  // Keep order_nsu aligned with paymentId for legacy callers / Hall of Fame keys.
  if (next.paymentId && !next.order_nsu) {
    next = { ...next, order_nsu: next.paymentId };
  }
  if (next.order_nsu && !next.paymentId) {
    next = { ...next, paymentId: next.order_nsu };
  }
  sessions().set(next.sessionId, next);
  if (next.order_nsu) {
    byOrder().set(next.order_nsu, next.sessionId);
  }
  if (next.paymentId) {
    byPayment().set(next.paymentId, next.sessionId);
  }
  if (next.resultOrderNsu) byOrder().set(next.resultOrderNsu, next.sessionId);
  if (next.aiOrderNsu) byOrder().set(next.aiOrderNsu, next.sessionId);
  if (next.resultPaymentId) byPayment().set(next.resultPaymentId, next.sessionId);
  if (next.aiPaymentId) byPayment().set(next.aiPaymentId, next.sessionId);
  await persist(next);
}

export async function getIqUnlockSession(
  sessionId: string,
): Promise<IqUnlockRecord | undefined> {
  const mem = sessions().get(sessionId);
  if (mem) return normalizeIqUnlockRecord(mem);
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
    if (parsed.paymentId) byPayment().set(parsed.paymentId, sessionId);
    return parsed;
  }
  return undefined;
}

export async function getIqUnlockByPaymentId(
  paymentId: string,
): Promise<IqUnlockRecord | undefined> {
  const sid = byPayment().get(paymentId);
  if (sid) return getIqUnlockSession(sid);
  for (const rec of sessions().values()) {
    if (
      rec.paymentId === paymentId ||
      rec.order_nsu === paymentId ||
      rec.resultPaymentId === paymentId ||
      rec.resultOrderNsu === paymentId ||
      rec.aiPaymentId === paymentId ||
      rec.aiOrderNsu === paymentId
    ) {
      return normalizeIqUnlockRecord(rec);
    }
  }
  if (!postgresUrl()) return undefined;
  await ensureTable();
  const rows = await pgQuery<{ payload: unknown }>(
    `SELECT payload FROM iq_unlock_sessions
     WHERE payload->>'paymentId' = $1 OR payload->>'order_nsu' = $1
        OR payload->>'resultPaymentId' = $1 OR payload->>'resultOrderNsu' = $1
        OR payload->>'aiPaymentId' = $1 OR payload->>'aiOrderNsu' = $1
     LIMIT 1`,
    [paymentId],
  );
  const parsed = fromPayload(rows[0]?.payload);
  if (parsed) {
    sessions().set(parsed.sessionId, parsed);
    if (parsed.order_nsu) byOrder().set(parsed.order_nsu, parsed.sessionId);
    if (parsed.paymentId) byPayment().set(parsed.paymentId, parsed.sessionId);
    return parsed;
  }
  return undefined;
}

export async function getIqUnlockByOrderNsu(
  orderNsu: string,
): Promise<IqUnlockRecord | undefined> {
  const sid = byOrder().get(orderNsu);
  if (sid) return getIqUnlockSession(sid);
  for (const rec of sessions().values()) {
    if (
      rec.order_nsu === orderNsu ||
      rec.paymentId === orderNsu ||
      rec.resultOrderNsu === orderNsu ||
      rec.aiOrderNsu === orderNsu
    ) {
      return normalizeIqUnlockRecord(rec);
    }
  }
  if (!postgresUrl()) return undefined;
  await ensureTable();
  const rows = await pgQuery<{ payload: unknown }>(
    `SELECT payload FROM iq_unlock_sessions
     WHERE payload->>'order_nsu' = $1 OR payload->>'paymentId' = $1
        OR payload->>'resultOrderNsu' = $1 OR payload->>'aiOrderNsu' = $1
     LIMIT 1`,
    [orderNsu],
  );
  const parsed = fromPayload(rows[0]?.payload);
  if (parsed) {
    sessions().set(parsed.sessionId, parsed);
    if (parsed.order_nsu) byOrder().set(parsed.order_nsu, parsed.sessionId);
    if (parsed.paymentId) byPayment().set(parsed.paymentId, parsed.sessionId);
    return parsed;
  }
  return undefined;
}

/** Stage-1: full results / Hall / share. */
export async function isIqSessionResultUnlocked(
  sessionId: string,
): Promise<boolean> {
  if (!sessionId.trim()) return false;
  const rec = await getIqUnlockSession(sessionId.trim());
  return Boolean(rec?.resultUnlocked);
}

/** @deprecated Prefer isIqSessionResultUnlocked — same meaning. */
export async function isIqSessionUnlocked(sessionId: string): Promise<boolean> {
  return isIqSessionResultUnlocked(sessionId);
}

/** Stage-2: Gemini assistant. */
export async function isIqSessionAiUnlocked(
  sessionId: string,
): Promise<boolean> {
  if (!sessionId.trim()) return false;
  const rec = await getIqUnlockSession(sessionId.trim());
  return Boolean(rec?.aiUnlocked);
}

export async function markIqSessionPaid(
  sessionId: string,
  extras?: {
    paymentId?: string;
    order_nsu?: string;
    transaction_nsu?: string;
    slug?: string;
    simulated?: boolean;
    amountCentavos?: number;
    itemType?: IqUnlockItemType;
  },
): Promise<IqUnlockRecord> {
  const now = Date.now();
  const existing = await getIqUnlockSession(sessionId);
  const orderHint = extras?.order_nsu ?? extras?.paymentId ?? existing?.order_nsu;
  const itemType: IqUnlockItemType =
    extras?.itemType ??
    (orderHint ? extractItemTypeFromOrderNsu(orderHint) : null) ??
    existing?.itemType ??
    "result";

  const paymentId =
    extras?.paymentId ??
    extras?.order_nsu ??
    existing?.paymentId ??
    existing?.order_nsu;
  const order_nsu = extras?.order_nsu ?? paymentId ?? existing?.order_nsu;

  const resultUnlocked =
    itemType === "result" || itemType === "combo"
      ? true
      : Boolean(existing?.resultUnlocked);
  const aiUnlocked =
    itemType === "ai_upsell" || itemType === "combo"
      ? true
      : Boolean(existing?.aiUnlocked);

  const next = normalizeIqUnlockRecord({
    sessionId,
    unlocked: resultUnlocked,
    resultUnlocked,
    aiUnlocked,
    itemType,
    status: "paid",
    paymentId,
    order_nsu,
    amountCentavos:
      extras?.amountCentavos ?? existing?.amountCentavos ?? 0,
    simulated: extras?.simulated ?? existing?.simulated,
    paidAt: now,
    transaction_nsu:
      extras?.transaction_nsu ?? existing?.transaction_nsu,
    slug: extras?.slug ?? existing?.slug,
    qrCode: existing?.qrCode,
    qrCodeBase64: existing?.qrCodeBase64,
    expiresAt: existing?.expiresAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    resultPaymentId:
      itemType === "result" || itemType === "combo"
        ? paymentId
        : existing?.resultPaymentId,
    resultOrderNsu:
      itemType === "result" || itemType === "combo"
        ? order_nsu
        : existing?.resultOrderNsu,
    aiPaymentId:
      itemType === "ai_upsell" || itemType === "combo"
        ? paymentId
        : existing?.aiPaymentId,
    aiOrderNsu:
      itemType === "ai_upsell" || itemType === "combo"
        ? order_nsu
        : existing?.aiOrderNsu,
    quizSnapshot: existing?.quizSnapshot ?? null,
  });
  await putIqUnlockSession(next);
  return next;
}

/**
 * Start / refresh a pending checkout without wiping existing unlock flags.
 */
export async function beginIqUnlockCheckout(
  input: {
    sessionId: string;
    itemType: IqUnlockItemType;
    paymentId: string;
    order_nsu: string;
    amountCentavos: number;
    simulated?: boolean;
    qrCode?: string;
    qrCodeBase64?: string;
    expiresAt?: string;
  },
): Promise<IqUnlockRecord> {
  const now = Date.now();
  const existing = await getIqUnlockSession(input.sessionId);
  const resultUnlocked = Boolean(existing?.resultUnlocked);
  const aiUnlocked = Boolean(existing?.aiUnlocked);
  const next = normalizeIqUnlockRecord({
    sessionId: input.sessionId,
    unlocked: resultUnlocked,
    resultUnlocked,
    aiUnlocked,
    itemType: input.itemType,
    paymentId: input.paymentId,
    order_nsu: input.order_nsu,
    amountCentavos: input.amountCentavos,
    status:
      resultUnlocked || aiUnlocked
        ? existing?.status === "paid"
          ? "paid"
          : "pending"
        : "pending",
    simulated: input.simulated,
    paidAt: existing?.paidAt,
    transaction_nsu: existing?.transaction_nsu,
    slug: existing?.slug,
    qrCode: input.qrCode,
    qrCodeBase64: input.qrCodeBase64,
    expiresAt: input.expiresAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    resultPaymentId: existing?.resultPaymentId,
    resultOrderNsu: existing?.resultOrderNsu,
    aiPaymentId: existing?.aiPaymentId,
    aiOrderNsu: existing?.aiOrderNsu,
    quizSnapshot: existing?.quizSnapshot ?? null,
  });
  await putIqUnlockSession(next);
  return next;
}

/**
 * Persist completed quiz client state for payment-return restore
 * (InfinitePay often opens/returns in a tab that lost localStorage).
 */
export async function saveIqQuizSnapshot(
  sessionId: string,
  snapshot: Record<string, unknown>,
): Promise<IqUnlockRecord> {
  const now = Date.now();
  const existing = await getIqUnlockSession(sessionId);
  const next = normalizeIqUnlockRecord({
    sessionId,
    unlocked: Boolean(existing?.resultUnlocked),
    resultUnlocked: Boolean(existing?.resultUnlocked),
    aiUnlocked: Boolean(existing?.aiUnlocked),
    itemType: existing?.itemType ?? "result",
    paymentId: existing?.paymentId,
    order_nsu: existing?.order_nsu,
    amountCentavos: existing?.amountCentavos ?? 0,
    status: existing?.status ?? "pending",
    simulated: existing?.simulated,
    paidAt: existing?.paidAt,
    transaction_nsu: existing?.transaction_nsu,
    slug: existing?.slug,
    qrCode: existing?.qrCode,
    qrCodeBase64: existing?.qrCodeBase64,
    expiresAt: existing?.expiresAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    resultPaymentId: existing?.resultPaymentId,
    resultOrderNsu: existing?.resultOrderNsu,
    aiPaymentId: existing?.aiPaymentId,
    aiOrderNsu: existing?.aiOrderNsu,
    quizSnapshot: snapshot,
  });
  await putIqUnlockSession(next);
  return next;
}

export async function getIqQuizSnapshot(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const rec = await getIqUnlockSession(sessionId);
  return rec?.quizSnapshot ?? null;
}

export function extractSessionIdFromOrderNsu(
  orderNsu: string | null | undefined,
): string | null {
  if (!orderNsu || typeof orderNsu !== "string") return null;
  // Formats:
  //   iq__${sessionId}__${timestamp}
  //   iq__${sessionId}__${itemType}__${timestamp}
  const parts = orderNsu.split("__");
  if (parts.length >= 3 && parts[0] === "iq") {
    return parts[1] || null;
  }
  // Fallback: first segment if it looks like an iq session id
  if (parts[0]?.startsWith("iq_")) return parts[0];
  return null;
}

/**
 * True when `orderNsu` is safe to apply to `sessionId`.
 * Prevents forged payment_return / status polls from unlocking a different
 * session with someone else's paid order_nsu.
 *
 * Accepts: encoded session match, registry byOrder map, or the session's own
 * pending/paid order fields (result/ai/latest).
 */
export async function orderBelongsToIqSession(
  sessionId: string,
  orderNsu: string | null | undefined,
): Promise<boolean> {
  if (!sessionId?.trim() || !orderNsu?.trim()) return false;
  const sid = sessionId.trim();
  const order = orderNsu.trim();

  const encoded = extractSessionIdFromOrderNsu(order);
  if (encoded && encoded === sid) return true;

  const mapped = await getIqUnlockByOrderNsu(order);
  if (mapped?.sessionId === sid) return true;

  const rec = await getIqUnlockSession(sid);
  if (!rec) return false;
  return (
    rec.order_nsu === order ||
    rec.paymentId === order ||
    rec.resultOrderNsu === order ||
    rec.resultPaymentId === order ||
    rec.aiOrderNsu === order ||
    rec.aiPaymentId === order
  );
}

export function extractItemTypeFromOrderNsu(
  orderNsu: string | null | undefined,
): IqUnlockItemType | null {
  if (!orderNsu || typeof orderNsu !== "string") return null;
  const parts = orderNsu.split("__");
  if (parts.length >= 4 && parts[0] === "iq") {
    if (
      parts[2] === "result" ||
      parts[2] === "ai_upsell" ||
      parts[2] === "combo"
    ) {
      return parts[2];
    }
  }
  // Legacy orders without itemType → result unlock
  if (parts.length >= 3 && parts[0] === "iq") return "result";
  return null;
}

export function buildIqOrderNsu(
  sessionId: string,
  itemType: IqUnlockItemType,
  now = Date.now(),
): string {
  return `iq__${sessionId}__${itemType}__${now}`;
}
