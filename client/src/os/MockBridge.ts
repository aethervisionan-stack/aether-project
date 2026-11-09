/**
 * Mock / web / desktop OS bridge harness when native APIs are unavailable.
 */

import type {
  AccessibilityBridge,
  BridgeResultView,
  CalendarBridge,
  MediaAction,
  MessagingApp,
  MessagingBridge,
  NotificationEventView,
  OsBridgeBundle,
  OsBridgeStatus,
  SoundMode,
  SystemControlBridge,
  TelephonyBridge,
} from "../types/os";

function ok(action: string, detail = "", data: Record<string, unknown> = {}): BridgeResultView {
  return { ok: true, action, detail, data, mock: true };
}

function fail(action: string, error: string): BridgeResultView {
  return { ok: false, action, error, mock: true };
}

class MockMessagingBridge implements MessagingBridge {
  async readThreads(app: MessagingApp, limit = 10): Promise<BridgeResultView> {
    const threads = [
      { contact: "Carlos", preview: "Você vai se atrasar?", unread: 2 },
      { contact: "Ana", preview: "Reunião às 15h", unread: 1 },
    ].slice(0, Math.max(1, Math.min(limit, 20)));
    return ok("read_threads", `${threads.length} threads from ${app}`, { app, threads });
  }

  async summarize(app: MessagingApp, contact: string, limit = 5): Promise<BridgeResultView> {
    const summary = `${contact} on ${app}: last ${limit} messages; latest asks if you'll be late.`;
    return ok("summarize", summary, { app, contact, summary });
  }

  async sendMessage(app: MessagingApp, contact: string, text: string): Promise<BridgeResultView> {
    return ok("send_message", `Sent to ${contact} via ${app}`, {
      message: { app, contact, text, at: Date.now() / 1000 },
    });
  }

  async voiceReply(app: MessagingApp, contact: string, text: string): Promise<BridgeResultView> {
    return this.sendMessage(app, contact, text);
  }
}

class MockCalendarBridge implements CalendarBridge {
  private drafts = new Map<string, Record<string, unknown>>();
  private events = new Map<string, Record<string, unknown>>([
    ["evt_standup", { id: "evt_standup", title: "Standup", when: "today 10:00" }],
  ]);

  async listPriorityEmail(limit = 5): Promise<BridgeResultView> {
    const emails = [
      { from: "ceo@acme.io", subject: "Q4 priorities", priority: "high" },
      { from: "news@digest.dev", subject: "Weekly digest", priority: "low" },
    ].slice(0, limit);
    return ok("list_priority_email", `${emails.length} emails`, { emails });
  }

  async draftEmail(to: string, subject: string, body: string): Promise<BridgeResultView> {
    const id = `draft_${Date.now().toString(36)}`;
    const draft = { id, to, subject, body };
    this.drafts.set(id, draft);
    return ok("draft_email", `Draft ready for ${to}`, { draft });
  }

  async sendDraft(draftId: string): Promise<BridgeResultView> {
    const draft = this.drafts.get(draftId);
    if (!draft) return fail("send_draft", `unknown draft: ${draftId}`);
    this.drafts.delete(draftId);
    return ok("send_draft", "Email sent", { draft });
  }

  async scheduleAppointment(
    title: string,
    when: string,
    durationMin = 30,
    attendees: string[] = [],
  ): Promise<BridgeResultView> {
    const id = `evt_${Date.now().toString(36)}`;
    const event = { id, title, when, duration_min: durationMin, attendees };
    this.events.set(id, event);
    return ok("schedule_appointment", `Scheduled '${title}'`, { event });
  }

  async queryAgenda(day = "today"): Promise<BridgeResultView> {
    return ok("query_agenda", `Agenda for ${day}`, {
      day,
      agenda: [...this.events.values()],
    });
  }

  async deleteEvent(eventId: string): Promise<BridgeResultView> {
    const event = this.events.get(eventId);
    if (!event) return fail("delete_event", `unknown event: ${eventId}`);
    this.events.delete(eventId);
    return ok("delete_event", "Deleted", { event });
  }
}

class MockTelephonyBridge implements TelephonyBridge {
  private incoming: Record<string, unknown> | null = {
    contact: "Carlos",
    number: "+55 11 90000-0000",
  };

  async incomingCall(): Promise<BridgeResultView> {
    if (!this.incoming) return ok("incoming_call", "No active incoming call", { call: null });
    const contact = String(this.incoming.contact || "Unknown");
    const speak = `${contact} is calling. Speaker or decline?`;
    return ok("incoming_call", speak, { call: this.incoming, speak });
  }

  async answer(speaker = false): Promise<BridgeResultView> {
    const call = this.incoming;
    this.incoming = null;
    return ok("answer", `Answered on ${speaker ? "speaker" : "earpiece"}`, { call, speaker });
  }

  async decline(): Promise<BridgeResultView> {
    const call = this.incoming;
    this.incoming = null;
    return ok("decline", "Call declined", { call });
  }

  async placeCall(contact: string): Promise<BridgeResultView> {
    return ok("place_call", `Calling ${contact}`, { call: { contact } });
  }
}

class MockSystemControlBridge implements SystemControlBridge {
  volume = 60;
  soundMode: SoundMode = "normal";
  playing = false;
  batteryPct = 78;

  async media(action: MediaAction): Promise<BridgeResultView> {
    if (action === "play") this.playing = true;
    if (action === "pause" || action === "stop") this.playing = false;
    return ok("media", `Media ${action}`, { action, playing: this.playing });
  }

  async battery(): Promise<BridgeResultView> {
    return ok("battery", `Battery ${this.batteryPct}%`, {
      percent: this.batteryPct,
      charging: false,
    });
  }

  async setVolume(level: number): Promise<BridgeResultView> {
    this.volume = Math.max(0, Math.min(100, Math.round(level)));
    return ok("set_volume", `Volume ${this.volume}%`, { level: this.volume });
  }

  async setSoundMode(mode: SoundMode): Promise<BridgeResultView> {
    this.soundMode = mode;
    return ok("set_sound_mode", `Sound mode ${mode}`, { mode });
  }

  async setTimer(minutes: number, label = ""): Promise<BridgeResultView> {
    return ok("set_timer", `Timer ${minutes} min`, { minutes, label });
  }

  async setAlarm(timeHhmm: string, label = ""): Promise<BridgeResultView> {
    return ok("set_alarm", `Alarm at ${timeHhmm}`, { time: timeHhmm, label });
  }
}

class MockAccessibilityBridge implements AccessibilityBridge {
  private queue: NotificationEventView[] = [
    {
      id: "n_demo_carlos",
      package: "com.whatsapp",
      title: "Carlos",
      body: "Você vai se atrasar?",
      sender: "Carlos",
      app: "whatsapp",
      favorite: true,
      priority_hint: "high",
      screen_lit: false,
      created_at: Date.now() / 1000,
    },
  ];

  platform(): string {
    return "mock";
  }

  async pollNotifications(sinceId?: string | null): Promise<NotificationEventView[]> {
    if (!sinceId) return [...this.queue];
    const idx = this.queue.findIndex((e) => e.id === sinceId);
    return idx >= 0 ? this.queue.slice(idx + 1) : [...this.queue];
  }

  async dismissNotification(notificationId: string): Promise<BridgeResultView> {
    const before = this.queue.length;
    this.queue = this.queue.filter((e) => e.id !== notificationId);
    if (this.queue.length === before) return fail("dismiss_notification", "unknown id");
    return ok("dismiss_notification", `Dismissed ${notificationId}`, { id: notificationId });
  }

  inject(event: NotificationEventView): void {
    this.queue.push(event);
  }
}

export class MockOsBridge implements OsBridgeBundle {
  readonly platform = "mock";
  readonly messaging = new MockMessagingBridge();
  readonly calendar = new MockCalendarBridge();
  readonly telephony = new MockTelephonyBridge();
  readonly system = new MockSystemControlBridge();
  readonly accessibility = new MockAccessibilityBridge();

  status(): OsBridgeStatus {
    return {
      platform: this.platform,
      messaging: true,
      email_calendar: true,
      telephony: true,
      system_control: true,
      accessibility: true,
      mock: true,
    };
  }
}

let singleton: MockOsBridge | null = null;

export function getMockOsBridge(): MockOsBridge {
  if (!singleton) singleton = new MockOsBridge();
  return singleton;
}
