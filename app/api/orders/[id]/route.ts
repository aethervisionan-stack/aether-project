import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";
import { toPublicOrder } from "@/lib/public-order";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ order: toPublicOrder(order) });
}
