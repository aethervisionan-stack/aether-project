/** Active productivity voice command helpers (client preview + WS payload). */

import type { ProductivityIntentView } from "../types/mobility";

const REMINDER_RE =
  /^(?:remind me|lembra(?:r)?(?:[- ]me)?|me lembra|set a reminder)\s*(?:to|de|que)?\s*(.+)$/i;
const NOTE_RE =
  /^(?:note|nota|insight|anota(?:r)?|save note|salva(?:r)? nota)\s*[:\-]?\s*(.+)$/i;
const APPT_RE =
  /^(?:schedule|agendar?|marcar|book|appointment|reuni[aã]o)\s*(?:a|an|um|uma)?\s*(.+)$/i;
const WHEN_RE =
  /\b(?:at|às|as|em|on|tomorrow|amanhã|hoje|today|in \d+\s*(?:min|minutes|mins|h|hours?))\b.*$/i;

export function parseProductivityLocal(text: string): ProductivityIntentView {
  const cleaned = text.trim();
  const id = `p${Date.now().toString(36)}`;
  const created_at = Date.now() / 1000;
  if (!cleaned) {
    return { id, kind: "unknown", title: "", detail: "", ok: false, created_at };
  }

  let m = cleaned.match(REMINDER_RE);
  if (m?.[1]) {
    const body = m[1].trim();
    const when = extractWhen(body);
    const title = stripWhen(body) || "Reminder";
    return {
      id,
      kind: "reminder",
      title: title.slice(0, 120),
      detail: body.slice(0, 400),
      when_hint: when,
      memory_note: `Reminder: ${title}${when ? ` (${when})` : ""}`,
      ok: true,
      created_at,
    };
  }

  m = cleaned.match(NOTE_RE);
  if (m?.[1]) {
    const body = m[1].trim();
    return {
      id,
      kind: "note",
      title: clip(body, 80) || "Insight note",
      detail: body.slice(0, 600),
      memory_note: `Insight note: ${body.slice(0, 280)}`,
      ok: true,
      created_at,
    };
  }

  m = cleaned.match(APPT_RE);
  if (m?.[1]) {
    const body = m[1].trim();
    const when = extractWhen(body);
    const title = stripWhen(body) || "Appointment";
    return {
      id,
      kind: "appointment",
      title: title.slice(0, 120),
      detail: body.slice(0, 400),
      when_hint: when,
      memory_note: `Appointment: ${title}${when ? ` @ ${when}` : ""}`,
      ok: true,
      created_at,
    };
  }

  return {
    id,
    kind: "unknown",
    title: "",
    detail: cleaned.slice(0, 400),
    ok: false,
    created_at,
  };
}

function extractWhen(text: string): string | null {
  const m = text.match(WHEN_RE);
  return m?.[0]?.trim().slice(0, 80) || null;
}

function stripWhen(text: string): string {
  return text.replace(WHEN_RE, "").trim().replace(/^[,.\-\s]+|[,.\-\s]+$/g, "") || text.trim();
}

function clip(value: string, n: number): string {
  const s = value.trim();
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).trimEnd()}…`;
}
