import { Connection, type Commitment, type ConnectionConfig } from "@solana/web3.js";

export const PRIMARY_SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  "https://solana-mainnet.rpc.extrnode.com";

export const FALLBACK_SOLANA_RPC = "https://rpc.ankr.com/solana";

export const SOLANA_CONNECTION_CONFIG: ConnectionConfig = {
  commitment: "confirmed" as Commitment,
  confirmTransactionInitialTimeout: 60_000,
};

const fallbackByPrimary = new Map<string, Connection>();

export function createSolanaConnection(endpoint = PRIMARY_SOLANA_RPC) {
  return new Connection(endpoint, SOLANA_CONNECTION_CONFIG);
}

export function secondarySolanaRpc(primaryEndpoint: string): string {
  return primaryEndpoint.includes("ankr.com")
    ? "https://solana-mainnet.rpc.extrnode.com"
    : FALLBACK_SOLANA_RPC;
}

export function getFallbackSolanaConnection(primaryEndpoint: string) {
  const endpoint = secondarySolanaRpc(primaryEndpoint);
  const cached = fallbackByPrimary.get(endpoint);
  if (cached) return cached;
  const connection = createSolanaConnection(endpoint);
  fallbackByPrimary.set(endpoint, connection);
  return connection;
}

export function isRpcAccessError(error: unknown): boolean {
  const parts: string[] = [];
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (current == null || seen.has(current)) continue;
    seen.add(current);
    if (typeof current === "string") {
      parts.push(current);
      continue;
    }
    if (current instanceof Error) {
      parts.push(current.message, current.name);
    }
    if (typeof current === "object") {
      const nested = current as {
        cause?: unknown;
        error?: unknown;
        code?: unknown;
        status?: unknown;
        message?: unknown;
      };
      if (nested.cause) queue.push(nested.cause);
      if (nested.error) queue.push(nested.error);
      if (nested.message) queue.push(String(nested.message));
      if (nested.code != null) parts.push(String(nested.code));
      if (nested.status != null) parts.push(String(nested.status));
    }
  }

  return /403|401|access forbidden|forbidden|429|too many requests|rate.?limit/i.test(
    parts.join(" "),
  );
}

export async function rpcWithFallback<T>(
  primary: Connection,
  operation: (connection: Connection) => Promise<T>,
): Promise<{ value: T; connection: Connection }> {
  try {
    return { value: await operation(primary), connection: primary };
  } catch (error) {
    if (!isRpcAccessError(error)) throw error;
    const fallback = getFallbackSolanaConnection(primary.rpcEndpoint);
    return { value: await operation(fallback), connection: fallback };
  }
}
