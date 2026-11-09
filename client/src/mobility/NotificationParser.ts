/**
 * Client-side smart notification parser → actionable operational summaries.
 * Mirrors backend/app/mobility/notifications.py for offline/HUD preview.
 */

import type {
  NotificationActionView,
  NotificationPriority,
  RawNotificationInput,
} from "../types/mobility";

const LATE_RE = /(atrasad|atrasar|late|chegar|arrive|chegada|on my way|a caminho)/i;
const MEETING_RE = /(reuni[aã]o|meeting|call|zoom|teams|hangouts)/i;
const ASK_RE = /(pergunt|asked|ask(?:ed)?|quer saber|pode|can you|could you|\?)/i;
const URGENT_RE = /(urgent|urgente|asap|emerg|911|sos|critical|cr[ií]tic)/i;

export function parseNotificationLocal(input: RawNotificationInput): NotificationActionView {
  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").trim();
  const raw = (input.raw ?? "").trim() || `${title}\n${body}`.trim();
  const text = raw || title || body;
  const who =
    (input.sender ?? "").trim() ||
    guessSender(title, text) ||
    "Someone";
  const titleS = title || guessTitle(text);
  const bodyS = body || text;

  let summary: string;
  let suggested: string | null = null;

  if (LATE_RE.test(text) && ASK_RE.test(text)) {
    summary = `${who} asked if you'll be late. Reply that you arrive in 10 min?`;
    suggested = "I'll arrive in about 10 minutes.";
  } else if (MEETING_RE.test(text) && ASK_RE.test(text)) {
    summary = `${who} messaged about a meeting. Confirm you'll join on time?`;
    suggested = "Yes — I'll be there on time.";
  } else if (ASK_RE.test(text)) {
    summary = `${who} asked something. Draft a short yes/ack reply?`;
    suggested = "Got it — I'll get back to you shortly.";
  } else {
    summary = `New from ${who}: ${clip(bodyS || titleS, 120)}. Read aloud or dismiss?`;
  }

  const priority: NotificationPriority = URGENT_RE.test(text) ? "critical" : "normal";

  return {
    id: `n${Date.now().toString(36)}`,
    source: (input.source ?? "unknown").trim() || "unknown",
    title: titleS.slice(0, 160),
    body: clip(bodyS, 400),
    summary,
    suggested_reply: suggested,
    awaiting_confirmation: true,
    priority,
    created_at: Date.now() / 1000,
  };
}

function guessSender(title: string, text: string): string | null {
  const candidates = [title, text.includes(":") ? text.split(":", 1)[0] : ""];
  for (const candidate of candidates) {
    const cleaned = candidate.trim();
    if (!cleaned || cleaned.length > 40) continue;
    if (!/^[\w][\w .\-]{1,38}$/u.test(cleaned)) continue;
    const lower = cleaned.toLowerCase();
    if (["sms", "whatsapp", "telegram", "mail", "gmail", "slack"].includes(lower)) {
      continue;
    }
    return cleaned;
  }
  return null;
}

function guessTitle(text: string): string {
  const first = (text.split("\n", 1)[0] ?? "").trim();
  return first ? first.slice(0, 80) : "Notification";
}

function clip(value: string, n: number): string {
  const s = value.trim();
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).trimEnd()}…`;
}
