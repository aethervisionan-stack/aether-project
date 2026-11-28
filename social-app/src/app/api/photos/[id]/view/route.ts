import { NextResponse } from "next/server";
import { publicUser } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";
import { updateDb } from "@/lib/store";

export const runtime = "nodejs";

/** Open view-once photo (returns URL once). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action ?? "open";
  const now = new Date().toISOString();

  const { result } = await updateDb((db) => {
    const viewer = db.users.find((u) => u.id === userId);
    const message = db.messages.find((m) => m.id === id);
    if (!viewer || !message || message.kind !== "photo") {
      return { error: "Foto não encontrada", status: 404 as const };
    }

    const isSender = message.fromUserId === userId;
    const isRecipient = message.toUserId === userId;
    if (!isSender && !isRecipient) {
      return { error: "Sem acesso", status: 403 as const };
    }

    if (action === "close") {
      if (isRecipient && message.photoUnlocked && message.photoViewStatus !== "expired_viewed") {
        message.photoViewStatus = "expired_viewed";
        message.photoViewedAt = now;
        // Wipe URL after unique view for recipient
        message.photoUrl = undefined;
      }
      return {
        message: {
          ...message,
          photoUrl: isSender ? message.photoUrl : undefined,
          text: "Visualização única encerrada — foto expirada",
        },
        user: publicUser(viewer),
        expired: true,
      };
    }

    // open
    if (isRecipient) {
      if (message.photoViewStatus === "expired_viewed") {
        return {
          error: "Visualização única encerrada — foto expirada",
          status: 410 as const,
        };
      }
      if (!message.photoUnlocked) {
        return {
          error: "Desbloqueie a foto primeiro (5 créditos).",
          status: 402 as const,
        };
      }
    }

    return {
      message: {
        id: message.id,
        photoUrl: message.photoUrl,
        photoViewStatus: message.photoViewStatus,
        photoFree: message.photoFree,
        photoIndex: message.photoIndex,
        watermark: `${viewer.name} · ${viewer.id.slice(0, 8)}`,
      },
      notice:
        "Visualização única: ao fechar, a foto expira e não pode ser reaberta. Em apps nativos: bloquear screenshots + URLs assinadas temporárias.",
      user: publicUser(viewer),
    };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.status ?? 400 });
  }
  return NextResponse.json(result);
}
