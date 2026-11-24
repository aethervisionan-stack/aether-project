import { NextResponse } from "next/server";
import {
  PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
  pagbankMockMode,
  pagbankSimulateAllowed,
} from "@/lib/pagbank/config";
import {
  createPagbankPixOrder,
  type PagbankApiError,
} from "@/lib/pagbank/client";
import { putPagbankOrder } from "@/lib/pagbank/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mockPixPayload(orderId: string) {
  // Placeholder EMV-ish string for UI / copy in mock mode — not a real Pix.
  const text = `00020126580014BR.GOV.BCB.PIX0136${orderId}52040000530398654043.005802BR5913Arquetipo Quiz6009SAO PAULO62070503***6304ABCD`;
  return {
    pixCopyPaste: text,
    qrCodeImageUrl: null as string | null,
  };
}

export async function POST() {
  try {
    const simulateAllowed = pagbankSimulateAllowed();

    if (pagbankMockMode()) {
      const orderId = `MOCK_${crypto.randomUUID()}`;
      const pix = mockPixPayload(orderId);
      putPagbankOrder({
        orderId,
        status: "waiting",
        amountCentavos: PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
        pixCopyPaste: pix.pixCopyPaste,
        qrCodeImageUrl: pix.qrCodeImageUrl,
        mock: true,
        createdAt: Date.now(),
      });

      return NextResponse.json({
        orderId,
        amountCentavos: PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
        amountLabel: "R$ 3,00",
        pixCopyPaste: pix.pixCopyPaste,
        qrCodeImageUrl: pix.qrCodeImageUrl,
        status: "waiting",
        mock: true,
        simulateAllowed,
      });
    }

    const created = await createPagbankPixOrder();
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
      amountCentavos: created.amountCentavos,
      amountLabel: "R$ 3,00",
      pixCopyPaste: created.pixCopyPaste,
      qrCodeImageUrl: created.qrCodeImageUrl,
      status: created.status,
      mock: false,
      simulateAllowed,
    });
  } catch (err) {
    const apiErr = err as PagbankApiError;
    const status =
      typeof apiErr.status === "number" ? apiErr.status : 502;
    const code = apiErr.code || `HTTP_${status}`;
    const description =
      apiErr.description ||
      (err instanceof Error ? err.message : "Create failed");

    // Always return exact PagBank code/description (+ safe body preview)
    return NextResponse.json(
      {
        error: `${code}: ${description}`,
        code,
        description,
        parameterName: apiErr.parameterName || undefined,
        bodyPreview: apiErr.bodyPreview || undefined,
        httpStatus: status,
      },
      { status },
    );
  }
}
