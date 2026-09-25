import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrations) prefers a direct, non-pooled connection when the host provides one:
// DIRECT_URL (set by hand), DATABASE_URL_UNPOOLED (Vercel's Neon integration) or POSTGRES_URL_NON_POOLING.
// The running app always uses DATABASE_URL (pooled) via src/server/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env["DIRECT_URL"] ||
      process.env["DATABASE_URL_UNPOOLED"] ||
      process.env["POSTGRES_URL_NON_POOLING"] ||
      process.env["DATABASE_URL"] ||
      "postgresql://postgres:postgres@localhost:54329/portal",
  },
});
