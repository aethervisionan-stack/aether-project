/** Strict types for mobility, hardware adaptation, and voice UX. */

export type CopilotMode = "assistant" | "copilot";

export type AudioProfileKind = "speaker" | "earbuds" | "wearable";

export type PaceClass = "steady" | "fast_travel" | "running";

export type NotificationPriority = "critical" | "normal" | "secondary";

export type VoiceMicMode = "open_mic" | "push_to_talk";

export interface MobilityConfig {
  copilotMode: CopilotMode;
  audioProfile: AudioProfileKind;
  interruptionFilter: boolean;
  openMic: boolean;
  pttEnabled: boolean;
}

export interface GeoFixPayload {
  lat: number;
  lon: number;
  accuracy_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  label?: string | null;
  at?: number;
}

export interface PlacePointPayload {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind?: "saved" | "meeting" | "recent" | string;
  at?: number;
}

export interface RawNotificationInput {
  source?: string;
  title?: string;
  body?: string;
  raw?: string;
  sender?: string;
}

export interface NotificationActionView {
  id: string;
  source: string;
  title: string;
  body: string;
  summary: string;
  suggested_reply: string | null;
  awaiting_confirmation: boolean;
  priority: NotificationPriority | string;
  created_at: number;
}

export interface ProductivityIntentView {
  id: string;
  kind: "reminder" | "note" | "appointment" | "unknown" | string;
  title: string;
  detail: string;
  when_hint?: string | null;
  memory_note?: string | null;
  ok: boolean;
  created_at: number;
}

export interface PriorityPolicyView {
  pace: PaceClass | string;
  audio_profile: AudioProfileKind | string;
  allow_secondary: boolean;
  allow_normal: boolean;
  allow_critical: boolean;
  prefer_nav_cues: boolean;
}

export const DEFAULT_MOBILITY_CONFIG: MobilityConfig = {
  copilotMode: "assistant",
  audioProfile: "speaker",
  interruptionFilter: true,
  openMic: true,
  pttEnabled: false,
};
