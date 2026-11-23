export type PagbankOrderRecord = {
  orderId: string;
  status: "waiting" | "paid" | "declined" | "canceled";
  amountCentavos: number;
  pixCopyPaste: string;
  qrCodeImageUrl: string | null;
  mock: boolean;
  createdAt: number;
};

const g = globalThis as typeof globalThis & {
  __pagbankOrders?: Map<string, PagbankOrderRecord>;
};

function orders(): Map<string, PagbankOrderRecord> {
  if (!g.__pagbankOrders) g.__pagbankOrders = new Map();
  return g.__pagbankOrders;
}

export function putPagbankOrder(record: PagbankOrderRecord): void {
  orders().set(record.orderId, record);
}

export function getPagbankOrder(
  orderId: string,
): PagbankOrderRecord | undefined {
  return orders().get(orderId);
}

export function markPagbankOrderPaid(orderId: string): PagbankOrderRecord | null {
  const existing = orders().get(orderId);
  if (!existing) return null;
  const next = { ...existing, status: "paid" as const };
  orders().set(orderId, next);
  return next;
}
