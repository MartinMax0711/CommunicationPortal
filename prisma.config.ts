import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrations) prefers DIRECT_URL — a non-pooled connection — when your host provides one
// (Neon/Supabase). The running app always uses DATABASE_URL (pooled) via src/server/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env["DIRECT_URL"] ||
      process.env["DATABASE_URL"] ||
      "postgresql://postgres:postgres@localhost:54329/portal",
  },
});
