import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import {
  PHOTO_CREDITS_COST,
  PHOTO_CREATOR_SHARE_BRL,
  PHOTO_PLATFORM_SHARE_BRL,
  PHOTO_PRICE_BRL,
  creditCreatorCommission,
  serializePhotoForViewer,
} from "@/lib/economy";
import { getSessionUserId } from "@/lib/session";
import { updateDb } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const now = new Date().toISOString();

  const { result } = await updateDb((db) => {
    const viewer = db.users.find((u) => u.id === userId);
    const message = db.messages.find((m) => m.id === id);
    if (!viewer || !message) {
      return { error: "Não encontrado", status: 404 as const };
    }
    if (message.kind !== "photo") {
      return { error: "Não é uma foto", status: 400 as const };
    }
    if (message.toUserId !== userId) {
      return { error: "Só o destinatário pode desbloquear", status: 403 as const };
    }
    if (message.photoViewStatus === "expired_viewed") {
      return { error: "Foto já expirada", status: 400 as const };
    }
    if (message.photoUnlocked) {
      return {
        message: serializePhotoForViewer(message, userId),
        user: publicUser(viewer),
        notice: "Já desbloqueada",
      };
    }
    if (message.photoFree) {
      message.photoUnlocked = true;
      message.photoViewStatus = "available";
      return {
        message: serializePhotoForViewer(message, userId),
        user: publicUser(viewer),
      };
    }

    if (viewer.credits < PHOTO_CREDITS_COST) {
      return {
        error: `Créditos insuficientes. Precisa de ${PHOTO_CREDITS_COST} créditos (R$ ${PHOTO_PRICE_BRL.toFixed(2)}).`,
        status: 402 as const,
        needsCredits: true,
      };
    }

    const creator = db.users.find((u) => u.id === message.fromUserId);
    if (!creator) return { error: "Criadora não encontrada", status: 404 as const };

    viewer.credits -= PHOTO_CREDITS_COST;
    message.photoUnlocked = true;
    message.photoViewStatus = "available";
    message.photoUnlockedAt = now;
    message.photoUnlockedBy = viewer.id;
    message.paid = true;
    message.platformShareBrl = PHOTO_PLATFORM_SHARE_BRL;
    message.creatorShareBrl = PHOTO_CREATOR_SHARE_BRL;

    db.ledger.push({
      id: uuid(),
      userId: viewer.id,
      type: "photo_spend",
      amountBrl: -PHOTO_PRICE_BRL,
      creditsDelta: -PHOTO_CREDITS_COST,
      description: `Desbloquear foto — ${PHOTO_CREDITS_COST} créditos (R$ ${PHOTO_PRICE_BRL.toFixed(2)}) de ${creator.name}`,
      relatedMessageId: message.id,
      createdAt: now,
    });

    creditCreatorCommission(db, creator, PHOTO_CREATOR_SHARE_BRL, now, {
      type: "creator_photo",
      description: `Fotos pagas R$1,00 — de ${viewer.name}`,
      relatedMessageId: message.id,
    });

    db.ledger.push({
      id: uuid(),
      userId: "platform",
      type: "platform_photo_fee",
      amountBrl: PHOTO_PLATFORM_SHARE_BRL,
      creditsDelta: 0,
      description: `Taxa plataforma — foto ${viewer.name} ← ${creator.name}`,
      relatedMessageId: message.id,
      createdAt: now,
    });

    return {
      message: serializePhotoForViewer(message, userId),
      user: publicUser(viewer),
      creator: publicUser(creator),
      notice: `Foto desbloqueada. Split 50/50: R$1,00 plataforma + R$1,00 criadora.`,
    };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.status ?? 400 });
  }
  return NextResponse.json(result);
}
