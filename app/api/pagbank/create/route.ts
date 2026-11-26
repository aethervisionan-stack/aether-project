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

function mockPixPayload(_orderId: string, _amountCentavos: number) {
  // Never return forged EMV — banks reject CRC/placeholder payloads.
  return {
    pixCopyPaste: "" as string,
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
        pixCopyPaste: null,
        qrCodeImageUrl: null,
        status: "waiting",
        mock: true,
        simulateAllowed,
        error: "PIX_MOCK_NO_EMV",
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
