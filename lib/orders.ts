import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PublicKey } from "@solana/web3.js";
import { PRESALE_TIERS, VISION_PRICE_USD, visionForUsd } from "@/lib/presale";

export type PayMethod = "sol" | "pix";
export type OrderStatus =
  | "created"
  | "awaiting_payment"
  | "paid"
  | "fulfilled"
  | "failed";

export type VisionOrder = {
  id: string;
  tierId: string | null;
  tierName: string;
  usd: number;
  brl: number;
  visionAmount: number;
  destPubkey: string;
  method: PayMethod;
  status: OrderStatus;
  pixCopyPaste: string | null;
  pixTxid: string | null;
  solLamports: number | null;
  solSignature: string | null;
  splSignature: string | null;
  fulfillError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderInput = {
  method: PayMethod;
  destPubkey: string;
  usd: number;
  solLamports?: number | null;
  tierId?: string | null;
  tierName?: string;
  visionAmount?: number;
};

const FILE_PATH = process.env.VERCEL
  ? join("/tmp", "aether-orders.json")
  : join(process.cwd(), ".data", "orders.json");

function nowIso() {
  return new Date().toISOString();
}

export function brlFromUsd(usd: number): number {
  const rate = Number(process.env.PIX_BRL_PER_USD ?? "5.5");
  const safe = Number.isFinite(rate) && rate > 0 ? rate : 5.5;
  return Math.round(usd * safe * 100) / 100;
}

function visionAmountFor(usd: number, tierId: string | null): number {
  const tier = PRESALE_TIERS.find((item) => item.id === tierId);
  if (tier) return visionForUsd(usd, tier.bonusPct);
  return usd / VISION_PRICE_USD;
}

export function assertDestPubkey(value: string): string {
  const trimmed = value.trim();
  const key = new PublicKey(trimmed);
  return key.toBase58();
}

function postgresUrl(): string | null {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  let url = raw.replace(/^['"]+|['"]+$/g, "").trim();
  if (!url) return null;

  const mint = process.env.TOKEN_MINT?.trim();
  if (mint && url === mint) {
    console.error(
      "[orders] DATABASE_URL is set to TOKEN_MINT. Neon was not called; using file fallback.",
    );
    return null;
  }

  if (/^postgres:\/\//i.test(url)) {
    url = `postgresql://${url.slice("postgres://".length)}`;
  }
  if (!/^postgresql:\/\//i.test(url)) {
    console.error(
      "[orders] DATABASE_URL must be a postgresql:// URI (Neon pooler). Non-postgres value ignored; using file fallback.",
    );
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.get("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    return parsed.toString();
  } catch {
    console.error("[orders] DATABASE_URL is not a valid URI; using file fallback.");
    return null;
  }
}

function assertPostgresOnVercel() {
  if (process.env.VERCEL && !usesPostgresDatabase()) {
    throw new Error(
      "DATABASE_URL must be a Neon postgresql:// pooler URI. File /tmp storage is disabled in production.",
    );
  }
}

export function usesPostgresDatabase(): boolean {
  return Boolean(postgresUrl());
}

function fileBackend() {
  return !usesPostgresDatabase();
}

async function readFileOrders(): Promise<VisionOrder[]> {
  try {
    const raw = await readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as VisionOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileOrders(orders: VisionOrder[]) {
  await mkdir(dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(orders, null, 2), "utf8");
}

async function pgQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const url = postgresUrl();
  if (!url) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sqlFn = neon(url);
    const rows = await sqlFn.query(sql, params);
    return rows as T[];
  } catch (error) {
    console.error("[orders] Neon query failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function ensureOrderTable() {
  if (fileBackend()) return;
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS vision_orders (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL
    )
  `);
}

function fromRow(row: { id: string; payload: VisionOrder | string }): VisionOrder {
  const payload =
    typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  return payload as VisionOrder;
}

export async function createOrder(input: CreateOrderInput): Promise<VisionOrder> {
  const destPubkey = assertDestPubkey(input.destPubkey);
  if (input.method !== "sol" && input.method !== "pix") {
    throw new Error("method must be sol or pix");
  }
  if (!Number.isFinite(input.usd) || input.usd <= 0) {
    throw new Error("usd must be a positive number");
  }

  const id = randomUUID();
  const tierId = input.tierId ?? null;
  const order: VisionOrder = {
    id,
    tierId,
    tierName: input.tierName ?? "Vision allocation",
    usd: input.usd,
    brl: brlFromUsd(input.usd),
    visionAmount:
      input.visionAmount && input.visionAmount > 0
        ? input.visionAmount
        : visionAmountFor(input.usd, tierId),
    destPubkey,
    method: input.method,
    status: "awaiting_payment",
    pixCopyPaste: null,
    pixTxid: input.method === "pix" ? id.replace(/-/g, "").slice(0, 25) : null,
    solLamports: input.solLamports ?? null,
    solSignature: null,
    splSignature: null,
    fulfillError: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  assertPostgresOnVercel();

  if (fileBackend()) {
    console.log("[orders] using file backend (.data/orders.json)");
    const orders = await readFileOrders();
    orders.push(order);
    await writeFileOrders(orders);
    return order;
  }

  await ensureOrderTable();
  console.log("[orders] using Neon postgres");
  await pgQuery(
    `INSERT INTO vision_orders (id, payload) VALUES ($1, $2::jsonb)`,
    [order.id, JSON.stringify(order)],
  );
  return order;
}

export async function getOrder(id: string): Promise<VisionOrder | null> {
  assertPostgresOnVercel();
  if (fileBackend()) {
    const orders = await readFileOrders();
    return orders.find((item) => item.id === id) ?? null;
  }
  await ensureOrderTable();
  const rows = await pgQuery<{ id: string; payload: VisionOrder }>(
    `SELECT id, payload FROM vision_orders WHERE id = $1`,
    [id],
  );
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function updateOrder(
  id: string,
  patch: Partial<VisionOrder>,
): Promise<VisionOrder | null> {
  assertPostgresOnVercel();
  const current = await getOrder(id);
  if (!current) return null;
  const next: VisionOrder = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: nowIso(),
  };

  if (fileBackend()) {
    const orders = await readFileOrders();
    const index = orders.findIndex((item) => item.id === id);
    if (index < 0) return null;
    orders[index] = next;
    await writeFileOrders(orders);
    return next;
  }

  await pgQuery(`UPDATE vision_orders SET payload = $2::jsonb WHERE id = $1`, [
    id,
    JSON.stringify(next),
  ]);
  return next;
}

export async function findOrderByPixTxid(
  txid: string,
): Promise<VisionOrder | null> {
  const needle = txid.trim();
  assertPostgresOnVercel();
  if (fileBackend()) {
    const orders = await readFileOrders();
    return (
      orders.find(
        (item) => item.pixTxid === needle || item.id === needle,
      ) ?? null
    );
  }
  await ensureOrderTable();
  const rows = await pgQuery<{ id: string; payload: VisionOrder }>(
    `SELECT id, payload FROM vision_orders`,
  );
  for (const row of rows) {
    const order = fromRow(row);
    if (order.pixTxid === needle || order.id === needle) return order;
  }
  return null;
}
