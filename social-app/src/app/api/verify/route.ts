import { NextResponse } from "next/server";
import { publicUser } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";
import { updateDb } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sem sessão" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { selfieDataUrl?: string };
  // selfieDataUrl is accepted but never stored permanently beyond the badge —
  // simulated facial verification for localhost prototype.

  const { result } = await updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    user.verified = true;
    if (body.selfieDataUrl && body.selfieDataUrl.startsWith("data:image")) {
      // Optional: keep as profile photo if user wants (simulated "match")
      // We leave profile photo unchanged; verification only grants badge.
    }
    return publicUser(user);
  });

  if (!result) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    user: result,
    notice:
      "Verificação facial simulada. A foto é usada apenas para reconhecimento facial / identidade, para evitar perfis falsos e golpes. Em produção, a imagem não seria armazenada como mídia pública.",
  });
}
