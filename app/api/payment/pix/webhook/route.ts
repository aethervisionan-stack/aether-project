import { NextResponse } from "next/server";
import { iqUnlockAmountCentavos } from "@/lib/iq-payment/config";
import {
  fetchMercadoPagoPayment,
  isMercadoPagoPaidStatus,
} from "@/lib/iq-payment/mercadopago";
import {
  getIqUnlockByPaymentId,
  getIqUnlockSession,
  markIqSessionPaid,
} from "@/lib/iq-payment/sessionUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mercado Pago Pix webhook.
 * Accepts classic topic/id query params and JSON body { type, data: { id } }.
 * Always acknowledges 200 so MP does not retry forever on unknown events.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const data = (body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    const paymentIdRaw =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      (typeof data.id === "string" || typeof data.id === "number"
        ? String(data.id)
        : null) ||
      (typeof body.id === "string" || typeof body.id === "number"
        ? String(body.id)
        : null);

    const topic = (
      url.searchParams.get("topic") ||
      url.searchParams.get("type") ||
      (typeof body.type === "string" ? body.type : "") ||
      (typeof body.action === "string" ? body.action : "") ||
      ""
    ).toLowerCase();

    // Ignore non-payment noise quickly.
    if (
      topic &&
      !topic.includes("payment") &&
      topic !== "merchant_order" &&
      !paymentIdRaw
    ) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!paymentIdRaw) {
      return NextResponse.json({ ok: true, ignored: true, reason: "no_id" });
    }

    // Prefer live MP status over trusting webhook body alone.
    const mp = await fetchMercadoPagoPayment(paymentIdRaw);
    const paid =
      Boolean(mp?.paid) ||
      isMercadoPagoPaidStatus(mp?.status) ||
      isMercadoPagoPaidStatus(
        typeof body.status === "string" ? body.status : null,
      );

    if (!paid) {
      return NextResponse.json({
        ok: true,
        paymentId: paymentIdRaw,
        unlocked: false,
        status: mp?.status ?? "pending",
      });
    }

    let sessionId =
      mp?.externalReference ||
      (await getIqUnlockByPaymentId(paymentIdRaw))?.sessionId ||
      null;

    // metadata.sessionId fallback from raw
    if (!sessionId && mp?.raw) {
      const meta = mp.raw.metadata;
      if (meta && typeof meta === "object") {
        const sid = (meta as Record<string, unknown>).sessionId;
        if (typeof sid === "string" && sid.startsWith("iq_")) sessionId = sid;
      }
    }

    if (!sessionId || !/^iq_[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({
        ok: true,
        paymentId: paymentIdRaw,
        unlocked: false,
        reason: "session_not_found",
      });
    }

    const existing = await getIqUnlockSession(sessionId);
    await markIqSessionPaid(sessionId, {
      paymentId: paymentIdRaw,
      amountCentavos: existing?.amountCentavos ?? iqUnlockAmountCentavos(),
      simulated: false,
    });

    return NextResponse.json({
      ok: true,
      paymentId: paymentIdRaw,
      sessionId,
      unlocked: true,
    });
  } catch (err) {
    console.error("[iq-pix-webhook]", err);
    // Still 200 — avoid infinite MP retries; status polling will reconcile.
    return NextResponse.json({
      ok: true,
      error: err instanceof Error ? err.message : "webhook_error",
    });
  }
}

export async function GET(req: Request) {
  // MP sometimes probes with GET.
  return POST(req);
}
