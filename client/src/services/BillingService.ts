/**
 * Gen-1 subscription client — Stripe Checkout redirect + entitlement polling.
 * Talks to FastAPI via Vite `/api` → `:8000` proxy.
 */

const SUBSCRIBER_KEY = "aether.subscriber_id";

export interface BillingConfig {
  stripe_configured: boolean;
  publishable_key: string | null;
  dev_unlock_enabled: boolean;
  solana_mode: string;
  treasury_share: number;
  burn_share: number;
  unit_amount_cents: number;
  currency: string;
  interval: string;
  /** TEMP TEST: R$0,01 local pricing active */
  temp_test?: boolean;
}

export interface EntitlementStatus {
  subscriber_id: string;
  active: boolean;
  source: string | null;
  email?: string | null;
  expires_at?: number | null;
  granted_at?: number | null;
}

function apiUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

export function loadSubscriberId(): string | null {
  try {
    return localStorage.getItem(SUBSCRIBER_KEY);
  } catch {
    return null;
  }
}

export function saveSubscriberId(id: string): void {
  try {
    localStorage.setItem(SUBSCRIBER_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

export async function fetchBillingConfig(): Promise<BillingConfig> {
  const res = await fetch(apiUrl("/billing/config"));
  if (!res.ok) {
    throw new Error(`Billing config failed (${res.status})`);
  }
  return (await res.json()) as BillingConfig;
}

export async function fetchEntitlement(subscriberId: string): Promise<EntitlementStatus> {
  const url = `${apiUrl("/billing/entitlement")}?subscriber_id=${encodeURIComponent(subscriberId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Entitlement check failed (${res.status})`);
  }
  return (await res.json()) as EntitlementStatus;
}

export async function startCheckout(): Promise<{ id: string; url: string }> {
  const res = await fetch(apiUrl("/billing/checkout"), { method: "POST" });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Checkout failed (${res.status})`);
  }
  const data = (await res.json()) as { id: string; url: string };
  if (!data.url) {
    throw new Error("Checkout session missing url");
  }
  return data;
}

export async function devUnlock(): Promise<EntitlementStatus> {
  const res = await fetch(apiUrl("/billing/dev-unlock"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "local-hud" }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Dev unlock failed (${res.status})`);
  }
  const data = (await res.json()) as EntitlementStatus & { subscriber_id: string };
  saveSubscriberId(data.subscriber_id);
  return data;
}

/** After Stripe redirect: `?checkout=success&session_id=cs_...` */
export function readCheckoutReturn(): { success: boolean; sessionId: string | null } {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get("checkout");
  const sessionId = params.get("session_id");
  return {
    success: checkout === "success",
    sessionId,
  };
}

export function clearCheckoutQuery(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("checkout") && !url.searchParams.has("session_id")) {
    return;
  }
  url.searchParams.delete("checkout");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
