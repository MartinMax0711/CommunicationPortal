// Make someone the site admin (the person who approves leaders/mentors/teachers),
// or reset anyone's password without changing their access.
//
//   npm run admin -- --email you@example.com [--name "Your Name"] [--password "..."] [--role CAPTAIN] [--subteam BUILD]
//   npm run admin -- --reset-only --email member@example.com [--password "..."]
//
// Existing account -> becomes an ACTIVE admin (role/subteam/name/password updated only if given).
// New account      -> created as an ACTIVE admin (--name required; a random password is printed once if none is given).
// --reset-only     -> existing account only: sets a new password (random unless --password is given) and signs
//                     them out everywhere. Admin access, position and status are left exactly as they are.
//
// Runs with tsx, outside Next.js: only import modules that don't pull in "server-only".
import "dotenv/config";
import { randomInt } from "node:crypto";
import { parseArgs } from "node:util";
import type { z } from "zod";
import type { Role, Subteam } from "../src/generated/prisma/enums";
import { ROLES, ROLE_LABELS, SEAT_LIMITS, STATUS_LABELS, SUBTEAMS, SUBTEAM_LABELS, subteamForRole } from "../src/lib/constants";
import { emailSchema, nameSchema, passwordSchema } from "../src/lib/validation";
import { hashPassword } from "../src/server/auth/password";
import { createPrismaClient } from "../src/server/db";

const USAGE = `Usage:
  npm run admin -- --email you@example.com [--name "Your Name"] [--password "..."] [--role CAPTAIN] [--subteam BUILD]
  npm run admin -- --reset-only --email someone@example.com [--password "..."]

Options:
  --email       Account email (required). Can also be given as the first argument.
  --name        Display name (required when creating a new account).
  --password    Password (min 8 characters). New accounts (and --reset-only) get a random one if omitted.
  --role        ${ROLES.join(" | ")}  (new accounts default to MENTOR)
  --subteam     ${SUBTEAMS.join(" | ")}  (required for MEMBER; leaders get their role's subteam)
  --reset-only  Only set a new password for an existing account (and sign them out everywhere).
                Does NOT make them an admin or change their position or status.
  --help        Show this help.`;

class UsageError extends Error {}

function fail(message: string): never {
  throw new UsageError(message);
}

function parse<S extends z.ZodType>(schema: S, value: unknown, flag: string): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) fail(`${flag}: ${r.error.issues[0]?.message ?? "invalid value"}`);
  return r.data;
}

function parseEnum<T extends string>(values: readonly T[], raw: string | undefined, flag: string): T | undefined {
  if (raw === undefined) return undefined;
  const v = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!(values as readonly string[]).includes(v)) fail(`${flag} must be one of: ${values.join(", ")}`);
  return v as T;
}

/** Leaders -> their subteam, captain/mentor/teacher -> none, member -> must be given. */
function normalizeSubteam(role: Role, subteam: Subteam | null | undefined): Subteam | null {
  const implied = subteamForRole(role);
  if (implied !== undefined) return implied;
  if (!subteam) fail("--subteam is required for a MEMBER (SOFTWARE, BUILD, or BUSINESS).");
  return subteam;
}

/** 16 characters, no look-alikes (0/O, 1/l/I). */
function generatePassword(length = 16): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

function describe(role: Role, subteam: Subteam | null) {
  return role === "MEMBER" && subteam ? `${SUBTEAM_LABELS[subteam]} member` : ROLE_LABELS[role];
}

async function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        email: { type: "string" },
        name: { type: "string" },
        password: { type: "string" },
        role: { type: "string" },
        subteam: { type: "string" },
        "reset-only": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  const { values, positionals } = args;
  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (positionals.length > 1) fail(`Unexpected arguments: ${positionals.slice(1).join(" ")}`);

  const email = parse(emailSchema, values.email ?? positionals[0], "--email");
  const name = values.name !== undefined ? parse(nameSchema, values.name, "--name") : undefined;
  const password = values.password !== undefined ? parse(passwordSchema, values.password, "--password") : undefined;
  const role = parseEnum(ROLES, values.role, "--role");
  const subteam = parseEnum(SUBTEAMS, values.subteam, "--subteam");

  if (values["reset-only"]) {
    if (name !== undefined || role !== undefined || subteam !== undefined) {
      fail("--reset-only only changes the password; leave out --name, --role and --subteam.");
    }
    await resetPasswordOnly(email, password);
    return;
  }

  const db = createPrismaClient();
  try {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: true, subteam: true, status: true, isAdmin: true },
    });

    let generated: string | null = null;
    let action: string;
    let user: { name: string; email: string; role: Role; subteam: Subteam | null };

    if (existing) {
      const nextRole = role ?? existing.role;
      const nextSubteam = role || subteam ? normalizeSubteam(nextRole, subteam ?? existing.subteam) : existing.subteam;
      user = await db.user.update({
        where: { id: existing.id },
        data: {
          isAdmin: true,
          status: "ACTIVE",
          role: nextRole,
          subteam: nextSubteam,
          ...(name ? { name } : {}),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
        select: { name: true, email: true, role: true, subteam: true },
      });
      action = existing.isAdmin && existing.status === "ACTIVE" ? "Updated existing admin" : "Made existing account an admin";
    } else {
      if (!name) fail('--name is required when creating a new account, e.g. --name "Alex Kim".');
      const nextRole = role ?? "MENTOR";
      const nextSubteam = normalizeSubteam(nextRole, subteam);
      const finalPassword = password ?? (generated = generatePassword());
      user = await db.user.create({
        data: {
          email,
          name,
          passwordHash: await hashPassword(finalPassword),
          role: nextRole,
          subteam: nextSubteam,
          status: "ACTIVE",
          isAdmin: true,
        },
        select: { name: true, email: true, role: true, subteam: true },
      });
      action = "Created new admin account";
    }

    const limit = SEAT_LIMITS[user.role];
    const seatWarning =
      limit !== undefined && (await db.user.count({ where: { role: user.role, status: "ACTIVE" } })) > limit
        ? `\n  Note: ${ROLE_LABELS[user.role]} now has more than ${limit} active ${limit === 1 ? "person" : "people"} (seat limit).`
        : "";

    console.log(
      [
        "",
        `${action}.`,
        `  Name:      ${user.name}`,
        `  Email:     ${user.email}`,
        `  Position:  ${describe(user.role, user.subteam)}`,
        "  Access:    Active, admin",
        password ? `  Password:  ${existing ? "updated to" : "set to"} the one you provided` : "",
        generated ? `  Password:  ${generated}` : "",
        generated ? "             (shown only once — sign in and change it in Settings)" : "",
      ]
        .filter(Boolean)
        .join("\n") + seatWarning + "\n",
    );
  } finally {
    await db.$disconnect();
  }
}

/** --reset-only: new password for an existing account; isAdmin, role, subteam and status stay untouched. */
async function resetPasswordOnly(email: string, password: string | undefined) {
  const db = createPrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!existing) fail(`No account uses ${email}. Check the spelling, or leave out --reset-only to create one.`);
    const generated = password ? null : generatePassword();
    const passwordHash = await hashPassword(password ?? generated!);
    const now = new Date();
    const [user, , signedOut] = await db.$transaction([
      db.user.update({
        where: { id: existing.id },
        data: { passwordHash },
        select: { name: true, email: true, role: true, subteam: true, status: true, isAdmin: true },
      }),
      // Links from "Forgot password" would otherwise still let someone pick a different password.
      db.passwordResetToken.updateMany({ where: { userId: existing.id, usedAt: null }, data: { usedAt: now } }),
      db.session.deleteMany({ where: { userId: existing.id } }),
      // Also lift the account-level sign-in lockout so the new password works right away.
      db.rateLimit.deleteMany({ where: { key: `login:acct:${email}` } }),
    ]);
    console.log(
      [
        "",
        "Password reset (access unchanged).",
        `  Name:      ${user.name}`,
        `  Email:     ${user.email}`,
        `  Position:  ${describe(user.role, user.subteam)}`,
        `  Access:    ${STATUS_LABELS[user.status]}${user.isAdmin ? ", admin" : ""}`,
        password ? "  Password:  updated to the one you provided" : `  Password:  ${generated}`,
        password ? "" : "             (shown only once — send it to them privately; they can change it in Settings)",
        `  Signed out of ${signedOut.count} device${signedOut.count === 1 ? "" : "s"}.`,
        user.status === "ACTIVE" ? "" : "  Note: this account isn't active, so they still can't use the portal until an admin changes that.",
      ]
        .filter(Boolean)
        .join("\n") + "\n",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  if (e instanceof UsageError) {
    console.error(`Error: ${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  console.error("Could not update the account:", e instanceof Error ? e.message : e);
  process.exit(1);
});
