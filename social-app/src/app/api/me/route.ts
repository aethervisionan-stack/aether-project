import { NextResponse } from "next/server";
import { publicUser } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";
import { readDb } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ user: null });
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: publicUser(user) });
}
