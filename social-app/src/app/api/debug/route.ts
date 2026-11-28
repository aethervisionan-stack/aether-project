import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import { avatarDataUrl } from "@/lib/avatar";
import {
  FREE_PHOTOS,
  PHOTO_CREDITS_COST,
  countPhotosInScope,
  creditOnlineHour,
  ensureConversation,
  platformSummary,
  serializePhotoForViewer,
} from "@/lib/economy";
import { DEBUG_PRESETS } from "@/lib/seed";
import { getSessionUserId, setSessionUserId } from "@/lib/session";
import { readDb, resetDb, updateDb } from "@/lib/store";
import type { FreePhotoScope, Message } from "@/lib/types";
import { FEMALE_VIP, MALE_VIP, formatBrl } from "@/lib/vip";

export const runtime = "nodejs";

function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join("__");
}

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
    settings: db.settings,
    platform: platformSummary(db),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action?: string;
    userId?: string;
    level?: number;
    spendBrl?: number;
    earningsBrl?: number;
    freePhotoScope?: FreePhotoScope;
    includeHourPayInVip?: boolean;
    hourlyRateBrl?: number;
    minutes?: number;
    toUserId?: string;
    photoCount?: number;
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

  if (body.action === "set_settings") {
    const { result } = await updateDb((db) => {
      if (body.freePhotoScope) {
        db.settings.freePhotoScope = body.freePhotoScope;
      }
      if (typeof body.includeHourPayInVip === "boolean") {
        db.settings.includeHourPayInVip = body.includeHourPayInVip;
      }
      if (typeof body.hourlyRateBrl === "number" && Number.isFinite(body.hourlyRateBrl)) {
        db.settings.defaultHourlyRateBrl = body.hourlyRateBrl;
      }
      return db.settings;
    });
    return NextResponse.json({ settings: result, notice: "Config debug atualizada" });
  }

  if (body.action === "platform_summary") {
    const db = await readDb();
    return NextResponse.json({ platform: platformSummary(db) });
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
              description: `Debug Bônus VIP Feminino VIP${lvl.level} — ${lvl.title} (+${formatBrl(lvl.bonusBrl)})`,
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

  if (body.action === "reset_photo_counter") {
    const { result } = await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return { error: "Usuário não encontrado", status: 404 as const };

      // Clear photo messages involving this user as recipient (male) or wipe freePhotosUsed
      user.freePhotosUsed = 0;
      const toRemove = new Set(
        db.messages
          .filter((m) => m.kind === "photo" && (m.toUserId === userId || m.fromUserId === userId))
          .map((m) => m.id)
      );
      db.messages = db.messages.filter((m) => !toRemove.has(m.id));
      return {
        user: publicUser(user),
        removed: toRemove.size,
        notice: `Contador de fotos resetado (${toRemove.size} fotos removidas).`,
      };
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: result.status ?? 400 });
    }
    return NextResponse.json(result);
  }

  if (body.action === "send_test_photo") {
    const toUserId = body.toUserId || "debug-homem-comum";
    const now = new Date().toISOString();
    const { result } = await updateDb((db) => {
      const from = db.users.find((u) => u.id === userId);
      const to = db.users.find((u) => u.id === toUserId);
      if (!from || !to) return { error: "Usuário não encontrado", status: 404 as const };
      if (from.gender !== "mulher") {
        return { error: "Troque para Mulher Criadora para enviar foto teste", status: 400 as const };
      }
      const cid = conversationIdFor(from.id, to.id);
      const prior = countPhotosInScope(db, from.id, to.id, cid);
      const photoIndex = prior + 1;
      const isFree = photoIndex <= FREE_PHOTOS;
      if (db.settings.freePhotoScope === "per_male_user" && isFree) {
        to.freePhotosUsed += 1;
      }
      const message: Message = {
        id: uuid(),
        conversationId: cid,
        fromUserId: from.id,
        toUserId: to.id,
        text: isFree ? `Foto teste grátis #${photoIndex}` : `Foto teste paga #${photoIndex}`,
        kind: "photo",
        createdAt: now,
        paid: false,
        platformShareBrl: 0,
        creatorShareBrl: 0,
        photoUrl: avatarDataUrl(`T${photoIndex}`, isFree ? "#3D6B5A" : "#A65D4A"),
        photoIndex,
        photoFree: isFree,
        photoCreditsCost: isFree ? 0 : PHOTO_CREDITS_COST,
        photoUnlocked: isFree,
        photoViewStatus: isFree ? "available" : "locked",
        photoViewedAt: null,
        photoUnlockedAt: isFree ? now : null,
        photoUnlockedBy: isFree ? to.id : null,
      };
      db.messages.push(message);
      ensureConversation(
        db,
        from.id,
        to.id,
        isFree ? `📷 Teste grátis #${photoIndex}` : `📷 Teste paga #${photoIndex}`,
        now
      );
      return {
        message: serializePhotoForViewer(message, userId),
        photoIndex,
        isFree,
        notice: `Foto teste #${photoIndex} (${isFree ? "grátis" : "paga"}) → ${to.name}`,
      };
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: result.status ?? 400 });
    }
    return NextResponse.json(result);
  }

  if (body.action === "set_hourly_rate") {
    const rate = Number(body.hourlyRateBrl);
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: "Taxa inválida" }, { status: 400 });
    }
    const { result } = await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return null;
      user.hourlyRateBrl = rate;
      return publicUser(user);
    });
    if (!result) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ user: result });
  }

  if (body.action === "simulate_online_hours") {
    const minutes = Math.max(1, Math.floor(Number(body.minutes) || 60));
    const now = new Date().toISOString();
    const { result } = await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return { error: "Usuário não encontrado", status: 404 as const };
      if (user.gender !== "mulher") {
        return { error: "Só criadoras", status: 400 as const };
      }
      user.onlineMinutesToday += minutes;
      const { amount } = creditOnlineHour(db, user, minutes, now);
      return {
        user: publicUser(user),
        creditedBrl: amount,
        notice: `Simulados ${minutes} min · R$ ${amount.toFixed(2)}`,
      };
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: result.status ?? 400 });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
}
