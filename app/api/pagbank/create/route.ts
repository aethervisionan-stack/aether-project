import { NextResponse } from "next/server";
import {
  pagbankMockMode,
  pagbankProductMeta,
  pagbankSimulateAllowed,
  parsePagbankProduct,
  type PagbankProduct,
} from "@/lib/pagbank/config";
import { createPagbankPixOrder } from "@/lib/pagbank/client";
import { putPagbankOrder } from "@/lib/pagbank/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mockPixPayload(orderId: string, amountCentavos: number) {
  // Placeholder EMV-ish string for UI / copy in mock mode — not a real Pix.
  const amount = (amountCentavos / 100).toFixed(2);
  const text = `00020126580014BR.GOV.BCB.PIX0136${orderId}5204000053039865404${amount}5802BR5913Arquetipo Quiz6009SAO PAULO62070503***6304ABCD`;
  return {
    pixCopyPaste: text,
    qrCodeImageUrl: null as string | null,
  };
}

export async function POST(req: Request) {
  try {
    let product: PagbankProduct = "basic_3";
    try {
      const body = (await req.json()) as { product?: unknown; plan?: unknown };
      product = parsePagbankProduct(body?.product ?? body?.plan);
    } catch {
      // empty body → default basic_3 (R$ 3)
    }

    const meta = pagbankProductMeta(product);
    const simulateAllowed = pagbankSimulateAllowed();

    if (pagbankMockMode()) {
      const orderId = `MOCK_${product}_${crypto.randomUUID()}`;
      const pix = mockPixPayload(orderId, meta.amountCentavos);
      putPagbankOrder({
        orderId,
        status: "waiting",
        amountCentavos: meta.amountCentavos,
        pixCopyPaste: pix.pixCopyPaste,
        qrCodeImageUrl: pix.qrCodeImageUrl,
        mock: true,
        createdAt: Date.now(),
      });

      return NextResponse.json({
        orderId,
        product,
        amountCentavos: meta.amountCentavos,
        amountLabel: meta.amountLabel,
        pixCopyPaste: pix.pixCopyPaste,
        qrCodeImageUrl: pix.qrCodeImageUrl,
        status: "waiting",
        mock: true,
        simulateAllowed,
      });
    }

    const created = await createPagbankPixOrder(product);
    putPagbankOrder({
      orderId: created.orderId,
      status: "waiting",
      amountCentavos: created.amountCentavos,
      pixCopyPaste: created.pixCopyPaste,
      qrCodeImageUrl: created.qrCodeImageUrl,
      mock: false,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      orderId: created.orderId,
      product: created.product,
      amountCentavos: created.amountCentavos,
      amountLabel: created.amountLabel,
      pixCopyPaste: created.pixCopyPaste,
      qrCodeImageUrl: created.qrCodeImageUrl,
      status: created.status,
      mock: false,
      simulateAllowed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
