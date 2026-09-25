import { execSync } from "node:child_process";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "../playwright.config";

const ADMIN_URL = "postgresql://postgres:postgres@localhost:54329/postgres";
const TEMPLATE_URL = "postgresql://postgres:postgres@localhost:54329/hk_template";

/** Fresh portal_e2e database = migrated template + demo team. Needs `npm run db:start`. */
export default async function globalSetup() {
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEMPLATE_URL, DIRECT_URL: TEMPLATE_URL },
  });
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "portal_e2e" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "portal_e2e" TEMPLATE "hk_template"`);
  } finally {
    await admin.end();
  }
  execSync("npx tsx prisma/seed.ts", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DOTENV_CONFIG_QUIET: "true" },
  });
}
