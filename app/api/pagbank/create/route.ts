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
import { isValidPixEmv } from "@/lib/pagbank/pixEmv";
import { putPagbankOrder } from "@/lib/pagbank/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const simulateAllowed = pagbankSimulateAllowed();

    // Mock mode: never return forged EMV (banks reject placeholder copia-e-cola).
    // Dev can still unlock via simulate when allowed.
    if (pagbankMockMode()) {
      const orderId = `MOCK_${crypto.randomUUID()}`;
      putPagbankOrder({
        orderId,
        status: "waiting",
        amountCentavos: PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
        pixCopyPaste: "",
        qrCodeImageUrl: null,
        mock: true,
        createdAt: Date.now(),
      });

      return NextResponse.json(
        {
          orderId,
          amountCentavos: PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
          amountLabel: "R$ 3,00",
          pixCopyPaste: "",
          qrCodeImageUrl: null,
          status: "waiting",
          mock: true,
          simulateAllowed,
          code: "PIX_MOCK_NO_EMV",
          description:
            "Modo mock: nenhum código Pix real foi emitido (evita QR rejeitado pelo banco). Use Simular pagamento (dev) se disponível.",
          error:
            "PIX_MOCK_NO_EMV: sem EMV real — copy/QR ocultos até haver texto PagBank válido",
        },
        // 200 so UI can still poll/simulate with orderId, but no copy text
        { status: 200 },
      );
    }

    const created = await createPagbankPixOrder();

    if (!isValidPixEmv(created.pixCopyPaste)) {
      console.error("[pagbank:create] refused invalid EMV after extract", {
        orderId: created.orderId,
        textLength: created.pixCopyPaste.length,
        textPrefix: created.pixCopyPaste.slice(0, 24),
      });
      return NextResponse.json(
        {
          error:
            "PIX_EMV_INVALID: PagBank response lacked a valid qr_codes/charges EMV text",
          code: "PIX_EMV_INVALID",
          description:
            "Resposta PagBank sem código Pix válido — copy/QR não serão exibidos",
          orderId: created.orderId,
          httpStatus: 502,
        },
        { status: 502 },
      );
    }

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
