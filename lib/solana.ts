import {
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  type Commitment,
  type ConnectionConfig,
} from "@solana/web3.js";
import bs58 from "bs58";

/** Fortaleza local auto-custody simulation — secret key in browser storage. */
export const FORTALEZA_SECRET_STORAGE_KEY = "aether-fortaleza-secret";

export const VISION_MINT_ADDRESS =
  process.env.NEXT_PUBLIC_VISION_MINT_ADDRESS?.trim() ||
  "2iGxAEtYLYb8NBvtQEoPbuDZzTEezWzu7G3nYDrabftv";

export const TREASURY_WALLET =
  process.env.NEXT_PUBLIC_TREASURY_WALLET?.trim() ||
  "9V7rtShwij5kAKJUjBrCB5y2QaGLKUbUSwSGyKBN6911";

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

/** Connection rooted in `NEXT_PUBLIC_SOLANA_RPC_URL` (browser uses local RPC proxy). */
export function getSolanaConnection(): Connection {
  const envRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  const endpoint =
    typeof window !== "undefined"
      ? getClientRpcEndpoint()
      : envRpc || PRIMARY_SOLANA_RPC;
  return createSolanaConnection(endpoint);
}

export function shortenAddress(address: string, chars = 4): string {
  const value = address.trim();
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

/**
 * Generate a Solana Keypair if missing; persist SecretKey in localStorage
 * for Fortaleza auto-custody simulation (device-local only).
 */
export function getOrCreateLocalWallet(): Keypair {
  if (typeof window === "undefined") {
    throw new Error("getOrCreateLocalWallet is browser-only");
  }

  const existing = window.localStorage.getItem(FORTALEZA_SECRET_STORAGE_KEY);
  if (existing) {
    try {
      const secret =
        existing.startsWith("[")
          ? Uint8Array.from(JSON.parse(existing) as number[])
          : bs58.decode(existing);
      return Keypair.fromSecretKey(secret);
    } catch {
      window.localStorage.removeItem(FORTALEZA_SECRET_STORAGE_KEY);
    }
  }

  const keypair = Keypair.generate();
  window.localStorage.setItem(
    FORTALEZA_SECRET_STORAGE_KEY,
    bs58.encode(keypair.secretKey),
  );
  return keypair;
}

export async function getSolBalance(publicKeyStr: string): Promise<number> {
  const connection = getSolanaConnection();
  const lamports = await connection.getBalance(
    new PublicKey(publicKeyStr),
    "confirmed",
  );
  return lamports / LAMPORTS_PER_SOL;
}

async function readTokenUiBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  programId: PublicKey,
): Promise<number | null> {
  try {
    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      programId,
    );
    const account = await getAccount(connection, ata, "confirmed", programId);
    const mintInfo = await getMint(connection, mint, "confirmed", programId);
    return Number(account.amount) / 10 ** mintInfo.decimals;
  } catch {
    return null;
  }
}

export async function getVisionBalance(publicKeyStr: string): Promise<number> {
  const connection = getSolanaConnection();
  const owner = new PublicKey(publicKeyStr);
  const mint = new PublicKey(VISION_MINT_ADDRESS);

  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const balance = await readTokenUiBalance(
      connection,
      owner,
      mint,
      programId,
    );
    if (balance != null) return balance;
  }

  return 0;
}
