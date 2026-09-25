import "server-only";
import type { Actor } from "./actor";
import { getCurrentUser } from "./auth/session";
import { type Db, prisma } from "./db";
import { env } from "./env";
import { UnauthorizedError } from "./errors";
import { appNotifier } from "./notifications";
import type { Notifier } from "./notifications/events";

export interface PublicContext {
  db: Db;
  notifier: Notifier;
  now: Date;
  config: { appUrl: string; teamTimezone: string; adminEmails: string[]; teamJoinCode: string | null };
}

/** Everything a service needs. Tests build these by hand (see tests/helpers). */
export interface ServiceContext extends PublicContext {
  actor: Actor;
}

export function getPublicContext(): PublicContext {
  return {
    db: prisma,
    notifier: appNotifier,
    now: new Date(),
    config: {
      appUrl: env.appUrl,
      teamTimezone: env.teamTimezone,
      adminEmails: env.adminEmails,
      teamJoinCode: env.teamJoinCode,
    },
  };
}

/** For Server Actions: context for the signed-in ACTIVE user. Throws UnauthorizedError otherwise. */
export async function getServiceContext(): Promise<ServiceContext> {
  const actor = await getCurrentUser();
  if (!actor || actor.status !== "ACTIVE") throw new UnauthorizedError();
  return { ...getPublicContext(), actor };
}
