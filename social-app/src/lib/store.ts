import { promises as fs } from "fs";
import path from "path";
import { buildSeedDatabase } from "./seed";
import type { Database } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDb(): Promise<Database> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw) as Database;
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
