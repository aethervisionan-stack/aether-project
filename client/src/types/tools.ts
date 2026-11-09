/**
 * Strict TypeScript tool schemas mirroring backend `app/tools/schemas.py`.
 */

export type ToolName =
  | "solana_treasury_query"
  | "onchain_lookup"
  | "run_test_routine"
  | "memory_payload";

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

export type ToolArgumentsByName = {
  solana_treasury_query: SolanaTreasuryArgs;
  onchain_lookup: OnchainLookupArgs;
  run_test_routine: RunTestRoutineArgs;
  memory_payload: MemoryPayloadArgs;
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
