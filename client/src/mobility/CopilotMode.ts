/** Copilot / companionship mode config + prompt guidance for Live. */

import type { CopilotMode } from "../types/mobility";

export const COPILOT_GUIDANCE =
  "Mode: Copilot / Companionship. Prefer fluid natural conversation — " +
  "active listening, daily summary synthesis, short storytelling, and idea debates. " +
  "Do not require rigid command syntax.";

export const ASSISTANT_GUIDANCE =
  "Mode: Assistant. Prefer concise, actionable HUD replies. Commands and tools are welcome.";

export function buildCopilotGuidance(mode: CopilotMode): string {
  return mode === "copilot" ? COPILOT_GUIDANCE : ASSISTANT_GUIDANCE;
}

export function toggleCopilotMode(current: CopilotMode): CopilotMode {
  return current === "copilot" ? "assistant" : "copilot";
}
