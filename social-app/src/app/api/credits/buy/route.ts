import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";
import { updateDb } from "@/lib/store";
import { CREDIT_PRICE_BRL } from "@/lib/vip";

export const runtime = "nodejs";

const PACKS: Record<string, number> = {
  "10": 10,
  "25": 25,
  "50": 50,
  "100": 100,
};

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }

  const body = (await req.json()) as { pack?: string; customCredits?: number };
  let credits = 0;
  let packLabel = "";

  if (body.pack && PACKS[body.pack]) {
    credits = PACKS[body.pack];
    packLabel = `Pacote ${credits}`;
  } else if (
    typeof body.customCredits === "number" &&
    Number.isFinite(body.customCredits) &&
    body.customCredits > 0
  ) {
    credits = Math.floor(body.customCredits);
    packLabel = `Personalizado ${credits}`;
  } else {
    return NextResponse.json(
      { error: "Informe um pacote (10/25/50/100) ou quantidade personalizada." },
      { status: 400 }
    );
  }

  const amountBrl = Number((credits * CREDIT_PRICE_BRL).toFixed(2));
  const now = new Date().toISOString();

  const { result } = await updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    if (user.gender !== "homem") {
      return { error: "Somente contas masculinas compram créditos neste protótipo." };
    }

    user.credits += credits;
    user.cumulativeSpendBrl = Number(
      (user.cumulativeSpendBrl + amountBrl).toFixed(2)
    );

    const purchase = {
      id: uuid(),
      userId,
      credits,
      amountBrl,
      packLabel,
      createdAt: now,
      simulatedPix: true as const,
    };
    db.purchases.push(purchase);
    db.ledger.push({
      id: uuid(),
      userId,
      type: "credit_purchase",
      amountBrl,
      creditsDelta: credits,
      description: `Compra Pix simulada — ${packLabel} (${credits} créditos)`,
      createdAt: now,
    });

    return { user: publicUser(user), purchase };
  });

  if (!result) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ...result,
    notice: "Pagamento Pix simulado (localhost). Nenhum valor real foi cobrado.",
  });
}
