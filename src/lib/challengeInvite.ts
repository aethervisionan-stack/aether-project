/**
 * Social challenge invite helpers — URL params, share text, WhatsApp link.
 * All window/origin access is client-only.
 */

import type { AssessmentMode, LeaderboardMode } from "@/src/types/quiz";
import {
  LEADERBOARD_MODE_LABEL,
  MODE_META,
} from "@/src/types/quiz";
import { assessmentModeToLeaderboardMode } from "@/src/lib/leaderboard";

export type ChallengeInvite = {
  challenger: string;
  targetIq: number;
  mode: LeaderboardMode;
};

export type ShareInvitePayload = {
  name: string;
  iq: number;
  marginOfError: number;
  percentile: number;
  rank: number | null;
  mode: AssessmentMode;
};

/** Top X% from percentile (98th → Top 2%). Floor at 0.1 for display. */
export function topPercentFromPercentile(percentile: number): number {
  const top = Math.max(0, 100 - Math.max(0, Math.min(100, percentile)));
  if (top <= 0) return 0.1;
  return Math.round(top * 10) / 10;
}

export function formatTopPercentLabel(percentile: number): string {
  const top = topPercentFromPercentile(percentile);
  return `Top ${top}%`;
}

export function modeToInviteParam(mode: AssessmentMode): LeaderboardMode {
  return assessmentModeToLeaderboardMode(mode);
}

export function inviteParamToAssessmentMode(
  mode: LeaderboardMode,
): AssessmentMode {
  if (mode === "geometric") return "figures";
  if (mode === "questions") return "questions";
  return "hybrid";
}

export function modePublicLabel(mode: AssessmentMode | LeaderboardMode): string {
  if (mode === "geometric" || mode === "figures") {
    return mode === "figures" ? MODE_META.figures.short : LEADERBOARD_MODE_LABEL.geometric;
  }
  if (mode === "questions") return MODE_META.questions.short;
  return MODE_META.hybrid.short;
}

/** Client-only origin for invite links (falls back to relative path). */
export function getClientOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function buildChallengePath(payload: ShareInvitePayload): string {
  const params = new URLSearchParams();
  params.set("challenger", payload.name.slice(0, 40));
  params.set("targetIq", String(Math.round(payload.iq)));
  params.set("mode", modeToInviteParam(payload.mode));
  return `/teste-qi?${params.toString()}`;
}

export function buildChallengeUrl(payload: ShareInvitePayload): string {
  const origin = getClientOrigin();
  const path = buildChallengePath(payload);
  return origin ? `${origin}${path}` : path;
}

export function parseChallengeInvite(
  search: string | URLSearchParams,
): ChallengeInvite | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const challenger = (params.get("challenger") || "").trim().slice(0, 40);
  const rawIq = Number(params.get("targetIq"));
  const rawMode = (params.get("mode") || "").trim().toLowerCase();

  if (!challenger || !Number.isFinite(rawIq)) return null;
  const targetIq = Math.round(rawIq);
  if (targetIq < 40 || targetIq > 200) return null;

  let mode: LeaderboardMode;
  if (rawMode === "geometric" || rawMode === "figures") mode = "geometric";
  else if (rawMode === "questions") mode = "questions";
  else if (rawMode === "hybrid") mode = "hybrid";
  else return null;

  return { challenger, targetIq, mode };
}

export function buildChallengeShareText(payload: ShareInvitePayload): string {
  const top = formatTopPercentLabel(payload.percentile);
  const rankLine =
    payload.rank != null ? `Ranking: #${payload.rank}` : "Ranking: —";
  const url = buildChallengeUrl(payload);
  return [
    `🧠 Desafio de QI — ${payload.name}`,
    `QI ${payload.iq} (±${payload.marginOfError}) · ${top} · ${rankLine}`,
    `Modo: ${modePublicLabel(payload.mode)}`,
    "",
    `Consegue superar? Faça o teste:`,
    url,
  ].join("\n");
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function shareOrCopyInvite(
  payload: ShareInvitePayload,
): Promise<"shared" | "copied" | "aborted" | "failed"> {
  const text = buildChallengeShareText(payload);
  const url = buildChallengeUrl(payload);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: `Desafio de QI — ${payload.name}`,
        text,
        url,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "aborted";
      }
      /* fall through to copy */
    }
  }

  const copied = await copyTextToClipboard(text);
  return copied ? "copied" : "failed";
}
