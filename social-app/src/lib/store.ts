import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_SETTINGS } from "./economy";
import { buildSeedDatabase } from "./seed";
import type { Database, Message, User } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

let writeQueue: Promise<void> = Promise.resolve();

function migrateUser(u: Partial<User> & { id: string }): User {
  return {
    id: u.id,
    name: u.name ?? "Usuário",
    age: u.age ?? 18,
    gender: u.gender ?? "homem",
    photoUrl: u.photoUrl ?? "",
    verified: Boolean(u.verified),
    bio: u.bio ?? "",
    credits: u.credits ?? 0,
    balanceBrl: u.balanceBrl ?? 0,
    cumulativeSpendBrl: u.cumulativeSpendBrl ?? 0,
    cumulativeEarningsBrl: u.cumulativeEarningsBrl ?? 0,
    cumulativeHourPayBrl: u.cumulativeHourPayBrl ?? 0,
    freeMessagesDate: u.freeMessagesDate ?? new Date().toISOString().slice(0, 10),
    freeMessagesUsed: u.freeMessagesUsed ?? 0,
    freePhotosUsed: u.freePhotosUsed ?? 0,
    hourlyRateBrl: u.hourlyRateBrl ?? DEFAULT_SETTINGS.defaultHourlyRateBrl,
    shiftStatus: u.shiftStatus ?? "offline",
    onlineMinutesToday: u.onlineMinutesToday ?? 0,
    onlineMinutesDate:
      u.onlineMinutesDate ?? new Date().toISOString().slice(0, 10),
    shiftStartedAt: u.shiftStartedAt ?? null,
    activityScore: u.activityScore ?? 0,
    isSeed: Boolean(u.isSeed),
    isDebugPreset: u.isDebugPreset,
    createdAt: u.createdAt ?? new Date().toISOString(),
  };
}

function migrateMessage(m: Partial<Message> & { id: string }): Message {
  return {
    id: m.id,
    conversationId: m.conversationId ?? "",
    fromUserId: m.fromUserId ?? "",
    toUserId: m.toUserId ?? "",
    text: m.text ?? "",
    kind: m.kind ?? "text",
    createdAt: m.createdAt ?? new Date().toISOString(),
    paid: Boolean(m.paid),
    platformShareBrl: m.platformShareBrl ?? 0,
    creatorShareBrl: m.creatorShareBrl ?? 0,
    photoUrl: m.photoUrl,
    photoIndex: m.photoIndex,
    photoFree: m.photoFree,
    photoCreditsCost: m.photoCreditsCost,
    photoUnlocked: m.photoUnlocked,
    photoViewStatus: m.photoViewStatus,
    photoViewedAt: m.photoViewedAt ?? null,
    photoUnlockedAt: m.photoUnlockedAt ?? null,
    photoUnlockedBy: m.photoUnlockedBy ?? null,
  };
}

function migrateDb(raw: Partial<Database>): Database {
  return {
    users: (raw.users ?? []).map((u) => migrateUser(u)),
    conversations: raw.conversations ?? [],
    messages: (raw.messages ?? []).map((m) => migrateMessage(m)),
    purchases: raw.purchases ?? [],
    withdrawals: raw.withdrawals ?? [],
    ledger: raw.ledger ?? [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw.settings ?? {}),
    },
    initializedAt: raw.initializedAt ?? new Date().toISOString(),
  };
}

async function ensureDb(): Promise<Database> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const migrated = migrateDb(JSON.parse(raw) as Partial<Database>);
    return migrated;
  } catch {
    const seed = buildSeedDatabase();
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

export async function readDb(): Promise<Database> {
  return ensureDb();
}

export async function updateDb<T>(
  mutator: (db: Database) => T | Promise<T>
): Promise<{ result: T; db: Database }> {
  let result!: T;
  writeQueue = writeQueue.then(async () => {
    const db = await ensureDb();
    result = await mutator(db);
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  });
  await writeQueue;
  const db = await ensureDb();
  return { result, db };
}

export async function resetDb(): Promise<Database> {
  const seed = buildSeedDatabase();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
  return seed;
}
