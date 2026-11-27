/** Client helpers for IQ InfinitePay Pix unlock — never treat localStorage as authority. */

export type IqUnlockItemType = "result" | "ai_upsell" | "combo";

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
  itemType: IqUnlockItemType;
  simulated?: boolean;
  emvResolved?: boolean;
  checkoutUrl?: string | null;
  code?: string;
  notice?: string | null;
  canSimApprove?: boolean;
  alreadyUnlocked?: boolean;
  resultUnlocked?: boolean;
  aiUnlocked?: boolean;
};

export async function createIqPixPayment(
  sessionId: string,
  opts: { itemType?: IqUnlockItemType; includeAi?: boolean } = {},
): Promise<IqPixCreateResult> {
  const itemType: IqUnlockItemType =
    opts.includeAi && (!opts.itemType || opts.itemType === "result")
      ? "combo"
      : (opts.itemType ?? "result");
  const res = await fetch("/api/payment/pix/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      itemType,
      includeAi: Boolean(opts.includeAi || itemType === "combo"),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    paymentId?: string;
    qrCode?: string;
    qrCodeBase64?: string;
    expiresAt?: string;
    amountCentavos?: number;
    amountLabel?: string;
    itemType?: IqUnlockItemType;
    simulated?: boolean;
    emvResolved?: boolean;
    checkoutUrl?: string | null;
    code?: string;
    notice?: string | null;
    canSimApprove?: boolean;
    alreadyUnlocked?: boolean;
    resultUnlocked?: boolean;
    aiUnlocked?: boolean;
    unlocked?: boolean;
    error?: string;
  };

  if (data.alreadyUnlocked) {
    return {
      paymentId: data.paymentId || `already_${itemType}`,
      qrCode: "",
      qrCodeBase64: "",
      expiresAt: new Date().toISOString(),
      amountCentavos:
        typeof data.amountCentavos === "number" ? data.amountCentavos : 100,
      amountLabel:
        typeof data.amountLabel === "string" ? data.amountLabel : "R$ 1,00",
      itemType: data.itemType ?? itemType,
      alreadyUnlocked: true,
      resultUnlocked: Boolean(data.resultUnlocked ?? data.unlocked),
      aiUnlocked: Boolean(data.aiUnlocked),
      canSimApprove: false,
    };
  }

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
    itemType: data.itemType ?? itemType,
    simulated: data.simulated,
    emvResolved: Boolean(data.emvResolved && hasEmv),
    checkoutUrl: hasCheckout ? data.checkoutUrl : null,
    code: typeof data.code === "string" ? data.code : undefined,
    notice: typeof data.notice === "string" ? data.notice : null,
    canSimApprove: Boolean(data.canSimApprove ?? data.simulated),
    resultUnlocked: Boolean(data.resultUnlocked ?? data.unlocked),
    aiUnlocked: Boolean(data.aiUnlocked),
  };
}

export type IqUnlockStatus = {
  unlocked: boolean;
  resultUnlocked: boolean;
  aiUnlocked: boolean;
  itemType?: IqUnlockItemType;
  amountCentavos: number;
  amountLabel: string;
  resultAmountCentavos?: number;
  resultAmountLabel?: string;
  aiAmountCentavos?: number;
  aiAmountLabel?: string;
  comboAmountCentavos?: number;
  comboAmountLabel?: string;
  paymentId: string | null;
  order_nsu: string | null;
  canSimApprove?: boolean;
  simulated?: boolean;
  error?: string;
};

export type IqStatusPollHints = {
  simApprove?: boolean;
  itemType?: IqUnlockItemType;
  order_nsu?: string | null;
  transaction_nsu?: string | null;
  slug?: string | null;
  simulated?: boolean;
};

function mapStatusPayload(data: {
  unlocked?: boolean;
  resultUnlocked?: boolean;
  aiUnlocked?: boolean;
  itemType?: IqUnlockItemType;
  amountCentavos?: number;
  amountLabel?: string;
  resultAmountCentavos?: number;
  resultAmountLabel?: string;
  aiAmountCentavos?: number;
  aiAmountLabel?: string;
  comboAmountCentavos?: number;
  comboAmountLabel?: string;
  paymentId?: string | null;
  order_nsu?: string | null;
  canSimApprove?: boolean;
  simulated?: boolean;
  error?: string;
}): IqUnlockStatus {
  const resultUnlocked = Boolean(
    data.resultUnlocked ?? data.unlocked ?? false,
  );
  return {
    unlocked: resultUnlocked,
    resultUnlocked,
    aiUnlocked: Boolean(data.aiUnlocked),
    itemType: data.itemType,
    amountCentavos:
      typeof data.amountCentavos === "number" ? data.amountCentavos : 100,
    amountLabel:
      typeof data.amountLabel === "string" ? data.amountLabel : "R$ 1,00",
    resultAmountCentavos: data.resultAmountCentavos,
    resultAmountLabel: data.resultAmountLabel,
    aiAmountCentavos: data.aiAmountCentavos,
    aiAmountLabel: data.aiAmountLabel,
    comboAmountCentavos: data.comboAmountCentavos,
    comboAmountLabel: data.comboAmountLabel,
    paymentId: data.paymentId ?? data.order_nsu ?? null,
    order_nsu: data.order_nsu ?? data.paymentId ?? null,
    canSimApprove: Boolean(data.canSimApprove),
    simulated: Boolean(data.simulated),
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

export async function fetchIqUnlockStatus(
  sessionId: string,
  opts: IqStatusPollHints = {},
): Promise<IqUnlockStatus> {
  const qs = new URLSearchParams({ sessionId });
  if (opts.simApprove) qs.set("simApprove", "1");
  if (opts.itemType) qs.set("itemType", opts.itemType);
  if (opts.order_nsu) qs.set("order_nsu", opts.order_nsu);
  if (opts.transaction_nsu) qs.set("transaction_nsu", opts.transaction_nsu);
  if (opts.slug) qs.set("slug", opts.slug);
  if (opts.simulated) qs.set("simulated", "1");

  const hasReturnHints = Boolean(
    opts.order_nsu || opts.transaction_nsu || opts.slug || opts.simApprove,
  );

  // Prefer POST when reconciling checkout return / sim — body carries full hints.
  const res = hasReturnHints
    ? await fetch(`/api/payment/pix/status?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          sessionId,
          simApprove: Boolean(opts.simApprove),
          itemType: opts.itemType,
          order_nsu: opts.order_nsu ?? undefined,
          transaction_nsu: opts.transaction_nsu ?? undefined,
          slug: opts.slug ?? undefined,
          simulated: Boolean(opts.simulated),
        }),
      })
    : await fetch(`/api/payment/pix/status?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

  const data = (await res.json().catch(() => ({}))) as Parameters<
    typeof mapStatusPayload
  >[0];
  return mapStatusPayload(data);
}

export type IqPaymentReturnParams = {
  order_nsu: string | null;
  transaction_nsu: string | null;
  slug: string | null;
  simulated: boolean;
  session_id: string | null;
};

/** Parse InfinitePay redirect return query on /teste-qi. */
export function readIqPaymentReturnParams(
  search = typeof window !== "undefined" ? window.location.search : "",
): IqPaymentReturnParams | null {
  try {
    const params = new URLSearchParams(search);
    const paymentReturn =
      params.get("payment_return") === "1" ||
      params.has("order_nsu") ||
      params.has("transaction_nsu");
    if (!paymentReturn) return null;
    return {
      order_nsu: params.get("order_nsu"),
      transaction_nsu: params.get("transaction_nsu"),
      slug: params.get("slug"),
      simulated:
        params.get("simulated") === "1" ||
        Boolean(params.get("transaction_nsu")?.startsWith("SIM_")),
      session_id: params.get("session_id"),
    };
  } catch {
    return null;
  }
}

/**
 * Strip InfinitePay return noise from the URL, but KEEP `session_id` so F5 /
 * tab return can rehydrate the completed quiz without dumping on landing.
 */
export function cleanIqPaymentReturnUrl(opts?: {
  keepSessionId?: string | null;
}): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const keepSessionId =
      (typeof opts?.keepSessionId === "string" && opts.keepSessionId.trim()) ||
      url.searchParams.get("session_id");
    const keys = [
      "payment_return",
      "order_nsu",
      "transaction_nsu",
      "slug",
      "simulated",
      "capture_method",
      "receipt_url",
    ];
    let changed = false;
    for (const k of keys) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        changed = true;
      }
    }
    // Never drop a valid iq_ session id from the address bar.
    if (keepSessionId && keepSessionId.startsWith("iq_")) {
      if (url.searchParams.get("session_id") !== keepSessionId) {
        url.searchParams.set("session_id", keepSessionId);
        changed = true;
      }
    } else if (url.searchParams.has("session_id") && !keepSessionId) {
      // Stale non-iq ids (e.g. Stripe) — remove only when we have nothing to keep.
      url.searchParams.delete("session_id");
      changed = true;
    }
    if (changed) {
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  } catch {
    // ignore
  }
}

/** Persist session_id in the URL for safe F5 / payment-return restore. */
export function ensureIqSessionIdInUrl(sessionId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!sessionId || !sessionId.startsWith("iq_")) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("session_id") === sessionId) return;
    url.searchParams.set("session_id", sessionId);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    // ignore
  }
}
