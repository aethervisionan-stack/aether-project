/**
 * Local-dev feature unlock — paywall / permission gates stay off for HUD + tools.
 *
 * Priority:
 *  1. Backend billing config (`bypass_subscription_check` / `feature_unlock`)
 *  2. VITE_DEV_UNLOCK env (defaults on unless explicitly "false")
 */

import type { BillingConfig } from "../services/BillingService";

export function envDevUnlock(): boolean {
  const raw = (import.meta.env.VITE_DEV_UNLOCK as string | undefined)?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  // Default ON for local Vite so a missing backend config never hides Live HUD.
  return true;
}

export function isFeatureUnlock(cfg: BillingConfig | null | undefined): boolean {
  if (cfg?.feature_unlock) return true;
  if (cfg?.bypass_subscription_check) return true;
  if (cfg?.dev_unlock_enabled) return true;
  if (cfg?.dev_tools_enabled && cfg?.mock_checkout) return true;
  return envDevUnlock();
}
