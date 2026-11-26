/** Client helpers for IQ InfinitePay Pix unlock — never treat localStorage as authority. */

export function createIqSessionId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `iq_${rand}`;
}

export type IqPixCreateResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  amountCentavos: number;
  amountLabel: string;
  simulated?: boolean;
  emvResolved?: boolean;
  checkoutUrl?: string | null;
  code?: string;
  notice?: string | null;
  canSimApprove?: boolean;
};

export async function createIqPixPayment(
  sessionId: string,
): Promise<IqPixCreateResult> {
  const res = await fetch("/api/payment/pix/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    paymentId?: string;
    qrCode?: string;
    qrCodeBase64?: string;
    expiresAt?: string;
    amountCentavos?: number;
    amountLabel?: string;
    simulated?: boolean;
    emvResolved?: boolean;
    checkoutUrl?: string | null;
    code?: string;
    notice?: string | null;
    canSimApprove?: boolean;
    error?: string;
  };
  const hasEmv = typeof data.qrCode === "string" && data.qrCode.startsWith("000201");
  const hasCheckout =
    typeof data.checkoutUrl === "string" && /^https?:\/\//i.test(data.checkoutUrl);
  // Accept real EMV, InfinitePay checkout-only, or honest simulation (no fake bank QR).
  if (!res.ok || !data.paymentId || !(hasEmv || hasCheckout || data.simulated)) {
    throw new Error(
      data.error ||
        data.notice ||
        "Não foi possível gerar o Pix. Tente de novo — sua sessão permanece salva.",
    );
  }
  return {
    paymentId: data.paymentId,
    qrCode: hasEmv ? data.qrCode! : "",
    qrCodeBase64: data.qrCodeBase64 || "",
    expiresAt: data.expiresAt || new Date(Date.now() + 30 * 60_000).toISOString(),
    amountCentavos:
      typeof data.amountCentavos === "number" ? data.amountCentavos : 100,
    amountLabel:
      typeof data.amountLabel === "string" ? data.amountLabel : "R$ 1,00",
    simulated: data.simulated,
    emvResolved: Boolean(data.emvResolved && hasEmv),
    checkoutUrl: hasCheckout ? data.checkoutUrl : null,
    code: typeof data.code === "string" ? data.code : undefined,
    notice: typeof data.notice === "string" ? data.notice : null,
    canSimApprove: Boolean(data.canSimApprove ?? data.simulated),
  };
}

export async function fetchIqUnlockStatus(
  sessionId: string,
  opts: { simApprove?: boolean } = {},
): Promise<{
  unlocked: boolean;
  amountCentavos: number;
  amountLabel: string;
  paymentId: string | null;
  order_nsu: string | null;
  canSimApprove?: boolean;
  simulated?: boolean;
  error?: string;
}> {
  const qs = new URLSearchParams({ sessionId });
  if (opts.simApprove) qs.set("simApprove", "1");
  const res = await fetch(`/api/payment/pix/status?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    unlocked?: boolean;
    amountCentavos?: number;
    amountLabel?: string;
    paymentId?: string | null;
    order_nsu?: string | null;
    canSimApprove?: boolean;
    simulated?: boolean;
    error?: string;
  };
  return {
    unlocked: Boolean(data.unlocked),
    amountCentavos:
      typeof data.amountCentavos === "number" ? data.amountCentavos : 100,
    amountLabel:
      typeof data.amountLabel === "string" ? data.amountLabel : "R$ 1,00",
    paymentId: data.paymentId ?? data.order_nsu ?? null,
    order_nsu: data.order_nsu ?? data.paymentId ?? null,
    canSimApprove: Boolean(data.canSimApprove),
    simulated: Boolean(data.simulated),
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

/** @deprecated Redirect return flow removed — kept for type-safe gradual cleanup. */
export type IqPaymentReturnParams = {
  order_nsu: string;
  transaction_nsu: string | null;
  slug: string | null;
  simulated: boolean;
  session_id: string | null;
};

export function readIqPaymentReturnParams(
  _search = typeof window !== "undefined" ? window.location.search : "",
): IqPaymentReturnParams | null {
  // InfinitePay redirect return is no longer used for IQ unlock.
  return null;
}

export function cleanIqPaymentReturnUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const keys = [
      "payment_return",
      "order_nsu",
      "transaction_nsu",
      "slug",
      "simulated",
      "session_id",
      "capture_method",
    ];
    let changed = false;
    for (const k of keys) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        changed = true;
      }
    }
    if (changed) {
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  } catch {
    // ignore
  }
}
