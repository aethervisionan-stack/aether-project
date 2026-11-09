/** Pace-based notification priority (running / fast travel → mute secondary). */

import type {
  AudioProfileKind,
  NotificationPriority,
  OsNotificationLevel,
  PaceClass,
  PriorityPolicyView,
} from "../types/mobility";

export function classifyPace(speedMps: number | null | undefined): PaceClass {
  if (speedMps == null || !Number.isFinite(speedMps)) return "steady";
  if (speedMps >= 2.2 && speedMps < 5.0) return "running";
  if (speedMps >= 5.0) return "fast_travel";
  return "steady";
}

export function buildPriorityPolicy(
  pace: PaceClass,
  audioProfile: AudioProfileKind,
): PriorityPolicyView {
  const accelerated = pace === "running" || pace === "fast_travel";
  return {
    pace,
    audio_profile: audioProfile,
    allow_secondary: !accelerated,
    allow_normal: !accelerated,
    allow_critical: true,
    prefer_nav_cues: true,
  };
}

export function policyAllows(
  policy: PriorityPolicyView,
  priority: NotificationPriority | string,
  opts?: { isNavCue?: boolean },
): boolean {
  if (opts?.isNavCue && policy.prefer_nav_cues) return true;
  const pri = String(priority || "normal").toLowerCase();
  if (pri === "critical" || pri === "high") return policy.allow_critical;
  if (pri === "secondary" || pri === "low") return policy.allow_secondary;
  // medium / normal
  return policy.allow_normal;
}

/** Map OS listener level → legacy mobility priority for existing HUD widgets. */
export function osLevelToLegacy(level: OsNotificationLevel | string): NotificationPriority {
  const v = String(level || "medium").toLowerCase();
  if (v === "critical" || v === "high") return "critical";
  if (v === "low" || v === "secondary") return "secondary";
  return "normal";
}

/**
 * Smart filter: interrupt audio only for medium/high priority or favorite contacts.
 * Pace acceleration still silences medium (keeps high/critical + favorites).
 */
export function allowsAudioInterrupt(
  policy: PriorityPolicyView,
  level: OsNotificationLevel | string,
  opts?: { favorite?: boolean; isNavCue?: boolean },
): boolean {
  if (opts?.isNavCue && policy.prefer_nav_cues) return true;
  const lv = String(level || "medium").toLowerCase() as OsNotificationLevel | string;
  if (lv === "low" && !opts?.favorite) return false;
  if (opts?.favorite) {
    return policyAllows(policy, lv === "low" ? "normal" : osLevelToLegacy(String(lv)));
  }
  if (lv === "medium") return policy.allow_normal;
  if (lv === "high" || lv === "critical") return policy.allow_critical;
  return policyAllows(policy, osLevelToLegacy(String(lv)));
}
