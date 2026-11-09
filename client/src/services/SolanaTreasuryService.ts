/**
 * Lightweight Solana JSON-RPC helper for Gen-1 treasury HUD.
 * Uses fetch (no web3.js dep) so Live/WS latency stays untouched.
 */

export const OFFICIAL_TREASURY_WALLET =
  "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa";

const DEFAULT_TREASURY_RPC = "https://api.mainnet-beta.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

export interface TreasuryBalanceResult {
  ok: boolean;
  online: boolean;
  wallet: string;
  rpc: string;
  lamports: number | null;
  sol: number | null;
  error?: string;
  fetchedAt: number;
}

export function truncateAddress(address: string, head = 4, tail = 4): string {
  const a = address.trim();
  if (a.length <= head + tail + 1) {
    return a;
  }
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export async function fetchSolBalance(
  wallet: string = OFFICIAL_TREASURY_WALLET,
  rpcUrl: string = DEFAULT_TREASURY_RPC,
): Promise<TreasuryBalanceResult> {
  const walletAddress = wallet.trim() || OFFICIAL_TREASURY_WALLET;
  const rpc = (rpcUrl || DEFAULT_TREASURY_RPC).trim();
  const fetchedAt = Date.now();

  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [walletAddress],
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        online: false,
        wallet: walletAddress,
        rpc,
        lamports: null,
        sol: null,
        error: `RPC HTTP ${res.status}`,
        fetchedAt,
      };
    }
    const data = (await res.json()) as {
      result?: { value?: number };
      error?: { message?: string };
    };
    if (data.error) {
      return {
        ok: false,
        online: true,
        wallet: walletAddress,
        rpc,
        lamports: null,
        sol: null,
        error: data.error.message || "RPC error",
        fetchedAt,
      };
    }
    const lamports = Number(data.result?.value ?? NaN);
    if (!Number.isFinite(lamports)) {
      return {
        ok: false,
        online: true,
        wallet: walletAddress,
        rpc,
        lamports: null,
        sol: null,
        error: "Missing balance value",
        fetchedAt,
      };
    }
    return {
      ok: true,
      online: true,
      wallet: walletAddress,
      rpc,
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
      fetchedAt,
    };
  } catch (err) {
    return {
      ok: false,
      online: false,
      wallet: walletAddress,
      rpc,
      lamports: null,
      sol: null,
      error: err instanceof Error ? err.message : String(err),
      fetchedAt,
    };
  }
}
