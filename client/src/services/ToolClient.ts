/**
 * Client helper for the modular tool-use layer (HTTP catalog + WS invoke).
 * Advanced invoke/confirm require payment_status=active (X-Subscriber-Id).
 */

import { loadSubscriberId } from "./BillingService";
import {
  TOOL_SCHEMAS,
  type ToolArgumentsByName,
  type ToolName,
  type ToolSchema,
} from "../types/tools";

function apiUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

function subscriberHeaders(): Record<string, string> {
  const id = loadSubscriberId();
  return id ? { "X-Subscriber-Id": id } : {};
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
  const id = loadSubscriberId();
  const q = id ? `?subscriber_id=${encodeURIComponent(id)}` : "";
  const res = await fetch(apiUrl(`/tools/catalog${q}`), {
    headers: { Accept: "application/json", ...subscriberHeaders() },
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
      ...subscriberHeaders(),
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

export interface ToolConfirmResponse {
  ok: boolean;
  status?: string;
  pending_id?: string;
  tool?: string;
  action?: string;
  speak?: string;
  success_beep?: boolean;
  name?: string;
  result?: Record<string, unknown>;
  error?: string | null;
}

/** Complete two-step confirmation via HTTP (dev harness / no Live socket). */
export async function confirmToolHttp(body: {
  pending_id?: string;
  utterance?: string;
  confirm?: boolean;
  profile_id?: string;
}): Promise<ToolConfirmResponse> {
  const res = await fetch(apiUrl("/tools/confirm"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...subscriberHeaders(),
    },
    body: JSON.stringify({
      pending_id: body.pending_id,
      utterance: body.utterance,
      confirm: body.confirm,
      profile_id: body.profile_id ?? "local",
    }),
  });
  if (!res.ok) {
    throw new Error(`tools confirm HTTP ${res.status}`);
  }
  return (await res.json()) as ToolConfirmResponse;
}

export async function fetchPendingTools(profileId = "local"): Promise<{
  pending: Array<Record<string, unknown>>;
  count: number;
}> {
  const res = await fetch(apiUrl(`/tools/pending?profile_id=${encodeURIComponent(profileId)}`), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`tools pending HTTP ${res.status}`);
  }
  return (await res.json()) as { pending: Array<Record<string, unknown>>; count: number };
}
