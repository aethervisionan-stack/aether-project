import { NextResponse } from "next/server";
import {
  iqAiUpsellAmountCentavos,
  iqUnlockAmountCentavos,
  iqUnlockAmountLabel,
} from "@/lib/iq-payment/config";
import {
  getIqUnlockSession,
  isIqSessionAiUnlocked,
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
  const aiUnlocked = await isIqSessionAiUnlocked(sessionId);
  const rec = await getIqUnlockSession(sessionId);
  return NextResponse.json({
    unlocked,
    resultUnlocked: unlocked,
    aiUnlocked,
    sessionId,
    status: rec?.status ?? (unlocked || aiUnlocked ? "paid" : "unknown"),
    order_nsu: rec?.order_nsu ?? null,
    amountCentavos: rec?.amountCentavos ?? iqUnlockAmountCentavos(),
    amountLabel: iqUnlockAmountLabel(
      rec?.amountCentavos ?? iqUnlockAmountCentavos(),
    ),
    resultAmountCentavos: iqUnlockAmountCentavos(),
    resultAmountLabel: iqUnlockAmountLabel(iqUnlockAmountCentavos()),
    aiAmountCentavos: iqAiUpsellAmountCentavos(),
    aiAmountLabel: iqUnlockAmountLabel(iqAiUpsellAmountCentavos()),
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
    const aiUnlocked = await isIqSessionAiUnlocked(sessionId);
    const rec = await getIqUnlockSession(sessionId);
    return NextResponse.json({
      unlocked,
      resultUnlocked: unlocked,
      aiUnlocked,
      sessionId,
      status: rec?.status ?? (unlocked || aiUnlocked ? "paid" : "unknown"),
      order_nsu: rec?.order_nsu ?? null,
      amountCentavos: rec?.amountCentavos ?? iqUnlockAmountCentavos(),
      amountLabel: iqUnlockAmountLabel(
        rec?.amountCentavos ?? iqUnlockAmountCentavos(),
      ),
      resultAmountCentavos: iqUnlockAmountCentavos(),
      resultAmountLabel: iqUnlockAmountLabel(iqUnlockAmountCentavos()),
      aiAmountCentavos: iqAiUpsellAmountCentavos(),
      aiAmountLabel: iqUnlockAmountLabel(iqAiUpsellAmountCentavos()),
      paidAt: rec?.paidAt ?? null,
    });
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
