/** Client helpers for IQ InfinitePay unlock — never treat localStorage as authority. */

export type IqPaymentReturnParams = {
  order_nsu: string;
  transaction_nsu: string | null;
  slug: string | null;
  simulated: boolean;
  session_id: string | null;
};

export function createIqSessionId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `iq_${rand}`;
}

export function readIqPaymentReturnParams(
  search = typeof window !== "undefined" ? window.location.search : "",
): IqPaymentReturnParams | null {
  try {
    const params = new URLSearchParams(search);
    if (params.get("payment_return") !== "1") return null;
    const order_nsu = params.get("order_nsu")?.trim() || null;
    if (!order_nsu) return null;
    return {
      order_nsu,
      transaction_nsu: params.get("transaction_nsu")?.trim() || null,
      slug: params.get("slug")?.trim() || null,
      simulated:
        params.get("simulated") === "1" || params.get("simulated") === "true",
      session_id: params.get("session_id")?.trim() || null,
    };
  } catch {
    return null;
  }
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

export async function fetchIqUnlockStatus(sessionId: string): Promise<{
  unlocked: boolean;
  amountCentavos: number;
  amountLabel: string;
  order_nsu: string | null;
  error?: string;
}> {
  const res = await fetch(
    `/api/payment/infinitepay/status?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "GET", cache: "no-store" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    unlocked?: boolean;
    amountCentavos?: number;
    amountLabel?: string;
    order_nsu?: string | null;
    error?: string;
  };
  return {
    unlocked: Boolean(data.unlocked),
    amountCentavos:
      typeof data.amountCentavos === "number" ? data.amountCentavos : 100,
    amountLabel:
      typeof data.amountLabel === "string" ? data.amountLabel : "R$ 1,00",
    order_nsu: data.order_nsu ?? null,
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

export async function verifyIqPayment(params: {
  sessionId: string;
  order_nsu: string;
  transaction_nsu?: string | null;
  slug?: string | null;
  simulated?: boolean;
}): Promise<{ unlocked: boolean; error?: string; paid?: boolean }> {
  const res = await fetch("/api/payment/infinitepay/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: params.sessionId,
      order_nsu: params.order_nsu,
      transaction_nsu: params.transaction_nsu,
      slug: params.slug,
      simulated: params.simulated ? "1" : undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    unlocked?: boolean;
    paid?: boolean;
    error?: string;
    pending?: boolean;
  };
  if (!res.ok || (!data.unlocked && !data.paid)) {
    return {
      unlocked: false,
      paid: false,
      error:
        data.error ||
        (data.pending
          ? "Pagamento ainda não confirmado. Aguarde ou tente de novo."
          : "Não foi possível confirmar o pagamento. Tente de novo — sua sessão permanece salva."),
    };
  }
  return { unlocked: true, paid: true };
}

export async function createIqCheckout(sessionId: string): Promise<{
  url: string;
  order_nsu: string;
  amountLabel: string;
  simulated?: boolean;
}> {
  const res = await fetch("/api/payment/infinitepay/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    order_nsu?: string;
    amountLabel?: string;
    simulated?: boolean;
    error?: string;
  };
  if (!res.ok || !data.url || !data.order_nsu) {
    throw new Error(
      data.error ||
        "Não foi possível abrir o checkout. Tente de novo — sua sessão permanece salva.",
    );
  }
  return {
    url: data.url,
    order_nsu: data.order_nsu,
    amountLabel: data.amountLabel || "R$ 1,00",
    simulated: data.simulated,
  };
}
