import { NextResponse } from "next/server";
import {
  PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
  pagbankMockMode,
} from "@/lib/pagbank/config";
import { fetchPagbankOrderStatus } from "@/lib/pagbank/client";
import { getPagbankOrder, putPagbankOrder } from "@/lib/pagbank/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { orderId } = await ctx.params;
  if (!orderId || orderId.length > 80) {
    return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
  }

  try {
    const local = getPagbankOrder(orderId);
    if (local?.status === "paid") {
      return NextResponse.json({
        orderId,
        status: "paid",
        amountCentavos: local.amountCentavos,
      });
    }

    if (local?.mock || (pagbankMockMode() && orderId.startsWith("MOCK_"))) {
      return NextResponse.json({
        orderId,
        status: local?.status ?? "waiting",
        amountCentavos: local?.amountCentavos ?? PAGBANK_UNLOCK_AMOUNT_CENTAVOS,
      });
    }

    const remote = await fetchPagbankOrderStatus(orderId);
    if (local) {
      putPagbankOrder({ ...local, status: remote.status });
    }

    return NextResponse.json({
      orderId: remote.orderId,
      status: remote.status,
      amountCentavos: remote.amountCentavos,
    });
  } catch (err) {
    const apiErr = err as {
      message?: string;
      status?: number;
      code?: string;
      description?: string;
    };
    const message =
      err instanceof Error ? err.message : "Status failed";
    return NextResponse.json(
      {
        error: message,
        code: apiErr.code,
        description: apiErr.description,
      },
      { status: typeof apiErr.status === "number" ? apiErr.status : 502 },
    );
  }
}
