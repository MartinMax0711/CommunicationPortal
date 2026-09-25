// Local development Postgres — no Docker or system install needed.
// Runs a real PostgreSQL server from node_modules (embedded-postgres),
// storing data in ./.data/pg. Keep this running while you develop/test:
//   npm run db:start
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);
const dataDir = path.resolve(process.cwd(), ".data/pg");
const databases = ["portal", "hk_template"];

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  onLog: () => {},
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) {
  console.log("[local-db] initialising new cluster in", dataDir);
  await pg.initialise();
}
await pg.start();
for (const name of databases) {
  try {
    await pg.createDatabase(name);
    console.log(`[local-db] created database ${name}`);
  } catch {
    // already exists
  }
}
console.log(`[local-db] Postgres ready on postgresql://postgres:postgres@localhost:${PORT}/portal`);

const shutdown = async () => {
  console.log("[local-db] stopping…");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
