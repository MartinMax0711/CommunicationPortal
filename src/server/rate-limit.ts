import type { Db } from "./db";
import { RateLimitError } from "./errors";

/**
 * Fixed-window counter stored in Postgres, so it works across serverless instances.
 * Returns true if the call is allowed.
 */
export async function consumeRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  // Now and then, drop counters whose window ended long ago so the table stays tiny.
  if (Math.random() < 0.01) {
    const stale = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: stale } } }).catch(() => {});
  }
  return (rows[0]?.count ?? 1) <= limit;
}

/** Forget a counter (e.g. after a successful sign-in, so only failures count toward a lockout). */
export async function resetRateLimit(db: Db, key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Throws RateLimitError when over the limit. */
export async function enforceRateLimit(db: Db, key: string, limit: number, windowMs: number, now?: Date) {
  if (!(await consumeRateLimit(db, key, limit, windowMs, now))) throw new RateLimitError();
}
