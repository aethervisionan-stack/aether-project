/** Earbuds / wearable audio profile + intelligent interruption filtering. */

import type { AudioProfileKind, NotificationPriority } from "../types/mobility";

export function cycleAudioProfile(current: AudioProfileKind): AudioProfileKind {
  if (current === "speaker") return "earbuds";
  if (current === "earbuds") return "wearable";
  return "speaker";
}

export function audioProfileLabel(profile: AudioProfileKind): string {
  switch (profile) {
    case "earbuds":
      return "EARBUDS";
    case "wearable":
      return "GLASSES";
    default:
      return "SPEAKER";
  }
}

/**
 * Whether a notification / cue may interrupt current AI audio for this profile.
 * Earbuds & smart glasses: filter secondary chatter; always allow critical + nav.
 */
export function interruptionAllows(options: {
  profile: AudioProfileKind;
  filterEnabled: boolean;
  priority: NotificationPriority | string;
  isNavCue?: boolean;
}): boolean {
  const { profile, filterEnabled, priority, isNavCue = false } = options;
  if (!filterEnabled) return true;
  const pri = String(priority || "normal").toLowerCase();
  if (pri === "critical" || isNavCue) return true;
  if (profile === "earbuds" || profile === "wearable") {
    return pri === "critical";
  }
  return pri !== "secondary";
}

/**
 * Detect likely headphone output when the browser exposes sink enumeration.
 * Falls back to configured profile — browsers rarely expose true audio routing.
 */
export async function detectHeadphoneHint(): Promise<"headphones" | "unknown"> {
  try {
    const nav = navigator as Navigator & {
      mediaDevices?: MediaDevices & {
        enumerateDevices?: () => Promise<MediaDeviceInfo[]>;
      };
    };
    const devices = await nav.mediaDevices?.enumerateDevices?.();
    if (!devices) return "unknown";
    const audioOut = devices.filter((d) => d.kind === "audiooutput");
    const hint = audioOut.some((d) =>
      /headphone|headset|airpod|bud|earbud|bluetooth/i.test(d.label),
    );
    return hint ? "headphones" : "unknown";
  } catch {
    return "unknown";
  }
}
