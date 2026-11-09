/**
 * Client-side two-step voice confirmation loop.
 * Mirrors backend `os_bridge.confirmation` phrase matching for local HUD / barge-in.
 */

import type { PendingOsAction, ToolConfirmRequestEvent } from "../types/os";

export const CONFIRM_PHRASES = [
  "sim",
  "yes",
  "sí",
  "si",
  "ok",
  "okay",
  "pode enviar",
  "pode",
  "confirma",
  "confirmar",
  "confirm",
  "confirmed",
  "go ahead",
  "send it",
  "do it",
  "execute",
  "envia",
  "enviar",
  "manda",
  "mandar",
  "agendar",
  "agenda",
  "aprova",
  "aprovar",
  "afirmativo",
] as const;

export const REJECT_PHRASES = [
  "não",
  "nao",
  "no",
  "cancel",
  "cancelar",
  "cancela",
  "stop",
  "para",
  "desist",
  "nega",
  "decline",
  "abort",
] as const;

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\wÀ-ÿ]+/gu, " ")
    .trim();
}

export function isConfirmationUtterance(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  if (isRejectionUtterance(text)) return false;
  if ((CONFIRM_PHRASES as readonly string[]).includes(norm)) return true;
  for (const phrase of CONFIRM_PHRASES) {
    if (phrase.includes(" ") && norm.includes(phrase)) return true;
  }
  const tokens = new Set(norm.split(/\s+/));
  for (const phrase of CONFIRM_PHRASES) {
    if (!phrase.includes(" ") && tokens.has(phrase)) return true;
  }
  return false;
}

export function isRejectionUtterance(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  if ((REJECT_PHRASES as readonly string[]).includes(norm)) return true;
  const tokens = new Set(norm.split(/\s+/));
  for (const phrase of REJECT_PHRASES) {
    if (tokens.has(phrase)) return true;
  }
  return false;
}

export type ConfirmLoopListener = (pending: PendingOsAction | null) => void;

/** Tracks pending irreversible OS actions awaiting voice/tap confirm. */
export class ConfirmationLoop {
  private pending: PendingOsAction | null = null;
  private listeners = new Set<ConfirmLoopListener>();

  getPending(): PendingOsAction | null {
    return this.pending;
  }

  subscribe(fn: ConfirmLoopListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Step 1–2: intent captured → store speak-aloud confirm request. */
  onConfirmRequest(event: ToolConfirmRequestEvent): PendingOsAction | null {
    if (!event.pending_id) return null;
    const pending: PendingOsAction = {
      id: String(event.pending_id),
      tool: event.name,
      action: String(event.action || ""),
      arguments: {},
      speak: event.speak || `Confirm ${event.name}?`,
      created_at: Date.now() / 1000,
      expires_at: Date.now() / 1000 + 90,
      profile_id: "local",
      source: "ws",
    };
    this.pending = pending;
    this.emit();
    return pending;
  }

  clear(): void {
    this.pending = null;
    this.emit();
  }

  /** Returns 'confirm' | 'reject' | null for a barge-in transcript. */
  classifyUtterance(text: string): "confirm" | "reject" | null {
    if (!this.pending) return null;
    if (isRejectionUtterance(text)) return "reject";
    if (isConfirmationUtterance(text)) return "confirm";
    return null;
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn(this.pending);
      } catch {
        /* ignore listener errors */
      }
    }
  }
}
