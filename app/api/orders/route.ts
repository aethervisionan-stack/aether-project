import { NextResponse } from "next/server";
import {
  createOrder,
  updateOrder,
  usesPostgresDatabase,
  type PayMethod,
} from "@/lib/orders";
import { buildPixCopyPaste, pixConfig } from "@/lib/pix";
import { toPublicOrder } from "@/lib/public-order";
import { quoteVisionForLamports } from "@/lib/vision-pricing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      method?: PayMethod;
      destPubkey?: string;
      usd?: number;
      solLamports?: number;
      tierId?: string | null;
      tierName?: string;
    };

    if (body.method !== "sol" && body.method !== "pix") {
      return NextResponse.json({ error: "method must be sol or pix" }, { status: 400 });
    }
    if (!body.destPubkey) {
      return NextResponse.json({ error: "destPubkey required" }, { status: 400 });
    }

    let usd = body.usd;
    let visionAmount: number | undefined;
    const solLamports = body.solLamports ?? null;
    if (body.method === "sol" && solLamports && solLamports > 0) {
      const quote = await quoteVisionForLamports({
        lamports: solLamports,
        tierId: body.tierId ?? null,
      });
      usd = quote.solPaid * quote.solUsd;
      visionAmount = quote.visionUi;
      console.log("[orders] SOL quote", quote);
    }
    if (typeof usd !== "number" || usd <= 0) {
      return NextResponse.json({ error: "usd or solLamports required" }, { status: 400 });
    }

    let order = await createOrder({
      method: body.method,
      destPubkey: body.destPubkey,
      usd,
      solLamports,
      tierId: body.tierId ?? null,
      tierName: body.tierName,
      visionAmount,
    });

    if (order.method === "pix") {
      const pix = pixConfig();
      const copy = buildPixCopyPaste({
        pixKey: pix.key,
        merchantName: pix.merchantName,
        merchantCity: pix.merchantCity,
        amountBrl: order.brl,
        txid: order.pixTxid ?? order.id,
      });
      order = (await updateOrder(order.id, { pixCopyPaste: copy })) ?? order;
    }

    return NextResponse.json({
      order: toPublicOrder(order),
      storage: usesPostgresDatabase() ? "postgres" : "file",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "order_failed";
    if (message.includes("DATABASE_URL") || message.includes("/tmp")) {
      return NextResponse.json({ error: "database_unavailable", detail: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
