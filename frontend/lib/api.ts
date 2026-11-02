import { BACKEND_URL } from '@/lib/config';

export type WalletBalances = {
  address: string;
  sol: number;
  vision: number;
  treasury: string;
  mint: string;
  source?: string;
};

export type LandingPayload = {
  ok: boolean;
  brand: string;
  tagline: string;
  description?: string;
  visionTokenMint: string;
  treasuryPublicKey: string;
  expoWebUrl?: string;
  features?: Array<{
    id: string;
    title: string;
    href: string;
    summary: string;
  }>;
  routes?: Record<string, string>;
};

export async function fetchLanding(): Promise<LandingPayload> {
  const res = await fetch(`${BACKEND_URL}/api/landing?format=json`);
  if (!res.ok) {
    throw new Error(`Landing ${res.status}`);
  }
  return res.json() as Promise<LandingPayload>;
}

export async function fetchBalancesFromBackend(
  address: string,
): Promise<WalletBalances> {
  const res = await fetch(`${BACKEND_URL}/api/balances/${encodeURIComponent(address)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Backend ${res.status}`);
  }
  return res.json() as Promise<WalletBalances>;
}

export async function fetchBackendHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(`${BACKEND_URL}/health`);
  if (!res.ok) throw new Error(`Health ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function fetchBackendConfig(): Promise<{
  visionTokenMint: string;
  treasuryPublicKey: string;
}> {
  const res = await fetch(`${BACKEND_URL}/api/config`);
  if (!res.ok) throw new Error(`Config ${res.status}`);
  return res.json() as Promise<{
    visionTokenMint: string;
    treasuryPublicKey: string;
  }>;
}
