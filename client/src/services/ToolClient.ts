/**
 * Client helper for the modular tool-use layer (HTTP catalog + WS invoke).
 */

import {
  TOOL_SCHEMAS,
  type ToolArgumentsByName,
  type ToolName,
  type ToolSchema,
} from "../types/tools";

function apiUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

export interface ToolCatalogResponse {
  tools: ToolSchema[];
  names: string[];
}

export interface ToolInvokeResponse {
  name: string;
  ok: boolean;
  result: Record<string, unknown>;
  error?: string | null;
  elapsed_ms?: number;
}

export async function fetchToolCatalog(): Promise<ToolCatalogResponse> {
  const res = await fetch(apiUrl("/tools/catalog"), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`tools catalog HTTP ${res.status}`);
  }
  return (await res.json()) as ToolCatalogResponse;
}

export async function invokeToolHttp<N extends ToolName>(
  name: N,
  arguments_: ToolArgumentsByName[N],
  profileId = "local",
): Promise<ToolInvokeResponse> {
  const res = await fetch(apiUrl("/tools/invoke"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      arguments: arguments_,
      profile_id: profileId,
    }),
  });
  if (!res.ok) {
    throw new Error(`tools invoke HTTP ${res.status}`);
  }
  return (await res.json()) as ToolInvokeResponse;
}

/** Local schema mirror — useful before catalog fetch. */
export function localToolSchemas(): readonly ToolSchema[] {
  return TOOL_SCHEMAS;
}
