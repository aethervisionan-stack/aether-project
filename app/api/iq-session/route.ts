import { NextResponse } from "next/server";
import {
  extractSessionIdFromOrderNsu,
  getIqQuizSnapshot,
  getIqUnlockSession,
  saveIqQuizSnapshot,
} from "@/lib/iq-payment/sessionUnlock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeSessionId(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || !/^iq_[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

function looksLikeQuizSnapshot(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.sessionId === "string" &&
    typeof o.mode === "string" &&
    (o.phase === "results" || o.phase === "review") &&
    o.result != null &&
    typeof o.result === "object"
  );
}

/** GET /api/iq-session?sessionId=iq_… — restore quiz snapshot after payment return. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromQuery = sanitizeSessionId(url.searchParams.get("sessionId"));
  const fromOrder = extractSessionIdFromOrderNsu(
    url.searchParams.get("order_nsu"),
  );
  const sessionId = fromQuery || sanitizeSessionId(fromOrder);
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "sessionId inválido", code: "BAD_SESSION" },
      { status: 400 },
    );
  }

  const unlock = await getIqUnlockSession(sessionId);
  const quizSnapshot = (await getIqQuizSnapshot(sessionId)) ?? null;
  return NextResponse.json({
    ok: true,
    sessionId,
    hasQuizSnapshot: Boolean(quizSnapshot),
    quizSnapshot,
    resultUnlocked: Boolean(unlock?.resultUnlocked),
    aiUnlocked: Boolean(unlock?.aiUnlocked),
    unlocked: Boolean(unlock?.resultUnlocked),
  });
}

/** POST /api/iq-session — persist completed quiz for InfinitePay return restore. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: unknown;
      quizSnapshot?: unknown;
    };
    const sessionId = sanitizeSessionId(
      typeof body.sessionId === "string" ? body.sessionId : "",
    );
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "sessionId inválido", code: "BAD_SESSION" },
        { status: 400 },
      );
    }
    if (!looksLikeQuizSnapshot(body.quizSnapshot)) {
      return NextResponse.json(
        {
          ok: false,
          error: "quizSnapshot inválido (precisa phase results/review + result)",
          code: "BAD_SNAPSHOT",
        },
        { status: 400 },
      );
    }

    // Cap oversized avatars so Neon / memory stay healthy.
    const snap = { ...body.quizSnapshot };
    if (
      typeof snap.participantAvatarUrl === "string" &&
      snap.participantAvatarUrl.length > 120_000
    ) {
      snap.participantAvatarUrl = null;
    }
    snap.sessionId = sessionId;

    await saveIqQuizSnapshot(sessionId, snap);
    console.info("[iq-session] snapshot saved", {
      sessionId,
      mode: snap.mode,
      phase: snap.phase,
    });
    return NextResponse.json({ ok: true, sessionId });
  } catch (err) {
    console.error("[iq-session] save failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao salvar sessão",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
