import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { publicUser } from "@/lib/api";
import { avatarDataUrl } from "@/lib/avatar";
import { setSessionUserId } from "@/lib/session";
import { readDb, updateDb } from "@/lib/store";
import type { Gender, User } from "@/lib/types";
import { todayKey } from "@/lib/vip";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gender = searchParams.get("gender") as Gender | null;
  const verifiedOnly = searchParams.get("verified") === "1";
  const db = await readDb();
  let users = db.users;
  if (gender) users = users.filter((u) => u.gender === gender);
  if (verifiedOnly) users = users.filter((u) => u.verified);
  return NextResponse.json({ users: users.map(publicUser) });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    age?: number;
    gender?: Gender;
    photoUrl?: string;
    bio?: string;
  };

  const name = (body.name ?? "").trim();
  const age = Number(body.age);
  const gender = body.gender;

  if (!name || !gender || !["homem", "mulher"].includes(gender)) {
    return NextResponse.json(
      { error: "Nome e gênero são obrigatórios." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(age) || age < 18) {
    return NextResponse.json(
      {
        error:
          "Cadastro bloqueado: é necessário ter 18 anos ou mais para usar o Aether Social.",
      },
      { status: 400 }
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const newUser: User = {
    id: uuid(),
    name,
    age,
    gender,
    photoUrl:
      body.photoUrl ||
      avatarDataUrl(initials || "?", gender === "homem" ? "#2A3A3F" : "#6B3A3A"),
    verified: false,
    bio: body.bio?.trim() || "",
    credits: 0,
    balanceBrl: 0,
    cumulativeSpendBrl: 0,
    cumulativeEarningsBrl: 0,
    freeMessagesDate: todayKey(),
    freeMessagesUsed: 0,
    isSeed: false,
    createdAt: new Date().toISOString(),
  };

  await updateDb((db) => {
    db.users.push(newUser);
  });
  await setSessionUserId(newUser.id);

  return NextResponse.json({ user: publicUser(newUser) });
}
