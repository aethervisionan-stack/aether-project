/** Pace-based notification priority (running / fast travel → mute secondary). */

import type { AudioProfileKind, NotificationPriority, PaceClass, PriorityPolicyView } from "../types/mobility";

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
  if (pri === "critical") return policy.allow_critical;
  if (pri === "secondary") return policy.allow_secondary;
  return policy.allow_normal;
}
