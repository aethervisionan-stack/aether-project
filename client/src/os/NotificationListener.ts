/**
 * Client notification listener simulator for local HUD.
 * Filters audio interrupts to medium/high priority or favorite contacts.
 */

import { buildPriorityPolicy, policyAllows } from "../hardware/NotificationPriority";
import type { AudioProfileKind, PaceClass } from "../types/mobility";
import type {
  ListenerDecisionView,
  NotificationEventView,
  OsPriorityLevel,
} from "../types/os";
import { getMockOsBridge } from "./MockBridge";

const DEFAULT_FAVORITES = new Set(["carlos", "ana", "mom", "mãe", "pai"]);

export function mapPriorityLevel(opts: {
  hint?: string | null;
  text: string;
  favorite: boolean;
}): OsPriorityLevel {
  const raw = (opts.hint || "").trim().toLowerCase();
  const lower = opts.text.toLowerCase();
  if (
    raw === "critical" ||
    raw === "urgent" ||
    /urgent|urgente|911|sos|emerg/i.test(lower)
  ) {
    return "critical";
  }
  if (raw === "high" || raw === "high_priority") return "high";
  if (
    raw === "low" ||
    raw === "secondary" ||
    /promo|newsletter|digest|unsubscribe/i.test(lower)
  ) {
    return opts.favorite ? "high" : "low";
  }
  if (opts.favorite) return "high";
  return "medium";
}

function levelToLegacy(level: OsPriorityLevel): "critical" | "normal" | "secondary" {
  if (level === "critical" || level === "high") return "critical";
  if (level === "low") return "secondary";
  return "normal";
}

export function shouldInterruptAudio(opts: {
  level: OsPriorityLevel;
  favorite: boolean;
  pace: PaceClass;
  audioProfile: AudioProfileKind;
  interruptionFilter: boolean;
}): { interrupt: boolean; reason: string } {
  let level = opts.level;
  if (level === "low" && !opts.favorite) {
    return { interrupt: false, reason: "low_priority" };
  }
  if (opts.favorite && (level === "low" || level === "medium")) {
    level = "medium";
  }
  const policy = buildPriorityPolicy(opts.pace, opts.audioProfile);
  const legacy = levelToLegacy(level === "medium" && opts.favorite ? "high" : level);

  if (level === "medium") {
    if (!policy.allow_normal) return { interrupt: false, reason: "pace_muted_medium" };
    if (
      opts.interruptionFilter &&
      (opts.audioProfile === "earbuds" || opts.audioProfile === "wearable")
    ) {
      return { interrupt: false, reason: "earbuds_filter_medium" };
    }
    return { interrupt: true, reason: "medium_or_favorite" };
  }

  if (level === "high" || level === "critical") {
    if (!policyAllows(policy, legacy)) {
      return { interrupt: false, reason: "pace_muted_high" };
    }
    return { interrupt: true, reason: level === "critical" ? "critical" : "high_or_critical" };
  }

  return { interrupt: false, reason: "filtered" };
}

export class NotificationListenerSimulator {
  favorites = new Set(DEFAULT_FAVORITES);
  private history: ListenerDecisionView[] = [];

  isFavorite(sender?: string | null): boolean {
    if (!sender) return false;
    return this.favorites.has(sender.trim().toLowerCase());
  }

  decide(
    event: NotificationEventView,
    opts?: {
      pace?: PaceClass;
      audioProfile?: AudioProfileKind;
      interruptionFilter?: boolean;
    },
  ): ListenerDecisionView {
    const favorite = event.favorite || this.isFavorite(event.sender);
    const text = `${event.title}\n${event.body}`;
    const level = mapPriorityLevel({
      hint: event.priority_hint,
      text,
      favorite,
    });
    const { interrupt, reason } = shouldInterruptAudio({
      level,
      favorite,
      pace: opts?.pace ?? "steady",
      audioProfile: opts?.audioProfile ?? "speaker",
      interruptionFilter: opts?.interruptionFilter ?? true,
    });
    const decision: ListenerDecisionView = {
      event: { ...event, favorite, priority_hint: level },
      action: {
        id: event.id,
        source: event.app || event.package,
        title: event.title,
        body: event.body,
        summary: favorite
          ? `Favorite ${event.sender || event.title}: ${event.body.slice(0, 80)}`
          : `New alert: ${event.title}`,
        priority: levelToLegacy(level),
        awaiting_confirmation: true,
      },
      level,
      interrupt_audio: interrupt,
      reason,
      favorite,
    };
    this.history.push(decision);
    this.history = this.history.slice(-50);
    return decision;
  }

  async pollFromMock(opts?: {
    sinceId?: string | null;
    pace?: PaceClass;
    audioProfile?: AudioProfileKind;
    interruptionFilter?: boolean;
  }): Promise<ListenerDecisionView[]> {
    const events = await getMockOsBridge().accessibility.pollNotifications(opts?.sinceId);
    return events.map((ev) => this.decide(ev, opts));
  }

  getHistory(): ListenerDecisionView[] {
    return [...this.history];
  }
}
