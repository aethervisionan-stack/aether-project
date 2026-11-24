import { NextResponse } from "next/server";
import { getPagbankOrder, putPagbankOrder } from "@/lib/pagbank/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HTTPS notification sink for Orders `notification_urls`.
 * Acknowledges PagBank callbacks; unlock still relies on client status polling.
 * Never logs secrets.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      charges?: Array<{ status?: string }>;
    };
    const orderId = typeof body.id === "string" ? body.id : "";
    if (orderId) {
      const local = getPagbankOrder(orderId);
      const paid = (body.charges ?? []).some(
        (c) => String(c.status ?? "").toUpperCase() === "PAID",
      );
      if (local && paid) {
        putPagbankOrder({ ...local, status: "paid" });
      }
    }
  } catch {
    // still 200 — PagBank retries on non-2xx
  }
  return NextResponse.json({ ok: true });
}
