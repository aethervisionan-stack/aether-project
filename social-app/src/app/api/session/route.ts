import { NextResponse } from "next/server";
import { publicUser } from "@/lib/api";
import { clearSession, setSessionUserId } from "@/lib/session";
import { readDb } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { userId?: string };
  if (!body.userId) {
    return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === body.userId);
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  await setSessionUserId(user.id);
  return NextResponse.json({ user: publicUser(user) });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
