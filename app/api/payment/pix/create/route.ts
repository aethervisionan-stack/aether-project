import { NextResponse } from "next/server";
import {
  canCreateRealPix,
  iqAmountCentavosForItemType,
  iqPaymentSimulateLocal,
  iqUnlockAmountLabel,
  parseIqUnlockItemType,
  type IqUnlockItemType,
} from "@/lib/iq-payment/config";
import {
  createInfinitePayPixPayment,
  createSimulatedInfinitePayPix,
} from "@/lib/iq-payment/infinitepay-pix";
import {
  beginIqUnlockCheckout,
  getIqUnlockSession,
} from "@/lib/iq-payment/sessionUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  sessionId?: unknown;
  itemType?: unknown;
  /** Stage-1 checkbox: result + AI in one Pix (alias for itemType=combo). */
  includeAi?: unknown;
};

function sanitizeSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 96);
  if (!trimmed || !/^iq_[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      body = {};
    }

    const sessionId = sanitizeSessionId(body.sessionId);
    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            "sessionId inválido. Use o id de sessão do teste (formato iq_…).",
          code: "BAD_SESSION",
        },
        { status: 400 },
      );
    }

    const includeAi =
      body.includeAi === true ||
      body.includeAi === "1" ||
      body.includeAi === 1;
    let itemType: IqUnlockItemType =
      parseIqUnlockItemType(body.itemType) ?? "result";
    if (includeAi && (itemType === "result" || !body.itemType)) {
      itemType = "combo";
    }

    const existing = await getIqUnlockSession(sessionId);
    if (
      (itemType === "result" || itemType === "combo") &&
      existing?.resultUnlocked
    ) {
      // Already have result: combo checkbox alone is not a new result charge.
      if (itemType === "combo" && !existing.aiUnlocked) {
        itemType = "ai_upsell";
      } else if (itemType === "result" || existing.aiUnlocked) {
        return NextResponse.json({
          alreadyUnlocked: true,
          itemType: existing.aiUnlocked ? "combo" : "result",
          resultUnlocked: true,
          aiUnlocked: Boolean(existing.aiUnlocked),
          unlocked: true,
          sessionId,
          amountCentavos: iqAmountCentavosForItemType(
            existing.aiUnlocked ? "combo" : "result",
          ),
          amountLabel: iqUnlockAmountLabel(
            iqAmountCentavosForItemType(
              existing.aiUnlocked ? "combo" : "result",
            ),
          ),
          paymentId: existing.resultPaymentId ?? existing.paymentId ?? null,
          order_nsu: existing.resultOrderNsu ?? existing.order_nsu ?? null,
        });
      }
    }
    if (itemType === "ai_upsell" && existing?.aiUnlocked) {
      return NextResponse.json({
        alreadyUnlocked: true,
        itemType,
        resultUnlocked: Boolean(existing.resultUnlocked),
        aiUnlocked: true,
        unlocked: Boolean(existing.resultUnlocked),
        sessionId,
        amountCentavos: iqAmountCentavosForItemType("ai_upsell"),
        amountLabel: iqUnlockAmountLabel(
          iqAmountCentavosForItemType("ai_upsell"),
        ),
        paymentId: existing.aiPaymentId ?? existing.paymentId ?? null,
        order_nsu: existing.aiOrderNsu ?? existing.order_nsu ?? null,
      });
    }
    if (itemType === "ai_upsell" && !existing?.resultUnlocked) {
      return NextResponse.json(
        {
          error:
            "Desbloqueie o resultado primeiro (R$1). Depois você pode liberar o assistente Gemini (+R$1).",
          code: "RESULT_REQUIRED",
          resultUnlocked: false,
          aiUnlocked: false,
        },
        { status: 409 },
      );
    }

    const amountCentavos = iqAmountCentavosForItemType(itemType);
    const amountLabel = iqUnlockAmountLabel(amountCentavos);
    const reqUrl = req.url;

    const useSim = iqPaymentSimulateLocal(reqUrl);
    const hasRealCreds = canCreateRealPix();

    if (!useSim && !hasRealCreds) {
      return NextResponse.json(
        {
          error:
            "InfinitePay não configurada. Defina INFINITEPAY_HANDLE (InfiniteTag sem $) e/ou INFINITEPAY_API_KEY (inchk_…) no .env.local e reinicie o servidor. Em produção a simulação local não está disponível.",
          code: "MISSING_CREDENTIALS",
        },
        { status: 503 },
      );
    }

    const pix = useSim
      ? await createSimulatedInfinitePayPix({
          sessionId,
          amountCentavos,
          itemType,
          reason: hasRealCreds ? "forced_simulate" : "missing_credentials",
        })
      : await createInfinitePayPixPayment({
          sessionId,
          amountCentavos,
          itemType,
        });

    const rec = await beginIqUnlockCheckout({
      sessionId,
      itemType,
      paymentId: pix.paymentId,
      order_nsu: pix.order_nsu,
      amountCentavos,
      simulated: useSim,
      qrCode: pix.qrCode || undefined,
      qrCodeBase64: pix.qrCodeBase64 || undefined,
      expiresAt: pix.expiresAt,
    });

    return NextResponse.json({
      paymentId: pix.paymentId,
      order_nsu: pix.order_nsu,
      qrCode: pix.qrCode || "",
      qrCodeBase64: pix.qrCodeBase64 || "",
      expiresAt: pix.expiresAt,
      sessionId,
      itemType,
      amountCentavos,
      amountLabel,
      simulated: useSim,
      status: pix.status,
      emvResolved: pix.emvResolved ?? false,
      checkoutUrl: pix.checkoutUrl ?? null,
      code: pix.code ?? (useSim ? "SIMULATED" : undefined),
      notice: pix.notice ?? null,
      canSimApprove: useSim,
      resultUnlocked: Boolean(rec.resultUnlocked),
      aiUnlocked: Boolean(rec.aiUnlocked),
      unlocked: Boolean(rec.resultUnlocked),
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Erro ao criar pagamento Pix InfinitePay";
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status) || 500
        : 500;
    return NextResponse.json(
      {
        error: message,
        code: status >= 500 ? "SERVER_ERROR" : "CREATE_FAILED",
        details:
          err && typeof err === "object" && "details" in err
            ? (err as { details?: unknown }).details
            : undefined,
      },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
