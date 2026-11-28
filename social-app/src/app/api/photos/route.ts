import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import { avatarDataUrl } from "@/lib/avatar";
import {
  FREE_PHOTOS,
  PHOTO_CREDITS_COST,
  PHOTO_CREATOR_SHARE_BRL,
  PHOTO_PLATFORM_SHARE_BRL,
  PHOTO_PRICE_BRL,
  countPhotosInScope,
  creditCreatorCommission,
  ensureConversation,
  serializePhotoForViewer,
} from "@/lib/economy";
import { getSessionUserId } from "@/lib/session";
import { updateDb } from "@/lib/store";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";

function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join("__");
}

/** Creator sends a view-once photo to a male user. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }

  const body = (await req.json()) as {
    toUserId?: string;
    photoUrl?: string;
    caption?: string;
  };
  const toUserId = body.toUserId;
  if (!toUserId) {
    return NextResponse.json({ error: "toUserId obrigatório" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const cid = conversationIdFor(userId, toUserId);

  const { result } = await updateDb((db) => {
    const from = db.users.find((u) => u.id === userId);
    const to = db.users.find((u) => u.id === toUserId);
    if (!from || !to) return { error: "Usuário não encontrado", status: 404 as const };
    if (from.gender !== "mulher") {
      return {
        error: "Somente criadoras enviam fotos neste protótipo.",
        status: 400 as const,
      };
    }
    if (to.gender !== "homem") {
      return {
        error: "Fotos pagas são enviadas para contas masculinas.",
        status: 400 as const,
      };
    }
    if (!from.verified || !to.verified) {
      return { error: "Ambos precisam estar verificados.", status: 403 as const };
    }

    const prior = countPhotosInScope(db, from.id, to.id, cid);
    const photoIndex = prior + 1;
    const isFree = photoIndex <= FREE_PHOTOS;

    if (db.settings.freePhotoScope === "per_male_user" && isFree) {
      to.freePhotosUsed = (to.freePhotosUsed ?? 0) + 1;
    }

    const photoUrl =
      body.photoUrl ||
      avatarDataUrl(`F${photoIndex}`, isFree ? "#3D6B5A" : "#8B5A2B");

    const message: Message = {
      id: uuid(),
      conversationId: cid,
      fromUserId: from.id,
      toUserId: to.id,
      text: body.caption?.trim() || (isFree ? `Foto grátis #${photoIndex}` : `Foto paga #${photoIndex}`),
      kind: "photo",
      createdAt: now,
      paid: false,
      platformShareBrl: 0,
      creatorShareBrl: 0,
      photoUrl,
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
      isFree ? `📷 Foto grátis #${photoIndex}` : `📷 Foto bloqueada #${photoIndex}`,
      now
    );

    return {
      message: serializePhotoForViewer(message, userId),
      from: publicUser(from),
      to: publicUser(to),
      photoIndex,
      isFree,
      notice: isFree
        ? `Foto #${photoIndex} grátis (visualização única). Escopo: ${db.settings.freePhotoScope}.`
        : `Foto #${photoIndex} paga — desbloqueio: ${PHOTO_CREDITS_COST} créditos (${PHOTO_PRICE_BRL.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}).`,
    };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.status ?? 400 });
  }
  return NextResponse.json(result);
}
