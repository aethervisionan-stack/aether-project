import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";
import { readDb, updateDb } from "@/lib/store";
import { formatBrl, getFemaleVip } from "@/lib/vip";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }
  const db = await readDb();
  const withdrawals = db.withdrawals
    .filter((w) => w.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ledger = db.ledger
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ withdrawals, ledger });
}

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const { result } = await updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { error: "Usuário não encontrado", status: 404 as const };
    if (user.gender !== "mulher") {
      return {
        error: "Somente criadoras podem sacar saldo via Pix.",
        status: 400 as const,
      };
    }
    if (user.balanceBrl <= 0) {
      return { error: "Saldo disponível é zero.", status: 400 as const };
    }

    // Same-day withdraw: withdraw all available balance for the day (prototype)
    const alreadyToday = db.withdrawals.some(
      (w) => w.userId === userId && w.createdAt.startsWith(today)
    );
    const vip = getFemaleVip(user.cumulativeEarningsBrl);
    // VIP2+ has "instant withdraw"; others still allowed in localhost sim
    const amount = user.balanceBrl;
    user.balanceBrl = 0;

    const withdrawal = {
      id: uuid(),
      userId,
      amountBrl: amount,
      createdAt: now,
      method: "pix" as const,
      simulated: true as const,
      note: alreadyToday
        ? "Saque adicional do dia (simulado)"
        : "Saque do saldo do dia via Pix (simulado)",
    };
    db.withdrawals.push(withdrawal);
    db.ledger.push({
      id: uuid(),
      userId,
      type: "withdrawal",
      amountBrl: -amount,
      creditsDelta: 0,
      description: `Saque Pix simulado — ${formatBrl(amount)}${
        vip.current ? ` (VIP${vip.current.level})` : ""
      }`,
      createdAt: now,
    });

    return {
      withdrawal,
      user: publicUser(user),
      notice:
        "Pix simulado (localhost). Nenhum valor real foi transferido. Saldo do dia zerado.",
    };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.status ?? 400 });
  }
  return NextResponse.json(result);
}
