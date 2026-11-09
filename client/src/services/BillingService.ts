/**
 * Gen-1 subscription client — Stripe Checkout redirect + entitlement polling.
 * Talks to FastAPI via Vite `/api` → `:8000` proxy.
 */

const SUBSCRIBER_KEY = "aether.subscriber_id";

export interface BillingConfig {
  stripe_configured: boolean;
  /** off | test | live — derived from STRIPE_SECRET_KEY alone */
  stripe_mode?: "off" | "test" | "live" | string;
  /** Local mock Checkout when real Stripe keys are absent */
  mock_checkout?: boolean;
  publishable_key: string | null;
  dev_unlock_enabled: boolean;
  /** Reset / local tools (BILLING_DEV_UNLOCK) — may stay on with sk_test_ */
  dev_tools_enabled?: boolean;
  /** TEMP: skip paywall for AI/Live testing (BYPASS_SUBSCRIPTION_CHECK) */
  bypass_subscription_check?: boolean;
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

export function clearSubscriberId(): void {
  try {
    localStorage.removeItem(SUBSCRIBER_KEY);
  } catch {
    // ignore
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

export async function startCheckout(): Promise<{ id: string; url: string; mock?: boolean }> {
  const endpoint = apiUrl("/billing/checkout");
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    console.error("[aether:billing] checkout network error", endpoint, err);
    throw new Error(
      `Could not reach ${endpoint}. Is the backend on :8000 and Vite proxy up?`,
    );
  }

  const raw = await res.text();
  let data: {
    id?: string;
    url?: string;
    checkout_url?: string;
    mock?: boolean;
    detail?: unknown;
  } = {};
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {};
  } catch {
    console.error("[aether:billing] checkout non-JSON response", res.status, raw.slice(0, 300));
    throw new Error(`Checkout failed (${res.status}): invalid JSON from server`);
  }

  if (!res.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : raw.slice(0, 240) || `Checkout failed (${res.status})`;
    console.error("[aether:billing] checkout HTTP error", res.status, detail);
    throw new Error(detail);
  }

  const url = (data.checkout_url || data.url || "").trim();
  if (!data.id || !url) {
    console.error("[aether:billing] checkout missing id/url", data);
    throw new Error("Checkout session missing id or url");
  }

  console.info("[aether:billing] checkout ok", {
    id: data.id,
    mock: Boolean(data.mock),
    host: (() => {
      try {
        return new URL(url).host;
      } catch {
        return "invalid-url";
      }
    })(),
  });
  return { id: data.id, url, mock: data.mock };
}

/** Local/dev: revoke entitlement on the server and clear client id. */
export async function resetSubscription(subscriberId?: string | null): Promise<void> {
  const id = (subscriberId ?? loadSubscriberId() ?? "").trim();
  if (!id) {
    clearSubscriberId();
    return;
  }
  const res = await fetch(apiUrl("/billing/dev-lock"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscriber_id: id }),
  });
  if (!res.ok) {
    const detail = await res.text();
    clearSubscriberId();
    throw new Error(detail || `Reset subscription failed (${res.status})`);
  }
  clearSubscriberId();
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

/** Short stable id for HUD (keeps localStorage value intact). */
export function shortenSubscriberId(id: string | null | undefined): string {
  const raw = (id ?? "").trim();
  if (!raw) {
    return "—";
  }
  if (raw.length <= 18) {
    return raw;
  }
  return `${raw.slice(0, 10)}…${raw.slice(-6)}`;
}

export function formatEpochLocal(epochSec: number | null | undefined): string | null {
  if (epochSec == null || !Number.isFinite(epochSec) || epochSec <= 0) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(epochSec * 1000));
  } catch {
    return new Date(epochSec * 1000).toISOString();
  }
}
