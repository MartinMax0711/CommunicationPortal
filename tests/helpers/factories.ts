import type { AccountStatus, Priority, Role, Subteam } from "@/generated/prisma/enums";
import { dateOnlyToDb, type DateOnly, todayInTimezone } from "@/lib/dates";
import { type Actor, actorSelect } from "@/server/actor";
import type { PublicContext, ServiceContext } from "@/server/context";
import type { Db } from "@/server/db";
import { CollectingNotifier } from "@/server/notifications/events";

export const TEST_TZ = "America/Los_Angeles";
/** Fixed "now" for deterministic tests: 2026-09-24 12:00 in Anaheim. */
export const TEST_NOW = new Date("2026-09-24T19:00:00Z");
export const TEST_TODAY: DateOnly = todayInTimezone(TEST_TZ, TEST_NOW); // "2026-09-24"
/** Password for every factory user. */
export const TEST_PASSWORD = "husky-password-1";

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

// Precomputed scrypt hash of TEST_PASSWORD would tie tests to parameters; hash lazily once instead.
let passwordHash: Promise<string> | null = null;
async function testPasswordHash() {
  const { hashPassword } = await import("@/server/auth/password");
  passwordHash ??= hashPassword(TEST_PASSWORD);
  return passwordHash;
}

export interface MakeUserInput {
  name?: string;
  email?: string;
  role?: Role;
  subteam?: Subteam | null;
  status?: AccountStatus;
  isAdmin?: boolean;
  prefs?: Partial<{
    emailOnQuestion: boolean;
    emailOnSubmission: boolean;
    emailOnReply: boolean;
    emailOnReview: boolean;
    emailOnAssigned: boolean;
    emailOnSignup: boolean;
  }>;
}

const defaultSubteam: Partial<Record<Role, Subteam>> = {
  MEMBER: "BUILD",
  SOFTWARE_LEADER: "SOFTWARE",
  BUILD_LEADER: "BUILD",
  BUSINESS_LEADER: "BUSINESS",
};

/** Create a user (ACTIVE by default). Leaders get their role's subteam automatically. */
export async function makeUser(db: Db, input: MakeUserInput = {}): Promise<Actor> {
  const role = input.role ?? "MEMBER";
  const id = uniq();
  return db.user.create({
    data: {
      name: input.name ?? `${role.toLowerCase()} ${id}`,
      email: (input.email ?? `${role.toLowerCase()}-${id}@example.com`).toLowerCase(),
      passwordHash: await testPasswordHash(),
      role,
      subteam: input.subteam !== undefined ? input.subteam : (defaultSubteam[role] ?? null),
      status: input.status ?? "ACTIVE",
      isAdmin: input.isAdmin ?? false,
      ...input.prefs,
    },
    select: actorSelect,
  });
}

export interface MakeTaskInput {
  title?: string;
  description?: string;
  subteam?: Subteam | null;
  dueDate?: DateOnly;
  priority?: Priority;
  assigneeIds?: string[];
}

/** Create a task (plus TODO assignments) directly in the DB, bypassing services. */
export async function makeTask(db: Db, creator: Pick<Actor, "id" | "subteam">, input: MakeTaskInput = {}) {
  return db.task.create({
    data: {
      title: input.title ?? `Task ${uniq()}`,
      description: input.description ?? "",
      subteam: input.subteam !== undefined ? input.subteam : creator.subteam,
      dueDate: dateOnlyToDb(input.dueDate ?? TEST_TODAY),
      priority: input.priority ?? "NORMAL",
      createdById: creator.id,
      assignments: { create: (input.assigneeIds ?? []).map((userId) => ({ userId })) },
    },
    include: { assignments: true },
  });
}

export function publicContext(db: Db, overrides: Partial<PublicContext["config"]> = {}) {
  const notifier = new CollectingNotifier();
  const ctx: PublicContext = {
    db,
    notifier,
    now: TEST_NOW,
    config: { appUrl: "http://localhost:3000", teamTimezone: TEST_TZ, adminEmails: [], teamJoinCode: null, ...overrides },
  };
  return Object.assign(ctx, { notifier });
}

/** A ServiceContext for `actor` with a CollectingNotifier you can assert on (ctx.notifier.events). */
export function contextFor(db: Db, actor: Actor, overrides: Partial<PublicContext["config"]> = {}) {
  const base = publicContext(db, overrides);
  const ctx: ServiceContext & { notifier: CollectingNotifier } = { ...base, actor };
  return ctx;
}
