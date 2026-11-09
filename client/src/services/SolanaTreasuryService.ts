/**
 * Gen-1 treasury balance — prefers backend proxy (avoids browser RPC 403/CORS),
 * with optional direct RPC fallbacks if the proxy is unreachable.
 */

export const OFFICIAL_TREASURY_WALLET =
  "AVj6q1t8xWd7Mi7roNjTc1RvaqJy79P7n3XNpCVjQgxa";

const LAMPORTS_PER_SOL = 1_000_000_000;

/** Browser-side last-resort RPCs (proxy is preferred). */
const DIRECT_RPC_FALLBACKS = [
  "https://rpc.ankr.com/solana",
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
] as const;

export interface TreasuryBalanceResult {
  ok: boolean;
  online: boolean;
  /** Soft reconnecting state for HUD (proxy/RPC in flight or failing). */
  reconnecting?: boolean;
  wallet: string;
  rpc: string;
  lamports: number | null;
  sol: number | null;
  error?: string;
  fetchedAt: number;
  source?: "proxy" | "direct";
}

function apiUrl(path: string): string {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

export function truncateAddress(address: string, head = 4, tail = 4): string {
  const a = address.trim();
  if (a.length <= head + tail + 1) {
    return a;
  }
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export async function fetchTreasuryBalanceViaProxy(): Promise<TreasuryBalanceResult> {
  const fetchedAt = Date.now();
  const wallet = OFFICIAL_TREASURY_WALLET;
  try {
    const res = await fetch(apiUrl("/billing/treasury-balance"), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        ok: false,
        online: false,
        reconnecting: true,
        wallet,
        rpc: "proxy",
        lamports: null,
        sol: null,
        error: `proxy HTTP ${res.status}`,
        fetchedAt,
        source: "proxy",
      };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      online?: boolean;
      wallet?: string;
      rpc?: string;
      lamports?: number | null;
      sol?: number | null;
      error?: string;
    };
    const lamports =
      data.lamports == null || !Number.isFinite(Number(data.lamports))
        ? null
        : Number(data.lamports);
    const sol =
      data.sol != null && Number.isFinite(Number(data.sol))
        ? Number(data.sol)
        : lamports != null
          ? lamports / LAMPORTS_PER_SOL
          : null;
    return {
      ok: Boolean(data.ok) && sol != null,
      online: Boolean(data.online ?? data.ok),
      reconnecting: !data.ok,
      wallet: (data.wallet || wallet).trim() || wallet,
      rpc: data.rpc || "proxy",
      lamports,
      sol,
      error: data.error,
      fetchedAt,
      source: "proxy",
    };
  } catch (err) {
    return {
      ok: false,
      online: false,
      reconnecting: true,
      wallet,
      rpc: "proxy",
      lamports: null,
      sol: null,
      error: err instanceof Error ? err.message : String(err),
      fetchedAt,
      source: "proxy",
    };
  }
}

async function fetchSolBalanceDirect(
  wallet: string,
  rpcUrl: string,
): Promise<TreasuryBalanceResult> {
  const walletAddress = wallet.trim() || OFFICIAL_TREASURY_WALLET;
  const rpc = rpcUrl.trim();
  const fetchedAt = Date.now();

  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
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
        reconnecting: true,
        wallet: walletAddress,
        rpc,
        lamports: null,
        sol: null,
        error: `RPC HTTP ${res.status}`,
        fetchedAt,
        source: "direct",
      };
    }
    const data = (await res.json()) as {
      result?: { value?: number } | number;
      error?: { message?: string };
    };
    if (data.error) {
      return {
        ok: false,
        online: true,
        reconnecting: true,
        wallet: walletAddress,
        rpc,
        lamports: null,
        sol: null,
        error: data.error.message || "RPC error",
        fetchedAt,
        source: "direct",
      };
    }
    const raw =
      typeof data.result === "number"
        ? data.result
        : data.result && typeof data.result === "object"
          ? data.result.value
          : undefined;
    const lamports = Number(raw);
    if (!Number.isFinite(lamports)) {
      return {
        ok: false,
        online: true,
        reconnecting: true,
        wallet: walletAddress,
        rpc,
        lamports: null,
        sol: null,
        error: "Missing balance value",
        fetchedAt,
        source: "direct",
      };
    }
    return {
      ok: true,
      online: true,
      reconnecting: false,
      wallet: walletAddress,
      rpc,
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
      fetchedAt,
      source: "direct",
    };
  } catch (err) {
    return {
      ok: false,
      online: false,
      reconnecting: true,
      wallet: walletAddress,
      rpc,
      lamports: null,
      sol: null,
      error: err instanceof Error ? err.message : String(err),
      fetchedAt,
      source: "direct",
    };
  }
}

/**
 * Resolve treasury SOL balance. Always queries the official wallet.
 * Prefer backend proxy; fall back through public RPCs if needed.
 */
export async function fetchSolBalance(
  wallet: string = OFFICIAL_TREASURY_WALLET,
  preferredRpc?: string,
): Promise<TreasuryBalanceResult> {
  const target = (wallet || OFFICIAL_TREASURY_WALLET).trim() || OFFICIAL_TREASURY_WALLET;

  // Primary: backend proxy (correct for CORS/403).
  const proxied = await fetchTreasuryBalanceViaProxy();
  if (proxied.ok) {
    return { ...proxied, wallet: target };
  }

  // Secondary: direct RPCs (may still 403 in some browsers).
  const rpcs = [
    preferredRpc?.trim(),
    ...DIRECT_RPC_FALLBACKS,
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

  let last: TreasuryBalanceResult = proxied;
  for (const rpc of rpcs) {
    last = await fetchSolBalanceDirect(target, rpc);
    if (last.ok) {
      return last;
    }
  }

  return {
    ...last,
    wallet: target,
    ok: false,
    online: false,
    reconnecting: true,
    sol: last.sol ?? 0,
    lamports: last.lamports ?? 0,
    error: last.error || proxied.error || "All RPC endpoints failed",
  };
}
