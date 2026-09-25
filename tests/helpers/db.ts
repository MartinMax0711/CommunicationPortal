import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { createPrismaClient, type Db } from "@/server/db";

const ADMIN_URL = "postgresql://postgres:postgres@localhost:54329/postgres";
const TEMPLATE = "hk_template";

export interface TestDb {
  db: Db;
  name: string;
  drop(): Promise<void>;
}

async function withAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/**
 * A brand-new database cloned from the migrated template. Every test file gets its own,
 * so test files (and parallel test runs) never interfere with each other.
 *
 *   let t: TestDb;
 *   beforeAll(async () => { t = await createTestDb(); });
 *   afterAll(async () => { await t.drop(); });
 */
export async function createTestDb(): Promise<TestDb> {
  const name = `hk_test_${randomBytes(6).toString("hex")}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await withAdmin((c) => c.query(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE}"`));
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e; // template busy (another run is migrating/cloning) — retry
      await new Promise((r) => setTimeout(r, 150 + attempt * 100));
    }
  }
  if (lastErr) throw lastErr;
  const db = createPrismaClient(`postgresql://postgres:postgres@localhost:54329/${name}`);
  return {
    db,
    name,
    async drop() {
      await db.$disconnect();
      await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
    },
  };
}
