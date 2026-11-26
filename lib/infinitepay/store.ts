/** In-memory idempotency + order tracking for InfinitePay (dev / single-instance). */

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

export function putInfinitePayOrder(record: InfinitePayOrderRecord): void {
  orders().set(record.order_nsu, record);
}

export function getInfinitePayOrder(
  orderNsu: string,
): InfinitePayOrderRecord | undefined {
  return orders().get(orderNsu);
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
  return next;
}

/** Returns true if this webhook key was already processed. */
export function claimWebhookIdempotency(key: string): boolean {
  const seen = webhookSeen();
  if (seen.has(key)) return true;
  seen.add(key);
  // soft cap to avoid unbounded growth in long-lived processes
  if (seen.size > 5000) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return false;
}
