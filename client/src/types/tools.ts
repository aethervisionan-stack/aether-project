/**
 * Strict TypeScript tool schemas mirroring backend `app/tools/schemas.py`.
 */

export type ToolName =
  | "solana_treasury_query"
  | "onchain_lookup"
  | "run_test_routine"
  | "memory_payload"
  | "messaging_tool"
  | "email_calendar_tool"
  | "telephony_tool"
  | "system_control_tool";

export type TestRoutine = "health" | "memory_snapshot" | "latency_targets";

export type MemoryPayloadAction = "get" | "patch_prefs" | "clear_history";

export interface SolanaTreasuryArgs {
  wallet?: string;
}

export interface OnchainLookupArgs {
  address: string;
  method?: "getBalance" | "getAccountInfo";
}

export interface RunTestRoutineArgs {
  routine: TestRoutine;
}

export interface MemoryPayloadArgs {
  action: MemoryPayloadAction;
  preferences?: Record<string, unknown>;
}

export interface MessagingToolArgs {
  action: "read" | "summarize" | "send" | "voice_reply";
  app?: "whatsapp" | "telegram" | "sms" | "instagram";
  contact?: string;
  text?: string;
  limit?: number;
  confirmed?: boolean;
}

export interface EmailCalendarToolArgs {
  action:
    | "read_email"
    | "priority_email"
    | "draft"
    | "send_draft"
    | "schedule"
    | "agenda"
    | "query_agenda"
    | "delete";
  to?: string;
  subject?: string;
  body?: string;
  text?: string;
  draft_id?: string;
  title?: string;
  when?: string;
  duration_min?: number;
  attendees?: string[];
  day?: string;
  event_id?: string;
  limit?: number;
  confirmed?: boolean;
}

export interface TelephonyToolArgs {
  action: "incoming" | "identify" | "answer" | "decline" | "place_call";
  contact?: string;
  speaker?: boolean;
  confirmed?: boolean;
}

export interface SystemControlToolArgs {
  action: "media" | "battery" | "volume" | "sound_mode" | "timer" | "alarm";
  media_action?: "play" | "pause" | "next" | "previous" | "stop";
  level?: number;
  mode?: "normal" | "vibrate" | "silent";
  minutes?: number;
  time?: string;
  label?: string;
}

export type ToolArgumentsByName = {
  solana_treasury_query: SolanaTreasuryArgs;
  onchain_lookup: OnchainLookupArgs;
  run_test_routine: RunTestRoutineArgs;
  memory_payload: MemoryPayloadArgs;
  messaging_tool: MessagingToolArgs;
  email_calendar_tool: EmailCalendarToolArgs;
  telephony_tool: TelephonyToolArgs;
  system_control_tool: SystemControlToolArgs;
};

export interface ToolParamProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolSchema {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParamProperty>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export const TOOL_SCHEMAS: readonly ToolSchema[] = [
  {
    name: "solana_treasury_query",
    description: "Query Aether Vision Solana treasury SOL balance and wallet metadata.",
    parameters: {
      type: "object",
      properties: {
        wallet: {
          type: "string",
          description: "Optional wallet override; defaults to official treasury.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "onchain_lookup",
    description: "Lightweight on-chain data lookup (RPC getBalance / getAccountInfo style).",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana address to inspect." },
        method: {
          type: "string",
          enum: ["getBalance", "getAccountInfo"],
          description: "RPC method shorthand.",
        },
      },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "run_test_routine",
    description: "Run a named Gen-1 health/test routine (latency, memory, live bridge).",
    parameters: {
      type: "object",
      properties: {
        routine: {
          type: "string",
          enum: ["health", "memory_snapshot", "latency_targets"],
        },
      },
      required: ["routine"],
      additionalProperties: false,
    },
  },
  {
    name: "memory_payload",
    description: "Read or patch long-term memory preferences / history for the active profile.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "patch_prefs", "clear_history"],
        },
        preferences: {
          type: "object",
          description: "Partial preference patch when action=patch_prefs.",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "messaging_tool",
    description:
      "Read/summarize/voice-reply WhatsApp, Telegram, SMS, Instagram Direct. Send requires confirm.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["read", "summarize", "send", "voice_reply"],
        },
        app: {
          type: "string",
          enum: ["whatsapp", "telegram", "sms", "instagram"],
        },
        contact: { type: "string" },
        text: { type: "string" },
        limit: { type: "integer" },
        confirmed: { type: "boolean" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "email_calendar_tool",
    description: "Priority email, drafts, schedule, agenda. Mutating actions require confirm.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "read_email",
            "priority_email",
            "draft",
            "send_draft",
            "schedule",
            "agenda",
            "query_agenda",
            "delete",
          ],
        },
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        draft_id: { type: "string" },
        title: { type: "string" },
        when: { type: "string" },
        duration_min: { type: "integer" },
        day: { type: "string" },
        event_id: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "telephony_tool",
    description: "Incoming call ID, answer/decline, place calls (confirm on mutate).",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["incoming", "identify", "answer", "decline", "place_call"],
        },
        contact: { type: "string" },
        speaker: { type: "boolean" },
        confirmed: { type: "boolean" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "system_control_tool",
    description: "Media, battery, volume/sound modes, timers/alarms.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["media", "battery", "volume", "sound_mode", "timer", "alarm"],
        },
        media_action: {
          type: "string",
          enum: ["play", "pause", "next", "previous", "stop"],
        },
        level: { type: "integer" },
        mode: { type: "string", enum: ["normal", "vibrate", "silent"] },
        minutes: { type: "integer" },
        time: { type: "string" },
        label: { type: "string" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
] as const;

export interface ToolResultEvent {
  type: "tool_result";
  name: string;
  ok: boolean;
  result: Record<string, unknown>;
  error?: string | null;
  elapsed_ms?: number;
}

export function isToolName(value: string): value is ToolName {
  return TOOL_SCHEMAS.some((s) => s.name === value);
}

export const OS_TOOL_NAMES: readonly ToolName[] = [
  "messaging_tool",
  "email_calendar_tool",
  "telephony_tool",
  "system_control_tool",
];
