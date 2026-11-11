/**
 * Typed OS / accessibility bridge contracts (mirrors backend `app/os_bridge`).
 * Real Android/iOS adapters implement these; web uses MockOsBridge.
 */

export type MessagingApp = "whatsapp" | "telegram" | "sms" | "instagram";
export type SoundMode = "normal" | "vibrate" | "silent";
export type MediaAction = "play" | "pause" | "next" | "previous" | "stop";
export type OsPriorityLevel = "low" | "medium" | "high" | "critical";

export interface NotificationEventView {
  id: string;
  package: string;
  title: string;
  body: string;
  sender?: string | null;
  app?: string | null;
  favorite: boolean;
  priority_hint?: string | null;
  screen_lit: boolean;
  created_at: number;
}

export interface BridgeResultView {
  ok: boolean;
  action: string;
  detail?: string;
  data?: Record<string, unknown>;
  mock?: boolean;
  error?: string | null;
}

export interface PendingOsAction {
  id: string;
  tool: string;
  action: string;
  arguments: Record<string, unknown>;
  speak: string;
  created_at: number;
  expires_at: number;
  profile_id: string;
  source: string;
}

export interface ToolConfirmRequestEvent {
  type: "tool_confirm_request";
  name: string;
  ok: boolean;
  pending_id?: string | null;
  action?: string | null;
  speak?: string;
  requires_confirmation?: boolean;
  result?: Record<string, unknown>;
  elapsed_ms?: number;
}

export interface ListenerDecisionView {
  event: NotificationEventView;
  action: Record<string, unknown>;
  level: OsPriorityLevel | string;
  interrupt_audio: boolean;
  reason: string;
  favorite: boolean;
}

export interface OsBridgeStatus {
  platform: string;
  messaging: boolean;
  email_calendar: boolean;
  telephony: boolean;
  system_control: boolean;
  accessibility: boolean;
  mock: boolean;
  desktop_capture?: boolean;
  keyboard?: boolean;
  mouse?: boolean;
  notification_read?: boolean;
}

/** Native accessibility entry — stubbed on web/desktop. */
export interface AccessibilityBridge {
  platform(): string;
  pollNotifications(sinceId?: string | null): Promise<NotificationEventView[]>;
  dismissNotification(notificationId: string): Promise<BridgeResultView>;
}

export interface MessagingBridge {
  readThreads(app: MessagingApp, limit?: number): Promise<BridgeResultView>;
  summarize(app: MessagingApp, contact: string, limit?: number): Promise<BridgeResultView>;
  sendMessage(app: MessagingApp, contact: string, text: string): Promise<BridgeResultView>;
  voiceReply(app: MessagingApp, contact: string, text: string): Promise<BridgeResultView>;
}

export interface CalendarBridge {
  listPriorityEmail(limit?: number): Promise<BridgeResultView>;
  draftEmail(to: string, subject: string, body: string): Promise<BridgeResultView>;
  sendDraft(draftId: string): Promise<BridgeResultView>;
  scheduleAppointment(
    title: string,
    when: string,
    durationMin?: number,
    attendees?: string[],
  ): Promise<BridgeResultView>;
  queryAgenda(day?: string): Promise<BridgeResultView>;
  deleteEvent(eventId: string): Promise<BridgeResultView>;
}

export interface TelephonyBridge {
  incomingCall(): Promise<BridgeResultView>;
  answer(speaker?: boolean): Promise<BridgeResultView>;
  decline(): Promise<BridgeResultView>;
  placeCall(contact: string): Promise<BridgeResultView>;
}

export interface SystemControlBridge {
  media(action: MediaAction): Promise<BridgeResultView>;
  battery(): Promise<BridgeResultView>;
  setVolume(level: number): Promise<BridgeResultView>;
  setSoundMode(mode: SoundMode): Promise<BridgeResultView>;
  setTimer(minutes: number, label?: string): Promise<BridgeResultView>;
  setAlarm(timeHhmm: string, label?: string): Promise<BridgeResultView>;
}

export interface OsBridgeBundle {
  platform: string;
  messaging: MessagingBridge;
  calendar: CalendarBridge;
  telephony: TelephonyBridge;
  system: SystemControlBridge;
  accessibility: AccessibilityBridge;
  status(): OsBridgeStatus;
}
