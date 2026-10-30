import { Connection, type Commitment, type ConnectionConfig } from "@solana/web3.js";

export const SOLANA_RPC_PROXY_PATH = "/api/solana-rpc";

export const SOLANA_CONNECTION_CONFIG: ConnectionConfig = {
  commitment: "confirmed" as Commitment,
  confirmTransactionInitialTimeout: 60_000,
};

const PUBLIC_RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

export const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  process.env.NEXT_PUBLIC_SOLANA_RPC,
  ...PUBLIC_RPC_ENDPOINTS,
].filter((url): url is string => Boolean(url && url.trim()));

export function getUpstreamRpcEndpoints(): string[] {
  const endpoints = [
    process.env.SOLANA_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    process.env.NEXT_PUBLIC_SOLANA_RPC,
    ...PUBLIC_RPC_ENDPOINTS,
  ].filter((url): url is string => Boolean(url && url.trim()));

  const unique = [...new Set(endpoints)];
  const dead = unique.filter((url) => /extrnode/i.test(url));
  const live = unique.filter((url) => !/extrnode/i.test(url));
  return [...live, ...dead];
}

export const PRIMARY_SOLANA_RPC =
  getUpstreamRpcEndpoints()[0] ?? "https://solana-rpc.publicnode.com";

const connectionCache = new Map<string, Connection>();

export function createSolanaConnection(endpoint: string) {
  const cached = connectionCache.get(endpoint);
  if (cached) return cached;
  const connection = new Connection(endpoint, SOLANA_CONNECTION_CONFIG);
  connectionCache.set(endpoint, connection);
  return connection;
}

export function getClientRpcEndpoint(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${SOLANA_RPC_PROXY_PATH}`;
  }
  return PRIMARY_SOLANA_RPC;
}

function errorText(error: unknown): string {
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
      parts.push(current.name, current.message);
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

  return parts.join(" ");
}

export function isUserWalletError(error: unknown): boolean {
  return /WalletSignTransactionError|user rejected|user denied|user cancelled|rejected the request|declined|insufficient|0x1\b/i.test(
    errorText(error),
  );
}

export function isRpcAccessError(error: unknown): boolean {
  return /403|401|access forbidden|forbidden|429|too many requests|rate.?limit|failed to fetch|load failed|networkerror|cors|blocked by cors|err_failed|502|503|504|econnreset|enotfound|etimedout/i.test(
    errorText(error),
  );
}

function shouldTryNextRpc(error: unknown): boolean {
  if (isUserWalletError(error)) return false;
  return isRpcAccessError(error) || error instanceof TypeError;
}

export async function executeWithRpcFallback<T>(
  fn: (connection: Connection) => Promise<T>,
  preferred?: Connection,
): Promise<{ result: T; connection: Connection }> {
  const tried = new Set<string>();
  let lastError: unknown;

  const endpoints: string[] = [];
  if (preferred?.rpcEndpoint) endpoints.push(preferred.rpcEndpoint);
  if (typeof window !== "undefined") {
    endpoints.push(getClientRpcEndpoint());
  }
  endpoints.push(...RPC_ENDPOINTS);

  for (const endpoint of endpoints) {
    if (!endpoint || tried.has(endpoint)) continue;
    tried.add(endpoint);
    const conn =
      preferred?.rpcEndpoint === endpoint
        ? preferred
        : createSolanaConnection(endpoint);
    try {
      const result = await fn(conn);
      return { result, connection: conn };
    } catch (err) {
      console.warn(
        `[RPC Fallback] Falha no endpoint: ${endpoint}. Tentando o próximo...`,
        err,
      );
      lastError = err;
      if (!shouldTryNextRpc(err)) throw err;
    }
  }

  throw lastError ?? new Error("All Solana RPC endpoints failed");
}

export async function pickLiveServerConnection(
  preferred?: Connection,
): Promise<Connection> {
  const { connection } = await executeWithRpcFallback(async (conn) => {
    await conn.getSlot("confirmed");
    return true;
  }, preferred);
  return connection;
}

export async function rpcWithFallback<T>(
  primary: Connection,
  operation: (connection: Connection) => Promise<T>,
): Promise<{ value: T; connection: Connection }> {
  const { result, connection } = await executeWithRpcFallback(
    operation,
    primary,
  );
  return { value: result, connection };
}
