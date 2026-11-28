import { NextResponse } from "next/server";
import { publicUser } from "@/lib/api";
import { creditOnlineHour } from "@/lib/economy";
import { getSessionUserId } from "@/lib/session";
import { readDb, updateDb } from "@/lib/store";
import type { ShiftStatus } from "@/lib/types";
import { todayKey } from "@/lib/vip";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  return NextResponse.json({
    user: publicUser(user),
    settings: db.settings,
    activityTarget: db.settings.activityTargetMinutesPerHour,
  });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action?: string;
    status?: ShiftStatus;
    hourlyRateBrl?: number;
    minutes?: number;
  };
  const now = new Date().toISOString();

  const { result } = await updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { error: "Usuário não encontrado", status: 404 as const };
    if (user.gender !== "mulher") {
      return { error: "Somente criadoras usam Hora Online", status: 400 as const };
    }

    if (user.onlineMinutesDate !== todayKey()) {
      user.onlineMinutesDate = todayKey();
      user.onlineMinutesToday = 0;
      user.activityScore = 0;
    }

    if (body.action === "set_rate") {
      const rate = Number(body.hourlyRateBrl);
      if (!Number.isFinite(rate) || rate < 0) {
        return { error: "Taxa inválida", status: 400 as const };
      }
      user.hourlyRateBrl = rate;
      return { user: publicUser(user), notice: `Taxa: R$ ${rate.toFixed(2)}/h` };
    }

    if (body.action === "set_status") {
      const status = body.status;
      if (!status || !["offline", "active", "paused"].includes(status)) {
        return { error: "Status inválido", status: 400 as const };
      }
      user.shiftStatus = status;
      if (status === "active") {
        user.shiftStartedAt = now;
      } else if (status === "offline") {
        user.shiftStartedAt = null;
      }
      const labels = {
        offline: "Offline",
        active: "Em Turno Ativo",
        paused: "Pausado",
      } as const;
      return { user: publicUser(user), notice: `Turno: ${labels[status]}` };
    }

    if (body.action === "simulate_minutes") {
      const minutes = Math.max(1, Math.floor(Number(body.minutes) || 0));
      user.onlineMinutesToday += minutes;
      user.activityScore = Math.min(
        100,
        user.activityScore + Math.round((minutes / db.settings.activityTargetMinutesPerHour) * 100)
      );
      const { amount } = creditOnlineHour(db, user, minutes, now);
      return {
        user: publicUser(user),
        creditedBrl: amount,
        notice: `+${minutes} min simulados · creditado R$ ${amount.toFixed(2)}`,
      };
    }

    if (body.action === "add_hour") {
      const minutes = 60;
      user.onlineMinutesToday += minutes;
      user.activityScore = Math.min(100, user.activityScore + 100);
      const { amount } = creditOnlineHour(db, user, minutes, now);
      return {
        user: publicUser(user),
        creditedBrl: amount,
        notice: `+1h turno online · creditado R$ ${amount.toFixed(2)}`,
      };
    }

    return { error: "Ação desconhecida", status: 400 as const };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.status ?? 400 });
  }
  return NextResponse.json(result);
}
