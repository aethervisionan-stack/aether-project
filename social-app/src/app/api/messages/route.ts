import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";
import { readDb, updateDb } from "@/lib/store";
import {
  CREATOR_SHARE_BRL,
  FEMALE_VIP,
  PLATFORM_SHARE_BRL,
  freeMessagesAllowance,
  todayKey,
} from "@/lib/vip";

export const runtime = "nodejs";

function conversationIdFor(a: string, b: string) {
  return [a, b].sort().join("__");
}

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const withUserId = searchParams.get("with");
  const db = await readDb();

  if (withUserId) {
    const cid = conversationIdFor(userId, withUserId);
    const messages = db.messages
      .filter((m) => m.conversationId === cid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return NextResponse.json({ conversationId: cid, messages });
  }

  const conversations = db.conversations
    .filter((c) => c.participantIds.includes(userId))
    .map((c) => {
      const otherId = c.participantIds.find((id) => id !== userId)!;
      const other = db.users.find((u) => u.id === otherId);
      return {
        ...c,
        other: other ? publicUser(other) : null,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }

  const body = (await req.json()) as { toUserId?: string; text?: string };
  const toUserId = body.toUserId;
  const text = (body.text ?? "").trim();
  if (!toUserId || !text) {
    return NextResponse.json(
      { error: "Destinatário e texto são obrigatórios." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const cid = conversationIdFor(userId, toUserId);

  const { result } = await updateDb((db) => {
    const from = db.users.find((u) => u.id === userId);
    const to = db.users.find((u) => u.id === toUserId);
    if (!from || !to) return { error: "Usuário não encontrado", status: 404 as const };
    if (!from.verified) {
      return { error: "Verifique sua identidade para enviar mensagens.", status: 403 as const };
    }
    if (!to.verified) {
      return { error: "Só é possível conversar com perfis verificados.", status: 400 as const };
    }

    let paid = false;
    let platformShareBrl = 0;
    let creatorShareBrl = 0;

    // Men pay when messaging women (creators). Women messaging is free in this prototype.
    if (from.gender === "homem" && to.gender === "mulher") {
      if (from.freeMessagesDate !== todayKey()) {
        from.freeMessagesDate = todayKey();
        from.freeMessagesUsed = 0;
      }
      const allowance = freeMessagesAllowance(from.cumulativeSpendBrl);
      const hasFree =
        allowance === "unlimited" || from.freeMessagesUsed < allowance;

      if (hasFree) {
        if (allowance !== "unlimited") from.freeMessagesUsed += 1;
      } else {
        if (from.credits < 1) {
          return {
            error:
              "Sem mensagens grátis e sem créditos. Compre créditos (R$0,40 cada) para continuar.",
            status: 402 as const,
            needsCredits: true,
          };
        }
        from.credits -= 1;
        paid = true;
        platformShareBrl = PLATFORM_SHARE_BRL;
        creatorShareBrl = CREATOR_SHARE_BRL;

        const prevLevel =
          FEMALE_VIP.filter((l) => to.cumulativeEarningsBrl >= l.minEarningsBrl).pop()
            ?.level ?? 0;

        to.balanceBrl = Number((to.balanceBrl + creatorShareBrl).toFixed(2));
        to.cumulativeEarningsBrl = Number(
          (to.cumulativeEarningsBrl + creatorShareBrl).toFixed(2)
        );

        const newLevel =
          FEMALE_VIP.filter((l) => to.cumulativeEarningsBrl >= l.minEarningsBrl).pop()
            ?.level ?? 0;

        db.ledger.push({
          id: uuid(),
          userId: from.id,
          type: "message_spend",
          amountBrl: -(platformShareBrl + creatorShareBrl),
          creditsDelta: -1,
          description: `Mensagem paga para ${to.name}`,
          createdAt: now,
        });
        db.ledger.push({
          id: uuid(),
          userId: to.id,
          type: "creator_earning",
          amountBrl: creatorShareBrl,
          creditsDelta: 0,
          description: `Ganho de mensagem de ${from.name}`,
          createdAt: now,
        });
        db.ledger.push({
          id: uuid(),
          userId: "platform",
          type: "platform_fee",
          amountBrl: platformShareBrl,
          creditsDelta: 0,
          description: `Taxa plataforma — msg ${from.name} → ${to.name}`,
          createdAt: now,
        });

        // Grant VIP bonus when crossing into a new female VIP level
        if (newLevel > prevLevel) {
          for (const lvl of FEMALE_VIP) {
            if (lvl.level > prevLevel && lvl.level <= newLevel) {
              to.balanceBrl = Number((to.balanceBrl + lvl.bonusBrl).toFixed(2));
              db.ledger.push({
                id: uuid(),
                userId: to.id,
                type: "vip_bonus",
                amountBrl: lvl.bonusBrl,
                creditsDelta: 0,
                description: `Bônus VIP${lvl.level} — ${lvl.title} (+${lvl.bonusBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`,
                createdAt: now,
              });
            }
          }
        }
      }
    }

    const message = {
      id: uuid(),
      conversationId: cid,
      fromUserId: from.id,
      toUserId: to.id,
      text,
      createdAt: now,
      paid,
      platformShareBrl,
      creatorShareBrl,
    };
    db.messages.push(message);

    let conv = db.conversations.find((c) => c.id === cid);
    if (!conv) {
      conv = {
        id: cid,
        participantIds: [from.id, to.id],
        updatedAt: now,
        lastMessagePreview: text.slice(0, 80),
      };
      db.conversations.push(conv);
    } else {
      conv.updatedAt = now;
      conv.lastMessagePreview = text.slice(0, 80);
    }

    return {
      message,
      from: publicUser(from),
      to: publicUser(to),
    };
  });

  if ("error" in result) {
    return NextResponse.json(result, { status: result.status ?? 400 });
  }

  return NextResponse.json(result);
}
