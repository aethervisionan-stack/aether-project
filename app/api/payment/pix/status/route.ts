import { NextResponse } from "next/server";
import {
  infinitepayApiKey,
  infinitepayHandle,
  iqAmountCentavosForItemType,
  iqPaymentSimulateLocal,
  iqUnlockAmountLabel,
  isLocalRequest,
  isRealApiKey,
  parseIqUnlockItemType,
  type IqUnlockItemType,
} from "@/lib/iq-payment/config";
import { isInfinitePayPaidStatus } from "@/lib/iq-payment/infinitepay-pix";
import {
  extractItemTypeFromOrderNsu,
  getIqUnlockSession,
  isIqSessionAiUnlocked,
  isIqSessionResultUnlocked,
  markIqSessionPaid,
  orderBelongsToIqSession,
} from "@/lib/iq-payment/sessionUnlock";
import {
  getInfinitePayOrderAsync,
  markInfinitePayPaidAsync,
} from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeSessionId(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || !/^iq_[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function wantsSimApprove(url: URL, body?: { simApprove?: unknown }): boolean {
  const q =
    url.searchParams.get("simApprove") === "1" ||
    url.searchParams.get("simApprove") === "true";
  const b =
    body?.simApprove === true ||
    body?.simApprove === "1" ||
    body?.simApprove === 1;
  return q || b;
}

function detectPaidPayload(data: Record<string, unknown>): boolean {
  if (data.paid === true) return true;
  const status = String(data.status ?? data.payment_status ?? "").toLowerCase();
  return isInfinitePayPaidStatus(status);
}

function buildAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = infinitepayApiKey();
  if (isRealApiKey(key)) {
    headers.Authorization = `Bearer ${key}`;
    headers["X-Api-Key"] = key;
  }
  return headers;
}

type ResolveOpts = {
  simApprove?: boolean;
  itemType?: IqUnlockItemType | null;
  order_nsu?: string | null;
  transaction_nsu?: string | null;
  slug?: string | null;
  simulated?: boolean;
};

async function tryMarkFromStore(
  sessionId: string,
  orderNsu: string | null | undefined,
) {
  if (!orderNsu) return false;
  // Refuse cross-session unlock: a paid order_nsu must belong to this session.
  if (!(await orderBelongsToIqSession(sessionId, orderNsu))) return false;
  const order = await getInfinitePayOrderAsync(orderNsu);
  if (
    !order ||
    !(order.status === "paid" || isInfinitePayPaidStatus(order.status))
  ) {
    return false;
  }
  // Store row sessionId (when present) must also match.
  if (order.sessionId && order.sessionId !== sessionId) return false;
  const paidItem =
    extractItemTypeFromOrderNsu(orderNsu) ??
    (await getIqUnlockSession(sessionId))?.itemType ??
    "result";
  await markIqSessionPaid(sessionId, {
    paymentId: orderNsu,
    order_nsu: orderNsu,
    transaction_nsu: order.transaction_nsu,
    slug: order.slug,
    amountCentavos:
      order.amountCentavos ?? iqAmountCentavosForItemType(paidItem),
    simulated: Boolean(order.simulated),
    itemType: paidItem,
  });
  return true;
}

/**
 * Reconcile InfinitePay redirect return (order_nsu + transaction_nsu + slug)
 * or a pending store row so resultUnlocked applies ASAP after checkout.
 */
async function reconcileReturnHints(
  sessionId: string,
  req: Request,
  opts: ResolveOpts,
): Promise<boolean> {
  const rec = await getIqUnlockSession(sessionId);
  // Prefer caller hint only when it belongs to this session (anti-forge).
  const hintedOrder =
    opts.order_nsu && (await orderBelongsToIqSession(sessionId, opts.order_nsu))
      ? opts.order_nsu
      : null;
  const order_nsu =
    hintedOrder ||
    rec?.order_nsu ||
    rec?.resultOrderNsu ||
    rec?.aiOrderNsu ||
    null;
  if (!order_nsu) return false;
  if (!(await orderBelongsToIqSession(sessionId, order_nsu))) return false;

  if (await tryMarkFromStore(sessionId, order_nsu)) return true;
  if (await tryMarkFromStore(sessionId, rec?.resultOrderNsu)) return true;
  if (await tryMarkFromStore(sessionId, rec?.aiOrderNsu)) return true;

  const transaction_nsu = opts.transaction_nsu;
  const slug = opts.slug;
  const localOrder = await getInfinitePayOrderAsync(order_nsu);
  if (localOrder?.sessionId && localOrder.sessionId !== sessionId) {
    return false;
  }
  const itemType =
    extractItemTypeFromOrderNsu(order_nsu) ??
    opts.itemType ??
    rec?.itemType ??
    "result";
  const amountCentavos =
    localOrder?.amountCentavos ??
    rec?.amountCentavos ??
    iqAmountCentavosForItemType(itemType);

  // Dev-only sim return: never honor SIM_/simulated hints for real checkouts
  // or non-loopback hosts (prevents forged payment_return unlocks).
  // Also require a known local pending order (or simulate gate) — bare URL
  // forgeries with fabricated order_nsu must not unlock.
  const orderWasSimulated =
    Boolean(localOrder?.simulated) || Boolean(rec?.simulated);
  const allowSimReturn =
    isLocalRequest(req.url) &&
    Boolean(localOrder) &&
    (iqPaymentSimulateLocal(req.url) || orderWasSimulated);

  if (
    allowSimReturn &&
    transaction_nsu &&
    (opts.simulated ||
      transaction_nsu.startsWith("SIM_") ||
      orderWasSimulated)
  ) {
    await markInfinitePayPaidAsync(order_nsu, {
      transaction_nsu,
      slug: slug ?? undefined,
    });
    await markIqSessionPaid(sessionId, {
      paymentId: order_nsu,
      order_nsu,
      transaction_nsu,
      slug: slug ?? undefined,
      amountCentavos,
      simulated: true,
      itemType,
    });
    return true;
  }

  // Real checkout return: ask InfinitePay payment_check when we have full hints.
  if (transaction_nsu && slug && isRealApiKey()) {
    try {
      const handle = infinitepayHandle();
      const res = await fetch(
        "https://api.checkout.infinitepay.io/payment_check",
        {
          method: "POST",
          headers: buildAuthHeaders(),
          body: JSON.stringify({
            handle,
            order_nsu,
            transaction_nsu,
            slug,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (res.ok && detectPaidPayload(data)) {
        await markInfinitePayPaidAsync(order_nsu, {
          transaction_nsu,
          slug,
        });
        await markIqSessionPaid(sessionId, {
          paymentId: order_nsu,
          order_nsu,
          transaction_nsu,
          slug,
          amountCentavos,
          simulated: false,
          itemType,
        });
        return true;
      }
    } catch (err) {
      console.error("[iq-pix-status] payment_check failed", err);
    }
  }

  return false;
}

async function resolveStatus(
  sessionId: string,
  req: Request,
  opts: ResolveOpts = {},
) {
  let resultUnlocked = await isIqSessionResultUnlocked(sessionId);
  let aiUnlocked = await isIqSessionAiUnlocked(sessionId);
  let rec = await getIqUnlockSession(sessionId);

  const focusItem: IqUnlockItemType =
    opts.itemType ??
    rec?.itemType ??
    (rec?.order_nsu ? extractItemTypeFromOrderNsu(rec.order_nsu) : null) ??
    "result";

  // Always try store + return-hint reconciliation first (webhook may lag).
  await reconcileReturnHints(sessionId, req, {
    ...opts,
    itemType: focusItem,
  });
  resultUnlocked = await isIqSessionResultUnlocked(sessionId);
  aiUnlocked = await isIqSessionAiUnlocked(sessionId);
  rec = await getIqUnlockSession(sessionId);

  // Localhost sim approve — loopback + (simulate gate OR pending simulated session).
  const local = isLocalRequest(req.url);
  const simGate =
    local &&
    (iqPaymentSimulateLocal(req.url) || Boolean(rec?.simulated));
  const focusUnlocked =
    focusItem === "ai_upsell"
      ? aiUnlocked
      : focusItem === "combo"
        ? resultUnlocked && aiUnlocked
        : resultUnlocked;

  if (!focusUnlocked && opts.simApprove && simGate) {
    const amountCentavos =
      rec?.amountCentavos ?? iqAmountCentavosForItemType(focusItem);
    await markIqSessionPaid(sessionId, {
      paymentId: rec?.paymentId ?? `sim_approve_${focusItem}_${sessionId}`,
      order_nsu: rec?.order_nsu,
      amountCentavos,
      simulated: true,
      itemType: focusItem,
    });
    resultUnlocked = await isIqSessionResultUnlocked(sessionId);
    aiUnlocked = await isIqSessionAiUnlocked(sessionId);
  }

  const fresh = await getIqUnlockSession(sessionId);
  resultUnlocked =
    resultUnlocked || (await isIqSessionResultUnlocked(sessionId));
  aiUnlocked = aiUnlocked || (await isIqSessionAiUnlocked(sessionId));

  const amountForFocus = iqAmountCentavosForItemType(focusItem);
  const freshFocusUnlocked =
    focusItem === "ai_upsell"
      ? aiUnlocked
      : focusItem === "combo"
        ? resultUnlocked && aiUnlocked
        : resultUnlocked;

  return {
    unlocked: resultUnlocked,
    resultUnlocked,
    aiUnlocked,
    itemType: focusItem,
    sessionId,
    status: fresh?.status ?? (resultUnlocked || aiUnlocked ? "paid" : "unknown"),
    paymentId: fresh?.paymentId ?? fresh?.order_nsu ?? null,
    order_nsu: fresh?.order_nsu ?? fresh?.paymentId ?? null,
    amountCentavos: fresh?.amountCentavos ?? amountForFocus,
    amountLabel: iqUnlockAmountLabel(
      fresh?.amountCentavos ?? amountForFocus,
    ),
    resultAmountCentavos: iqAmountCentavosForItemType("result"),
    resultAmountLabel: iqUnlockAmountLabel(
      iqAmountCentavosForItemType("result"),
    ),
    aiAmountCentavos: iqAmountCentavosForItemType("ai_upsell"),
    aiAmountLabel: iqUnlockAmountLabel(
      iqAmountCentavosForItemType("ai_upsell"),
    ),
    comboAmountCentavos: iqAmountCentavosForItemType("combo"),
    comboAmountLabel: iqUnlockAmountLabel(
      iqAmountCentavosForItemType("combo"),
    ),
    paidAt: fresh?.paidAt ?? null,
    expiresAt: fresh?.expiresAt ?? null,
    simulated: Boolean(fresh?.simulated),
    canSimApprove:
      !freshFocusUnlocked &&
      local &&
      (iqPaymentSimulateLocal(req.url) ||
        Boolean(fresh?.simulated ?? rec?.simulated)),
  };
}

function parseReturnHints(
  url: URL,
  body?: {
    order_nsu?: unknown;
    transaction_nsu?: unknown;
    slug?: unknown;
    simulated?: unknown;
  },
): Pick<
  ResolveOpts,
  "order_nsu" | "transaction_nsu" | "slug" | "simulated"
> {
  return {
    order_nsu:
      pickString(body?.order_nsu) ||
      pickString(url.searchParams.get("order_nsu")),
    transaction_nsu:
      pickString(body?.transaction_nsu) ||
      pickString(url.searchParams.get("transaction_nsu")),
    slug:
      pickString(body?.slug) || pickString(url.searchParams.get("slug")),
    simulated:
      body?.simulated === true ||
      body?.simulated === "1" ||
      body?.simulated === 1 ||
      url.searchParams.get("simulated") === "1" ||
      url.searchParams.get("simulated") === "true",
  };
}

/**
 * Server source of truth for unlock. Client localStorage/query alone cannot unlock.
 * Polling: GET /api/payment/pix/status?sessionId=iq_…&itemType=result|ai_upsell|combo
 * Return reconcile: also pass order_nsu (+ transaction_nsu/slug when available).
 * Dev-only: &simApprove=1 on localhost marks simulated payment as paid.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = sanitizeSessionId(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json(
      {
        unlocked: false,
        resultUnlocked: false,
        aiUnlocked: false,
        error: "sessionId inválido",
        code: "BAD_SESSION",
      },
      { status: 400 },
    );
  }

  try {
    const payload = await resolveStatus(sessionId, req, {
      simApprove: wantsSimApprove(url),
      itemType: parseIqUnlockItemType(url.searchParams.get("itemType")),
      ...parseReturnHints(url),
    });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        unlocked: false,
        resultUnlocked: false,
        aiUnlocked: false,
        error: err instanceof Error ? err.message : "Erro de status",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: unknown;
      simApprove?: unknown;
      itemType?: unknown;
      order_nsu?: unknown;
      transaction_nsu?: unknown;
      slug?: unknown;
      simulated?: unknown;
    };
    const sessionId = sanitizeSessionId(
      typeof body.sessionId === "string" ? body.sessionId : "",
    );
    if (!sessionId) {
      return NextResponse.json(
        {
          unlocked: false,
          resultUnlocked: false,
          aiUnlocked: false,
          error: "sessionId inválido",
          code: "BAD_SESSION",
        },
        { status: 400 },
      );
    }
    const url = new URL(req.url);
    const payload = await resolveStatus(sessionId, req, {
      simApprove: wantsSimApprove(url, body),
      itemType:
        parseIqUnlockItemType(body.itemType) ??
        parseIqUnlockItemType(url.searchParams.get("itemType")),
      ...parseReturnHints(url, body),
    });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        unlocked: false,
        resultUnlocked: false,
        aiUnlocked: false,
        error: err instanceof Error ? err.message : "Erro de status",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
