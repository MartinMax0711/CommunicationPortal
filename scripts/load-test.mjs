// Load test: many signed-in team members hitting the portal at once.
//
//   npm run build && npm start            # in one terminal (production mode)
//   node scripts/load-test.mjs --url http://localhost:3000 --users 40 --connections 60 --duration 20
//
// It creates a temporary session for up to --users ACTIVE accounts (straight in the DB — no passwords needed),
// gives each simulated client a different account, cycles through the main pages, then deletes the sessions.
import "dotenv/config";
import autocannon from "autocannon";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), all[i + 1]?.startsWith("--") ? "true" : (all[i + 1] ?? "true")]);
    return acc;
  }, []),
);

const url = (args.url ?? "http://localhost:3000").replace(/\/+$/, "");
const userCount = Number(args.users ?? 40);
const connections = Number(args.connections ?? 60);
const duration = Number(args.duration ?? 20);
const staffPages = args.staff === "true";
const PAGES = ["/today", "/my-tasks", "/questions", "/settings"];
const STAFF_PAGES = ["/manage", "/manage/tasks", "/manage/review", "/manage/progress"];

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: users } = await db.query(
  `SELECT id, name, role FROM "User" WHERE status = 'ACTIVE' ${staffPages ? `AND role <> 'MEMBER'` : ""} ORDER BY name LIMIT $1`,
  [userCount],
);
if (users.length === 0) {
  console.error("No ACTIVE users found. Run `npm run db:seed` first.");
  process.exit(1);
}

const sessionIds = [];
const cookies = [];
for (const u of users) {
  const token = randomBytes(32).toString("base64url");
  const id = `loadtest_${randomBytes(8).toString("hex")}`;
  await db.query(
    `INSERT INTO "Session" (id, "tokenHash", "userId", "expiresAt", "createdAt", "lastUsedAt", "userAgent")
     VALUES ($1, $2, $3, (now() AT TIME ZONE 'UTC') + interval '1 hour', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC', 'load-test')`,
    [id, createHash("sha256").update(token).digest("hex"), u.id],
  );
  sessionIds.push(id);
  cookies.push(`hk_session=${token}`);
}

const pages = staffPages ? STAFF_PAGES : PAGES;
console.log(
  `Load test → ${url}\n  ${users.length} signed-in accounts, ${connections} concurrent connections, ${duration}s\n  pages: ${pages.join(", ")}\n`,
);

// Each request carries one of the signed-in accounts (round-robin), so all of them are active at once.
let requestIndex = 0;
const withSession = (req) => ({
  ...req,
  headers: { ...req.headers, accept: "text/html", cookie: cookies[requestIndex++ % cookies.length] },
});
try {
  const result = await autocannon({
    url,
    connections,
    duration,
    requests: pages.map((path) => ({ method: "GET", path, setupRequest: withSession })),
  });
  const bad = result.non2xx + result.errors + result.timeouts;
  console.log(autocannon.printResult(result, { renderResultsTable: true, renderLatencyTable: true }));
  console.log(
    [
      `Summary: ${result.requests.total} page loads in ${duration}s = ${result.requests.average.toFixed(1)} req/s`,
      `Latency: p50 ${result.latency.p50} ms · p90 ${result.latency.p90} ms · p99 ${result.latency.p99} ms · max ${result.latency.max} ms`,
      `Failures: ${bad} (non-2xx ${result.non2xx}, errors ${result.errors}, timeouts ${result.timeouts})`,
    ].join("\n"),
  );
  process.exitCode = bad > 0 ? 1 : 0;
} finally {
  await db.query(`DELETE FROM "Session" WHERE id = ANY($1)`, [sessionIds]);
  await db.end();
}
