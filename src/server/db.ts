import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

const DEFAULT_URL = "postgresql://postgres:postgres@localhost:54329/portal";

/** Create a Prisma client for a connection string. Tests use this to point at throwaway databases. */
export function createPrismaClient(url = process.env.DATABASE_URL ?? DEFAULT_URL): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: url,
    // Serverless hosts run many small instances: keep each pool small and use the provider's pooled URL.
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** App-wide singleton (survives dev hot-reloads). */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
