import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { markPaidAndFulfill } from "@/lib/fulfill-vision";
import { pixConfig } from "@/lib/pix";
import { toPublicOrder } from "@/lib/public-order";

export const runtime = "nodejs";

/** Local/dev only. Simulates a PIX confirmation so the checkout UI can be tested. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const pix = pixConfig();
  if (!pix.allowMock) {
    return NextResponse.json({ error: "mock_pay_disabled" }, { status: 403 });
  }
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = await markPaidAndFulfill(order.id, {
    pixTxid: order.pixTxid,
  });
  return NextResponse.json({
    order: toPublicOrder(result.order),
    skipped: result.skipped ?? null,
  });
}
