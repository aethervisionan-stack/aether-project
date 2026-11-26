import { NextResponse } from "next/server";
import {
  iqPaymentSimulateLocal,
  iqUnlockAmountCentavos,
  iqUnlockAmountLabel,
  isLocalRequest,
} from "@/lib/iq-payment/config";
import { isInfinitePayPaidStatus } from "@/lib/iq-payment/infinitepay-pix";
import {
  getIqUnlockSession,
  isIqSessionUnlocked,
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
  opts: { simApprove?: boolean } = {},
) {
  const rec = await getIqUnlockSession(sessionId);
  let unlocked = await isIqSessionUnlocked(sessionId);

  // Poll InfinitePay order store (webhook / verify may have marked paid).
  if (!unlocked && rec?.order_nsu) {
    const order = await getInfinitePayOrderAsync(rec.order_nsu);
    if (
      order &&
      (order.status === "paid" || isInfinitePayPaidStatus(order.status))
    ) {
      await markIqSessionPaid(sessionId, {
        paymentId: rec.paymentId ?? rec.order_nsu,
        order_nsu: rec.order_nsu,
        transaction_nsu: order.transaction_nsu,
        slug: order.slug,
        amountCentavos: rec.amountCentavos,
        simulated: Boolean(order.simulated || rec.simulated),
      });
      unlocked = true;
    }
  }

  // Localhost sim approve — loopback + (simulate gate OR pending simulated session).
  const local = isLocalRequest(req.url);
  const simGate =
    local &&
    (iqPaymentSimulateLocal(req.url) || Boolean(rec?.simulated));
  if (!unlocked && opts.simApprove && simGate) {
    const amountCentavos = rec?.amountCentavos ?? iqUnlockAmountCentavos();
    await markIqSessionPaid(sessionId, {
      paymentId: rec?.paymentId ?? `sim_approve_${sessionId}`,
      order_nsu: rec?.order_nsu,
      amountCentavos,
      simulated: true,
    });
    unlocked = true;
  }

  const fresh = await getIqUnlockSession(sessionId);
  unlocked = unlocked || (await isIqSessionUnlocked(sessionId));

  return {
    unlocked,
    sessionId,
    status: fresh?.status ?? (unlocked ? "paid" : "unknown"),
    paymentId: fresh?.paymentId ?? fresh?.order_nsu ?? null,
    order_nsu: fresh?.order_nsu ?? fresh?.paymentId ?? null,
    amountCentavos: fresh?.amountCentavos ?? iqUnlockAmountCentavos(),
    amountLabel: iqUnlockAmountLabel(
      fresh?.amountCentavos ?? iqUnlockAmountCentavos(),
    ),
    paidAt: fresh?.paidAt ?? null,
    expiresAt: fresh?.expiresAt ?? null,
    simulated: Boolean(fresh?.simulated),
    canSimApprove:
      !unlocked &&
      local &&
      (iqPaymentSimulateLocal(req.url) || Boolean(fresh?.simulated ?? rec?.simulated)),
  };
}

/**
 * Server source of truth for unlock. Client localStorage/query alone cannot unlock.
 * Polling: GET /api/payment/pix/status?sessionId=iq_…
 * Dev-only: &simApprove=1 on localhost marks simulated payment as paid.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = sanitizeSessionId(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json(
      {
        unlocked: false,
        error: "sessionId inválido",
        code: "BAD_SESSION",
      },
      { status: 400 },
    );
  }

  try {
    const payload = await resolveStatus(sessionId, req, {
      simApprove: wantsSimApprove(url),
    });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        unlocked: false,
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
    };
    const sessionId = sanitizeSessionId(
      typeof body.sessionId === "string" ? body.sessionId : "",
    );
    if (!sessionId) {
      return NextResponse.json(
        {
          unlocked: false,
          error: "sessionId inválido",
          code: "BAD_SESSION",
        },
        { status: 400 },
      );
    }
    const url = new URL(req.url);
    const payload = await resolveStatus(sessionId, req, {
      simApprove: wantsSimApprove(url, body),
    });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        unlocked: false,
        error: err instanceof Error ? err.message : "Erro de status",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
