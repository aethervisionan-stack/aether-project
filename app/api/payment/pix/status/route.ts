import { NextResponse } from "next/server";
import {
  iqPaymentSimulateLocal,
  iqUnlockAmountCentavos,
  iqUnlockAmountLabel,
  isLocalRequest,
} from "@/lib/iq-payment/config";
import {
  fetchMercadoPagoPayment,
  isMercadoPagoPaidStatus,
} from "@/lib/iq-payment/mercadopago";
import {
  getIqUnlockSession,
  isIqSessionUnlocked,
  markIqSessionPaid,
} from "@/lib/iq-payment/sessionUnlock";

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

  // Poll Mercado Pago for real payments still pending.
  if (
    !unlocked &&
    rec?.paymentId &&
    !rec.simulated &&
    !String(rec.paymentId).startsWith("sim_")
  ) {
    const mp = await fetchMercadoPagoPayment(rec.paymentId);
    if (mp?.paid || isMercadoPagoPaidStatus(mp?.status)) {
      await markIqSessionPaid(sessionId, {
        paymentId: mp?.id ?? rec.paymentId,
        amountCentavos: rec.amountCentavos,
        simulated: false,
      });
      unlocked = true;
    }
  }

  // Localhost sim approve — only on loopback / explicit simulate gate.
  if (
    !unlocked &&
    opts.simApprove &&
    iqPaymentSimulateLocal(req.url) &&
    isLocalRequest(req.url)
  ) {
    const amountCentavos = rec?.amountCentavos ?? iqUnlockAmountCentavos();
    await markIqSessionPaid(sessionId, {
      paymentId: rec?.paymentId ?? `sim_approve_${sessionId}`,
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
      iqPaymentSimulateLocal(req.url) &&
      isLocalRequest(req.url),
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
