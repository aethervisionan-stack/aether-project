import { NextResponse } from "next/server";
import {
  canCreateRealPix,
  iqPaymentSimulateLocal,
  iqUnlockAmountCentavos,
  iqUnlockAmountLabel,
} from "@/lib/iq-payment/config";
import {
  createInfinitePayPixPayment,
  createSimulatedInfinitePayPix,
} from "@/lib/iq-payment/infinitepay-pix";
import { putIqUnlockSession } from "@/lib/iq-payment/sessionUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  sessionId?: unknown;
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

    const amountCentavos = iqUnlockAmountCentavos();
    const amountLabel = iqUnlockAmountLabel(amountCentavos);
    const reqUrl = req.url;
    const now = Date.now();

    const useSim = iqPaymentSimulateLocal(reqUrl);

    if (!useSim && !canCreateRealPix()) {
      return NextResponse.json(
        {
          error:
            "InfinitePay não configurada. Defina INFINITEPAY_HANDLE e/ou INFINITEPAY_API_KEY no .env.local. Em produção a simulação local não está disponível.",
          code: "MISSING_CREDENTIALS",
        },
        { status: 503 },
      );
    }

    const pix = useSim
      ? await createSimulatedInfinitePayPix({ sessionId, amountCentavos })
      : await createInfinitePayPixPayment({
          sessionId,
          amountCentavos,
        });

    await putIqUnlockSession({
      sessionId,
      unlocked: false,
      paymentId: pix.paymentId,
      order_nsu: pix.order_nsu,
      amountCentavos,
      status: "pending",
      simulated: useSim,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      expiresAt: pix.expiresAt,
      createdAt: now,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      paymentId: pix.paymentId,
      order_nsu: pix.order_nsu,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      expiresAt: pix.expiresAt,
      sessionId,
      amountCentavos,
      amountLabel,
      simulated: useSim,
      status: pix.status,
      emvResolved: pix.emvResolved ?? false,
      checkoutUrl: pix.checkoutUrl ?? null,
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
