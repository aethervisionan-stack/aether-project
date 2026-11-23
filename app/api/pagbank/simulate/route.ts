import { NextResponse } from "next/server";
import { pagbankSimulateAllowed } from "@/lib/pagbank/config";
import { getPagbankOrder, markPagbankOrderPaid } from "@/lib/pagbank/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!pagbankSimulateAllowed()) {
    return NextResponse.json(
      { error: "Simulate disabled outside development" },
      { status: 403 },
    );
  }

  let orderId = "";
  try {
    const body = (await req.json()) as { orderId?: string };
    orderId = String(body.orderId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const existing = getPagbankOrder(orderId);
  if (!existing) {
    return NextResponse.json({ error: "Unknown orderId" }, { status: 404 });
  }

  const paid = markPagbankOrderPaid(orderId);
  return NextResponse.json({
    orderId,
    status: paid?.status ?? "paid",
  });
}
