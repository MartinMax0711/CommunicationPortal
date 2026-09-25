import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Bring the hk_template database up to the latest migrations (idempotent). Needs `npm run db:start`. */
export default function setup() {
  config({ path: ".env.test", override: true });
  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DIRECT_URL: process.env.DATABASE_URL },
    });
  } catch (e) {
    const out = e instanceof Error && "stderr" in e ? String((e as { stderr: unknown }).stderr) : String(e);
    throw new Error(`Could not migrate the test template database. Is \`npm run db:start\` running?\n${out}`);
  }
}
