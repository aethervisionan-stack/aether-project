/**
 * Local-dev feature unlock — OFF by default for production path.
 *
 * Priority:
 *  1. Backend billing config (`bypass_subscription_check` / `feature_unlock`)
 *  2. VITE_DEV_UNLOCK env — must be explicitly true/1/on (default off)
 */

import type { BillingConfig } from "../services/BillingService";

export function envDevUnlock(): boolean {
  const raw = (import.meta.env.VITE_DEV_UNLOCK as string | undefined)?.trim().toLowerCase();
  // Production-safe default: locked unless explicitly enabled for local testing.
  return raw === "true" || raw === "1" || raw === "on";
}

export function isFeatureUnlock(cfg: BillingConfig | null | undefined): boolean {
  if (cfg?.feature_unlock) return true;
  if (cfg?.bypass_subscription_check) return true;
  if (cfg?.dev_unlock_enabled) return true;
  if (cfg?.dev_tools_enabled && cfg?.mock_checkout) return true;
  return envDevUnlock();
}
