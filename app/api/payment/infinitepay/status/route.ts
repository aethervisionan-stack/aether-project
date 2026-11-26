import { NextResponse } from "next/server";
import { iqUnlockAmountCentavos, iqUnlockAmountLabel } from "@/lib/iq-payment/config";
import {
  getIqUnlockSession,
  isIqSessionUnlocked,
} from "@/lib/iq-payment/sessionUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server source of truth for unlock. Client localStorage/query alone cannot unlock.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
  if (!sessionId || !/^iq_[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return NextResponse.json(
      {
        unlocked: false,
        error: "sessionId inválido",
        code: "BAD_SESSION",
      },
      { status: 400 },
    );
  }

  const unlocked = await isIqSessionUnlocked(sessionId);
  const rec = await getIqUnlockSession(sessionId);
  return NextResponse.json({
    unlocked,
    sessionId,
    status: rec?.status ?? (unlocked ? "paid" : "unknown"),
    order_nsu: rec?.order_nsu ?? null,
    amountCentavos: rec?.amountCentavos ?? iqUnlockAmountCentavos(),
    amountLabel: iqUnlockAmountLabel(
      rec?.amountCentavos ?? iqUnlockAmountCentavos(),
    ),
    paidAt: rec?.paidAt ?? null,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: unknown;
    };
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId || !/^iq_[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json(
        {
          unlocked: false,
          error: "sessionId inválido",
          code: "BAD_SESSION",
        },
        { status: 400 },
      );
    }
    const unlocked = await isIqSessionUnlocked(sessionId);
    const rec = await getIqUnlockSession(sessionId);
    return NextResponse.json({
      unlocked,
      sessionId,
      status: rec?.status ?? (unlocked ? "paid" : "unknown"),
      order_nsu: rec?.order_nsu ?? null,
      amountCentavos: rec?.amountCentavos ?? iqUnlockAmountCentavos(),
      amountLabel: iqUnlockAmountLabel(
        rec?.amountCentavos ?? iqUnlockAmountCentavos(),
      ),
      paidAt: rec?.paidAt ?? null,
    });
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
