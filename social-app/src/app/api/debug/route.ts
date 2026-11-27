import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import { DEBUG_PRESETS } from "@/lib/seed";
import { getSessionUserId, setSessionUserId } from "@/lib/session";
import { readDb, resetDb, updateDb } from "@/lib/store";
import { FEMALE_VIP, MALE_VIP, formatBrl } from "@/lib/vip";

export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  const presets = DEBUG_PRESETS.map((p) => {
    const user = db.users.find((u) => u.id === p.id);
    return { ...p, user: user ? publicUser(user) : null };
  });
  return NextResponse.json({
    presets,
    maleVipTable: MALE_VIP,
    femaleVipTable: FEMALE_VIP,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action?: string;
    userId?: string;
    level?: number;
    spendBrl?: number;
    earningsBrl?: number;
  };

  if (body.action === "reset") {
    const db = await resetDb();
    return NextResponse.json({
      ok: true,
      notice: "Banco JSON reinicializado com seeds.",
      users: db.users.length,
    });
  }

  if (body.action === "switch" && body.userId) {
    const db = await readDb();
    const user = db.users.find((u) => u.id === body.userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    await setSessionUserId(user.id);
    return NextResponse.json({ user: publicUser(user) });
  }

  const userId = body.userId || (await getSessionUserId());
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão / userId" }, { status: 401 });
  }

  if (body.action === "set_male_vip") {
    const level = Number(body.level);
    const target = MALE_VIP.find((l) => l.level === level);
    if (!target) {
      return NextResponse.json({ error: "Nível VIP masculino 1–12" }, { status: 400 });
    }
    const { result } = await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return null;
      user.cumulativeSpendBrl = target.minSpendBrl;
      db.ledger.push({
        id: uuid(),
        userId,
        type: "credit_purchase",
        amountBrl: target.minSpendBrl,
        creditsDelta: 0,
        description: `Debug: simular gasto acumulado → ${target.label} (${formatBrl(target.minSpendBrl)})`,
        createdAt: new Date().toISOString(),
      });
      return publicUser(user);
    });
    if (!result) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ user: result });
  }

  if (body.action === "set_spend") {
    const spend = Number(body.spendBrl);
    if (!Number.isFinite(spend) || spend < 0) {
      return NextResponse.json({ error: "spendBrl inválido" }, { status: 400 });
    }
    const { result } = await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return null;
      user.cumulativeSpendBrl = spend;
      return publicUser(user);
    });
    if (!result) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ user: result });
  }

  if (body.action === "set_female_vip") {
    const level = Number(body.level);
    const target = FEMALE_VIP.find((l) => l.level === level);
    if (!target) {
      return NextResponse.json({ error: "Nível VIP feminino 1–12" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { result } = await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return null;

      const prevLevel =
        FEMALE_VIP.filter((l) => user.cumulativeEarningsBrl >= l.minEarningsBrl).pop()
          ?.level ?? 0;

      user.cumulativeEarningsBrl = target.minEarningsBrl;

      // Grant bonuses for newly reached levels (including target if jumping up)
      if (target.level > prevLevel) {
        for (const lvl of FEMALE_VIP) {
          if (lvl.level > prevLevel && lvl.level <= target.level) {
            user.balanceBrl = Number((user.balanceBrl + lvl.bonusBrl).toFixed(2));
            db.ledger.push({
              id: uuid(),
              userId,
              type: "vip_bonus",
              amountBrl: lvl.bonusBrl,
              creditsDelta: 0,
              description: `Debug VIP${lvl.level} — ${lvl.title} (+${formatBrl(lvl.bonusBrl)})`,
              createdAt: now,
            });
          }
        }
      }

      db.ledger.push({
        id: uuid(),
        userId,
        type: "creator_earning",
        amountBrl: 0,
        creditsDelta: 0,
        description: `Debug: simular ganhos acumulados → VIP${target.level} (${formatBrl(target.minEarningsBrl)})`,
        createdAt: now,
      });

      return publicUser(user);
    });
    if (!result) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ user: result });
  }

  if (body.action === "set_earnings") {
    const earnings = Number(body.earningsBrl);
    if (!Number.isFinite(earnings) || earnings < 0) {
      return NextResponse.json({ error: "earningsBrl inválido" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { result } = await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return null;
      const prevLevel =
        FEMALE_VIP.filter((l) => user.cumulativeEarningsBrl >= l.minEarningsBrl).pop()
          ?.level ?? 0;
      user.cumulativeEarningsBrl = earnings;
      const newLevel =
        FEMALE_VIP.filter((l) => user.cumulativeEarningsBrl >= l.minEarningsBrl).pop()
          ?.level ?? 0;
      if (newLevel > prevLevel) {
        for (const lvl of FEMALE_VIP) {
          if (lvl.level > prevLevel && lvl.level <= newLevel) {
            user.balanceBrl = Number((user.balanceBrl + lvl.bonusBrl).toFixed(2));
            db.ledger.push({
              id: uuid(),
              userId,
              type: "vip_bonus",
              amountBrl: lvl.bonusBrl,
              creditsDelta: 0,
              description: `Debug VIP${lvl.level} — ${lvl.title} (+${formatBrl(lvl.bonusBrl)})`,
              createdAt: now,
            });
          }
        }
      }
      return publicUser(user);
    });
    if (!result) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ user: result });
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
}
