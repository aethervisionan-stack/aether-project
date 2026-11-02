import { BACKEND_URL } from '@/lib/config';

export type WalletBalances = {
  address: string;
  sol: number;
  vision: number;
  treasury: string;
  mint: string;
};

export async function fetchBalancesFromBackend(
  address: string,
): Promise<WalletBalances> {
  const res = await fetch(`${BACKEND_URL}/api/balances/${address}`);
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
