import { NextResponse } from "next/server";
import {
  iqAmountCentavosForItemType,
  iqPaymentSimulateLocal,
  iqUnlockAmountLabel,
  isLocalRequest,
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
} from "@/lib/iq-payment/sessionUnlock";
import { getInfinitePayOrderAsync } from "@/lib/infinitepay/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeSessionId(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || !/^iq_[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
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

async function resolveStatus(
  sessionId: string,
  req: Request,
  opts: { simApprove?: boolean; itemType?: IqUnlockItemType | null } = {},
) {
  const rec = await getIqUnlockSession(sessionId);
  let resultUnlocked = await isIqSessionResultUnlocked(sessionId);
  let aiUnlocked = await isIqSessionAiUnlocked(sessionId);

  const focusItem: IqUnlockItemType =
    opts.itemType ??
    rec?.itemType ??
    (rec?.order_nsu ? extractItemTypeFromOrderNsu(rec.order_nsu) : null) ??
    "result";

  // Poll InfinitePay order store (webhook / verify may have marked paid).
  if (rec?.order_nsu) {
    const order = await getInfinitePayOrderAsync(rec.order_nsu);
    if (
      order &&
      (order.status === "paid" || isInfinitePayPaidStatus(order.status))
    ) {
      const paidItem =
        extractItemTypeFromOrderNsu(rec.order_nsu) ??
        rec.itemType ??
        "result";
      await markIqSessionPaid(sessionId, {
        paymentId: rec.paymentId ?? rec.order_nsu,
        order_nsu: rec.order_nsu,
        transaction_nsu: order.transaction_nsu,
        slug: order.slug,
        amountCentavos: rec.amountCentavos,
        simulated: Boolean(order.simulated || rec.simulated),
        itemType: paidItem,
      });
      resultUnlocked = await isIqSessionResultUnlocked(sessionId);
      aiUnlocked = await isIqSessionAiUnlocked(sessionId);
    }
  }

  // Localhost sim approve — loopback + (simulate gate OR pending simulated session).
  const local = isLocalRequest(req.url);
  const simGate =
    local &&
    (iqPaymentSimulateLocal(req.url) || Boolean(rec?.simulated));
  const focusUnlocked =
    focusItem === "ai_upsell" ? aiUnlocked : resultUnlocked;
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
    focusItem === "ai_upsell" ? aiUnlocked : resultUnlocked;

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

/**
 * Server source of truth for unlock. Client localStorage/query alone cannot unlock.
 * Polling: GET /api/payment/pix/status?sessionId=iq_…&itemType=result|ai_upsell
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
