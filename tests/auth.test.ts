import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "@/server/auth/password";
import { issuePasswordReset } from "@/server/auth/password-reset";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { RateLimitError, ValidationError } from "@/server/errors";
import {
  AUTH_RATE_LIMITS,
  clientIpFromHeaders,
  AUTH_MESSAGES,
  authenticate,
  getResetTokenStatus,
  registerUser,
  requestPasswordReset,
  resetPassword,
  safeRedirectPath,
} from "@/server/services/auth";
import { createTestDb, type TestDb } from "./helpers/db";
import { makeUser, publicContext, TEST_NOW, TEST_PASSWORD } from "./helpers/factories";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.drop();
});

let seq = 0;
/** A fresh IP per call so rate-limit windows never leak between tests (TEST_NOW is fixed). */
const meta = () => ({ ip: `10.1.${Math.floor(++seq / 250)}.${seq % 250}` });
const uniqueEmail = (prefix = "user") => `${prefix}-${++seq}@example.com`;

const NEW_PASSWORD = "brand-new-password-9";

function registration(overrides: Record<string, unknown> = {}) {
  return {
    name: "Alex Kim",
    email: uniqueEmail(),
    password: "strong-pass-1",
    confirmPassword: "strong-pass-1",
    role: "MEMBER",
    subteam: "BUILD",
    ...overrides,
  };
}

/** Await a rejection and return it as a ValidationError (fails the test otherwise). */
async function validationError(p: Promise<unknown>): Promise<ValidationError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ValidationError);
  return err as ValidationError;
}

async function loadUser(id: string) {
  return t.db.user.findUniqueOrThrow({ where: { id } });
}

describe("registerUser", () => {
  it("registers a member as ACTIVE with their subteam", async () => {
    const ctx = publicContext(t.db);
    const input = registration({ name: "  Jordan Lee ", email: "  Jordan.Lee@Example.COM ", subteam: "SOFTWARE" });
    const result = await registerUser(ctx, input, meta());

    expect(result.status).toBe("ACTIVE");
    const user = await loadUser(result.userId);
    expect(user).toMatchObject({
      name: "Jordan Lee",
      email: "jordan.lee@example.com",
      role: "MEMBER",
      subteam: "SOFTWARE",
      status: "ACTIVE",
      isAdmin: false,
      approvedAt: null,
    });
    expect(user.passwordHash).not.toContain("strong-pass-1");
    expect(await verifyPassword("strong-pass-1", user.passwordHash)).toBe(true);
    expect(ctx.notifier.events).toEqual([]);
  });

  it("requires a subteam for members", async () => {
    const ctx = publicContext(t.db);
    const email = uniqueEmail();
    const err = await validationError(registerUser(ctx, registration({ email, subteam: "" }), meta()));
    expect(err.fieldErrors.subteam).toBe("Choose your subteam.");
    expect(await t.db.user.count({ where: { email } })).toBe(0);

    const bad = await validationError(registerUser(ctx, registration({ subteam: "ROBOTS" }), meta()));
    expect(bad.fieldErrors.subteam).toBe("Choose your subteam.");
  });

  it("registers a leader as PENDING with the subteam implied by their role and notifies admins", async () => {
    const ctx = publicContext(t.db);
    // A submitted subteam that contradicts the role is ignored.
    const result = await registerUser(ctx, registration({ role: "BUILD_LEADER", subteam: "SOFTWARE" }), meta());

    expect(result.status).toBe("PENDING");
    const user = await loadUser(result.userId);
    expect(user).toMatchObject({ role: "BUILD_LEADER", subteam: "BUILD", status: "PENDING", isAdmin: false });
    expect(ctx.notifier.events).toEqual([{ type: "account.pending", userId: result.userId }]);

    const sw = await registerUser(ctx, registration({ role: "SOFTWARE_LEADER", subteam: undefined }), meta());
    expect((await loadUser(sw.userId)).subteam).toBe("SOFTWARE");
    const biz = await registerUser(ctx, registration({ role: "BUSINESS_LEADER", subteam: "" }), meta());
    expect((await loadUser(biz.userId)).subteam).toBe("BUSINESS");
    expect(ctx.notifier.ofType("account.pending").map((e) => e.userId)).toEqual([result.userId, sw.userId, biz.userId]);
  });

  it.each(["CAPTAIN", "MENTOR", "TEACHER"] as const)("gives a %s no subteam even if one is submitted", async (role) => {
    const ctx = publicContext(t.db);
    const result = await registerUser(ctx, registration({ role, subteam: "BUILD" }), meta());
    expect(result.status).toBe("PENDING");
    expect(await loadUser(result.userId)).toMatchObject({ role, subteam: null, status: "PENDING" });
    expect(ctx.notifier.events).toEqual([{ type: "account.pending", userId: result.userId }]);
  });

  it("ignores status / isAdmin fields smuggled into the form", async () => {
    const ctx = publicContext(t.db);
    const result = await registerUser(
      ctx,
      registration({ role: "CAPTAIN", status: "ACTIVE", isAdmin: "true", approvedAt: new Date().toISOString() }),
      meta(),
    );
    expect(await loadUser(result.userId)).toMatchObject({ status: "PENDING", isAdmin: false, approvedAt: null });
  });

  it("rejects a duplicate email regardless of case", async () => {
    const ctx = publicContext(t.db);
    const email = uniqueEmail("dup");
    await registerUser(ctx, registration({ email }), meta());

    const err = await validationError(registerUser(ctx, registration({ email: email.toUpperCase() }), meta()));
    expect(err.fieldErrors).toEqual({ email: AUTH_MESSAGES.duplicateEmail });
    expect(await t.db.user.count({ where: { email } })).toBe(1);
  });

  it("handles two simultaneous sign-ups with the same email", async () => {
    const ctx = publicContext(t.db);
    const email = uniqueEmail("race");
    const results = await Promise.allSettled([
      registerUser(ctx, registration({ email }), meta()),
      registerUser(ctx, registration({ email: email.toUpperCase() }), meta()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ValidationError);
    expect((rejected[0].reason as ValidationError).fieldErrors.email).toBe(AUTH_MESSAGES.duplicateEmail);
    expect(await t.db.user.count({ where: { email } })).toBe(1);
  });

  it("requires the passwords to match", async () => {
    const ctx = publicContext(t.db);
    const mismatch = await validationError(registerUser(ctx, registration({ confirmPassword: "strong-pass-2" }), meta()));
    expect(mismatch.fieldErrors).toEqual({ confirmPassword: "Passwords don't match." });
    expect(mismatch.userMessage).toBe("Passwords don't match.");

    const missing = await validationError(registerUser(ctx, registration({ confirmPassword: "" }), meta()));
    expect(missing.fieldErrors.confirmPassword).toBe("Type your password again to confirm it.");
  });

  it("reports every invalid field at once", async () => {
    const ctx = publicContext(t.db);
    const err = await validationError(
      registerUser(
        ctx,
        { name: "", email: "not-an-email", password: "short", confirmPassword: "different", role: "", subteam: "" },
        meta(),
      ),
    );
    expect(err.userMessage).toBe("Please fix the highlighted fields.");
    expect(Object.keys(err.fieldErrors).sort()).toEqual(["confirmPassword", "email", "name", "password", "role"]);
    expect(err.fieldErrors.email).toBe("Enter a valid email address.");
    expect(err.fieldErrors.password).toBe("Password must be at least 8 characters.");
    expect(err.fieldErrors.role).toBe("Choose your position on the team.");

    const unknownRole = await validationError(registerUser(ctx, registration({ role: "PRESIDENT" }), meta()));
    expect(unknownRole.fieldErrors.role).toBe("Choose your position on the team.");
  });

  describe("team join code", () => {
    const config = { teamJoinCode: "Husky-2026" };

    it("is required when configured", async () => {
      const ctx = publicContext(t.db, config);
      const err = await validationError(registerUser(ctx, registration(), meta()));
      expect(err.fieldErrors).toEqual({ joinCode: AUTH_MESSAGES.missingJoinCode });
    });

    it("rejects a wrong code", async () => {
      const ctx = publicContext(t.db, config);
      const email = uniqueEmail();
      const err = await validationError(registerUser(ctx, registration({ email, joinCode: "husky-2025" }), meta()));
      expect(err.fieldErrors).toEqual({ joinCode: "That team code isn't right. Ask a leader for the current code." });
      expect(await t.db.user.count({ where: { email } })).toBe(0);
    });

    it("accepts the right code ignoring case and surrounding spaces", async () => {
      const ctx = publicContext(t.db, config);
      const result = await registerUser(ctx, registration({ joinCode: "  HUSKY-2026 " }), meta());
      expect(result.status).toBe("ACTIVE");
    });

    it("is ignored when no code is configured", async () => {
      const ctx = publicContext(t.db);
      const result = await registerUser(ctx, registration({ joinCode: "anything" }), meta());
      expect(result.status).toBe("ACTIVE");
    });
  });

  it("limits sign-up attempts per IP (so join codes can't be guessed)", async () => {
    const ctx = publicContext(t.db, { teamJoinCode: "secret" });
    const ip = meta();
    for (let i = 0; i < AUTH_RATE_LIMITS.registerPerIp.limit; i++) {
      await validationError(registerUser(ctx, registration({ joinCode: `guess-${i}` }), ip));
    }
    await expect(registerUser(ctx, registration({ joinCode: "secret" }), ip)).rejects.toBeInstanceOf(RateLimitError);
    // Another IP is unaffected.
    await expect(registerUser(ctx, registration({ joinCode: "secret" }), meta())).resolves.toMatchObject({ status: "ACTIVE" });
  });
});

describe("authenticate", () => {
  it("signs in with the right password (email is case-insensitive)", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db, { email: uniqueEmail("login") });
    const result = await authenticate(ctx, { email: `  ${user.email.toUpperCase()} `, password: TEST_PASSWORD }, meta());
    expect(result).toEqual({ userId: user.id, status: "ACTIVE" });
  });

  it("rejects a wrong password", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db);
    const err = await validationError(authenticate(ctx, { email: user.email, password: "wrong-password" }, meta()));
    expect(err.userMessage).toBe(AUTH_MESSAGES.badLogin);
    expect(err.fieldErrors).toEqual({});
  });

  it("gives the same answer for an unknown email", async () => {
    const ctx = publicContext(t.db);
    const err = await validationError(authenticate(ctx, { email: "nobody@example.com", password: TEST_PASSWORD }, meta()));
    expect(err.userMessage).toBe(AUTH_MESSAGES.badLogin);
    expect(err.fieldErrors).toEqual({});
  });

  it("validates the form", async () => {
    const ctx = publicContext(t.db);
    const err = await validationError(authenticate(ctx, { email: "", password: "" }, meta()));
    expect(err.fieldErrors).toEqual({ email: "Email is required.", password: "Enter your password." });
  });

  it.each(["PENDING", "REJECTED", "DISABLED"] as const)("lets a %s account sign in (they land on /pending)", async (status) => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db, { role: "BUILD_LEADER", status });
    expect(await authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, meta())).toEqual({ userId: user.id, status });
  });

  it("locks out an email+IP after 10 attempts in 15 minutes", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db);
    const ip = meta();
    expect(AUTH_RATE_LIMITS.loginPerIpAndEmail).toEqual({ limit: 10, windowMs: 15 * 60 * 1000 });
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerIpAndEmail.limit; i++) {
      await validationError(authenticate(ctx, { email: user.email, password: `wrong-${i}` }, ip));
    }
    // Even the right password is refused until the window passes...
    await expect(authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, ip)).rejects.toBeInstanceOf(RateLimitError);
    // ...but only for that IP.
    await expect(authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, meta())).resolves.toMatchObject({ userId: user.id });
    // And the window does pass.
    const later = { ...ctx, now: new Date(TEST_NOW.getTime() + 16 * 60 * 1000) };
    await expect(authenticate(later, { email: user.email, password: TEST_PASSWORD }, ip)).resolves.toMatchObject({ userId: user.id });
  });

  it("doesn't count successful sign-ins toward the lockout (people sign in on several devices)", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db);
    const ip = meta();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerIpAndEmail.limit + 5; i++) {
      await expect(authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, ip)).resolves.toMatchObject({ userId: user.id });
    }
    // A success also clears earlier failures.
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerIpAndEmail.limit - 1; i++) {
      await validationError(authenticate(ctx, { email: user.email, password: `wrong-${i}` }, ip));
    }
    await authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, ip);
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerIpAndEmail.limit - 1; i++) {
      await validationError(authenticate(ctx, { email: user.email, password: `wrong-again-${i}` }, ip));
    }
    await expect(authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, ip)).resolves.toMatchObject({ userId: user.id });
  });

  it("limits a single IP across all emails (generous: a whole team meeting shares one IP)", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db);
    const ip = meta();
    expect(AUTH_RATE_LIMITS.loginPerIp.limit).toBeGreaterThanOrEqual(200);
    await t.db.rateLimit.create({ data: { key: `login:ip:${ip.ip}`, count: AUTH_RATE_LIMITS.loginPerIp.limit, windowStart: TEST_NOW } });
    await expect(authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, ip)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("does not promote anyone when their email isn't an admin email", async () => {
    const user = await makeUser(t.db, { role: "MENTOR", status: "PENDING" });
    const ctx = publicContext(t.db, { adminEmails: ["someone-else@example.com"] });
    expect(await authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, meta())).toEqual({ userId: user.id, status: "PENDING" });
    expect(await loadUser(user.id)).toMatchObject({ isAdmin: false, status: "PENDING" });
  });
});

describe("requestPasswordReset", () => {
  it("emails a one-time link to an existing account", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db);
    await expect(requestPasswordReset(ctx, { email: user.email.toUpperCase() }, meta())).resolves.toBeUndefined();

    const events = ctx.notifier.ofType("password.reset");
    expect(events).toHaveLength(1);
    expect(events[0].userId).toBe(user.id);
    const url = new URL(events[0].resetUrl);
    expect(`${url.origin}${url.pathname}`).toBe("http://localhost:3000/reset-password");
    const token = url.searchParams.get("token")!;
    expect(await getResetTokenStatus(t.db, token, TEST_NOW)).toBe("valid");
  });

  it("stays silent for unknown emails", async () => {
    const ctx = publicContext(t.db);
    await expect(requestPasswordReset(ctx, { email: "ghost@example.com" }, meta())).resolves.toBeUndefined();
    expect(ctx.notifier.events).toEqual([]);
  });

  it("stays silent for disabled accounts", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db, { status: "DISABLED" });
    await expect(requestPasswordReset(ctx, { email: user.email }, meta())).resolves.toBeUndefined();
    expect(ctx.notifier.events).toEqual([]);
    expect(await t.db.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it("validates the email", async () => {
    const ctx = publicContext(t.db);
    const err = await validationError(requestPasswordReset(ctx, { email: "nope" }, meta()));
    expect(err.fieldErrors).toEqual({ email: "Enter a valid email address." });
  });

  it("sends at most 3 links per email per hour, silently", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db);
    for (let i = 0; i < 5; i++) {
      await expect(requestPasswordReset(ctx, { email: user.email }, meta())).resolves.toBeUndefined();
    }
    expect(ctx.notifier.ofType("password.reset")).toHaveLength(3);
  });

  it("limits requests per IP", async () => {
    const ctx = publicContext(t.db);
    const ip = meta();
    for (let i = 0; i < AUTH_RATE_LIMITS.forgotPerIp.limit; i++) await requestPasswordReset(ctx, { email: uniqueEmail("nobody") }, ip);
    await expect(requestPasswordReset(ctx, { email: uniqueEmail("nobody") }, ip)).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("password reset links", () => {
  async function issue(userId: string) {
    const ctx = publicContext(t.db);
    await issuePasswordReset(ctx, userId);
    const [event] = ctx.notifier.ofType("password.reset");
    return new URL(event.resetUrl).searchParams.get("token")!;
  }

  it("a successful reset lifts the account-level sign-in lockout", async () => {
    const user = await makeUser(t.db);
    await t.db.rateLimit.create({
      data: { key: `login:acct:${user.email}`, count: AUTH_RATE_LIMITS.loginPerAccount.limit, windowStart: TEST_NOW },
    });
    const ctx = publicContext(t.db);
    await expect(authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, meta())).rejects.toBeInstanceOf(RateLimitError);
    const token = await issue(user.id);
    await resetPassword(ctx, { token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    await expect(authenticate(ctx, { email: user.email, password: NEW_PASSWORD }, meta())).resolves.toMatchObject({ userId: user.id });
  });

  it("reports valid / invalid / expired", async () => {
    const user = await makeUser(t.db);
    const token = await issue(user.id);
    expect(await getResetTokenStatus(t.db, token, TEST_NOW)).toBe("valid");
    expect(await getResetTokenStatus(t.db, token, new Date(TEST_NOW.getTime() + 61 * 60 * 1000))).toBe("expired");
    expect(await getResetTokenStatus(t.db, "made-up-token", TEST_NOW)).toBe("invalid");
    expect(await getResetTokenStatus(t.db, "", TEST_NOW)).toBe("invalid");
    expect(await getResetTokenStatus(t.db, undefined, TEST_NOW)).toBe("invalid");

    await t.db.passwordResetToken.updateMany({ where: { userId: user.id }, data: { usedAt: TEST_NOW } });
    expect(await getResetTokenStatus(t.db, token, TEST_NOW)).toBe("invalid");
  });

  it("sets the new password, burns the link, invalidates other links and signs out every session", async () => {
    const user = await makeUser(t.db);
    const bystander = await makeUser(t.db);
    const token = await issue(user.id);
    // Another unused link for the same user (e.g. an admin-issued one).
    const otherToken = generateToken();
    await t.db.passwordResetToken.create({
      data: { tokenHash: hashToken(otherToken), userId: user.id, expiresAt: new Date(TEST_NOW.getTime() + 60 * 60 * 1000) },
    });
    const expires = new Date(TEST_NOW.getTime() + 24 * 60 * 60 * 1000);
    await t.db.session.createMany({
      data: [
        { tokenHash: hashToken(generateToken()), userId: user.id, expiresAt: expires },
        { tokenHash: hashToken(generateToken()), userId: user.id, expiresAt: expires },
        { tokenHash: hashToken(generateToken()), userId: bystander.id, expiresAt: expires },
      ],
    });

    const ctx = publicContext(t.db);
    const result = await resetPassword(ctx, { token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(result).toEqual({ userId: user.id, status: "ACTIVE" });

    const after = await loadUser(user.id);
    expect(await verifyPassword(NEW_PASSWORD, after.passwordHash)).toBe(true);
    expect(await verifyPassword(TEST_PASSWORD, after.passwordHash)).toBe(false);
    expect(await t.db.passwordResetToken.count({ where: { userId: user.id, usedAt: null } })).toBe(0);
    expect(await getResetTokenStatus(t.db, otherToken, TEST_NOW)).toBe("invalid");
    expect(await t.db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await t.db.session.count({ where: { userId: bystander.id } })).toBe(1);
    // A security notice goes to the account owner.
    expect(ctx.notifier.events).toEqual([{ type: "password.changed", userId: user.id }]);

    // The new password works for sign-in.
    await expect(authenticate(ctx, { email: user.email, password: NEW_PASSWORD }, meta())).resolves.toMatchObject({ userId: user.id });

    // The link is single-use.
    const reused = await validationError(resetPassword(ctx, { token, password: "another-password-1", confirmPassword: "another-password-1" }));
    expect(reused.userMessage).toBe(AUTH_MESSAGES.badResetLink);
    expect(await verifyPassword(NEW_PASSWORD, (await loadUser(user.id)).passwordHash)).toBe(true);
  });

  it("returns the account status so pending users land on /pending", async () => {
    const user = await makeUser(t.db, { role: "CAPTAIN", status: "PENDING" });
    const token = await issue(user.id);
    const ctx = publicContext(t.db);
    expect(await resetPassword(ctx, { token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).toEqual({
      userId: user.id,
      status: "PENDING",
    });
  });

  it("refuses an expired link", async () => {
    const user = await makeUser(t.db);
    const token = generateToken();
    await t.db.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(TEST_NOW.getTime() - 1000) },
    });
    const ctx = publicContext(t.db);
    const err = await validationError(resetPassword(ctx, { token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }));
    expect(err.userMessage).toBe(AUTH_MESSAGES.badResetLink);
    expect(await verifyPassword(TEST_PASSWORD, (await loadUser(user.id)).passwordHash)).toBe(true);
  });

  it("refuses an unknown or missing token", async () => {
    const ctx = publicContext(t.db);
    for (const token of ["not-a-real-token", "", undefined]) {
      const err = await validationError(resetPassword(ctx, { token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }));
      expect(err.userMessage).toBe(AUTH_MESSAGES.badResetLink);
    }
  });

  it("validates the new password without using up the link", async () => {
    const user = await makeUser(t.db);
    const token = await issue(user.id);
    const ctx = publicContext(t.db);

    const mismatch = await validationError(resetPassword(ctx, { token, password: NEW_PASSWORD, confirmPassword: "something-else" }));
    expect(mismatch.fieldErrors).toEqual({ confirmPassword: "Passwords don't match." });
    const short = await validationError(resetPassword(ctx, { token, password: "short", confirmPassword: "short" }));
    expect(short.fieldErrors).toEqual({ password: "Password must be at least 8 characters." });

    expect(await getResetTokenStatus(t.db, token, TEST_NOW)).toBe("valid");
    await expect(resetPassword(ctx, { token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })).resolves.toMatchObject({
      userId: user.id,
    });
  });

  it("lets only one of two simultaneous submissions of the same link win", async () => {
    const user = await makeUser(t.db);
    const token = await issue(user.id);
    const ctx = publicContext(t.db);
    const results = await Promise.allSettled([
      resetPassword(ctx, { token, password: "first-password-1", confirmPassword: "first-password-1" }),
      resetPassword(ctx, { token, password: "second-password-2", confirmPassword: "second-password-2" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ValidationError);
  });
});

describe("safeRedirectPath", () => {
  it("allows same-site paths", () => {
    expect(safeRedirectPath("/today")).toBe("/today");
    expect(safeRedirectPath("/questions?tab=open")).toBe("/questions?tab=open");
  });

  it.each([
    ["//evil.example"],
    ["/\\evil.example"],
    ["https://evil.example/today"],
    ["today"],
    ["/\t/evil.example"],
    ["/foo\\bar"],
    [""],
    [undefined],
    [null],
    [["/today"]],
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });
});

describe("ADMIN_EMAILS only bootstraps the first admin", () => {
  // Each test gets its own empty database so "no admin exists yet" is guaranteed.
  let fresh: TestDb;
  beforeEach(async () => {
    fresh = await createTestDb();
  });
  afterEach(async () => {
    await fresh.drop();
  });

  it("registering with an ADMIN_EMAILS address on an empty team makes an ACTIVE admin", async () => {
    const ctx = publicContext(fresh.db, { adminEmails: ["owner@huskyteers.test"] });
    const result = await registerUser(ctx, registration({ email: "Owner@Huskyteers.test", role: "MENTOR" }), meta());
    expect(result.status).toBe("ACTIVE");
    const user = await fresh.db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user).toMatchObject({ email: "owner@huskyteers.test", role: "MENTOR", subteam: null, status: "ACTIVE", isAdmin: true });
    expect(user.approvedAt).toEqual(TEST_NOW);
    expect(ctx.notifier.events).toEqual([]);
  });

  it("once an admin exists, another ADMIN_EMAILS sign-up is an ordinary (pending) sign-up", async () => {
    await makeUser(fresh.db, { role: "CAPTAIN", isAdmin: true });
    const ctx = publicContext(fresh.db, { adminEmails: ["second@huskyteers.test"] });
    const result = await registerUser(ctx, registration({ email: "second@huskyteers.test", role: "MENTOR" }), meta());
    expect(result.status).toBe("PENDING");
    expect(await fresh.db.user.findUniqueOrThrow({ where: { id: result.userId } })).toMatchObject({ isAdmin: false, status: "PENDING" });
    expect(ctx.notifier.events).toEqual([{ type: "account.pending", userId: result.userId }]);
  });

  it("promotes an ADMIN_EMAILS account on sign-in only while no admin exists (right password only)", async () => {
    const email = uniqueEmail("owner");
    const user = await makeUser(fresh.db, { email, role: "MENTOR", status: "PENDING" });
    const ctx = publicContext(fresh.db, { adminEmails: [email] });

    const bad = await validationError(authenticate(ctx, { email, password: "wrong-password" }, meta()));
    expect(bad.userMessage).toBe(AUTH_MESSAGES.badLogin);
    expect(await fresh.db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ isAdmin: false, status: "PENDING" });

    expect(await authenticate(ctx, { email, password: TEST_PASSWORD }, meta())).toEqual({ userId: user.id, status: "ACTIVE" });
    const after = await fresh.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ isAdmin: true, status: "ACTIVE" });
    expect(after.approvedAt).toEqual(TEST_NOW);
  });

  it("doesn't promote on sign-in when an admin already exists (the admin's decisions stick)", async () => {
    await makeUser(fresh.db, { role: "CAPTAIN", isAdmin: true });
    const email = uniqueEmail("listed");
    const demoted = await makeUser(fresh.db, { email, role: "MENTOR", isAdmin: false });
    const ctx = publicContext(fresh.db, { adminEmails: [email] });
    expect(await authenticate(ctx, { email, password: TEST_PASSWORD }, meta())).toEqual({ userId: demoted.id, status: "ACTIVE" });
    expect(await fresh.db.user.findUniqueOrThrow({ where: { id: demoted.id } })).toMatchObject({ isAdmin: false });
  });

  it("never revives a DISABLED ADMIN_EMAILS account, even with no admin left", async () => {
    const email = uniqueEmail("gone");
    const disabled = await makeUser(fresh.db, { email, role: "CAPTAIN", status: "DISABLED" });
    const ctx = publicContext(fresh.db, { adminEmails: [email] });
    expect(await authenticate(ctx, { email, password: TEST_PASSWORD }, meta())).toEqual({ userId: disabled.id, status: "DISABLED" });
    expect(await fresh.db.user.findUniqueOrThrow({ where: { id: disabled.id } })).toMatchObject({ isAdmin: false, status: "DISABLED" });
  });
});

describe("rate limits that don't depend on a spoofable IP", () => {
  it("locks an account after 30 failed sign-ins in an hour even when every attempt comes from a new IP", async () => {
    const ctx = publicContext(t.db);
    const user = await makeUser(t.db);
    expect(AUTH_RATE_LIMITS.loginPerAccount.limit).toBe(30);
    // A failure from a brand-new IP still counts against the account…
    await validationError(authenticate(ctx, { email: user.email, password: "wrong" }, meta()));
    const row = await t.db.rateLimit.findUniqueOrThrow({ where: { key: `login:acct:${user.email}` } });
    expect(row.count).toBe(1);
    // …so after 30 failures (seeded here to keep the test fast) even the right password waits.
    await t.db.rateLimit.update({ where: { key: row.key }, data: { count: AUTH_RATE_LIMITS.loginPerAccount.limit } });
    await expect(authenticate(ctx, { email: user.email, password: TEST_PASSWORD }, meta())).rejects.toBeInstanceOf(RateLimitError);
    const later = { ...ctx, now: new Date(TEST_NOW.getTime() + 61 * 60 * 1000) };
    await expect(authenticate(later, { email: user.email, password: TEST_PASSWORD }, meta())).resolves.toMatchObject({ userId: user.id });
  });

  it("only trusts forwarding headers where the platform sets them", () => {
    const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
    const spoofed = headers({ "x-forwarded-for": "10.9.9.9, 1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(clientIpFromHeaders(spoofed, { vercel: false, trustProxyHeaders: false })).toBe("unknown");
    expect(clientIpFromHeaders(spoofed, { vercel: true, trustProxyHeaders: false })).toBe("5.6.7.8");
    expect(clientIpFromHeaders(spoofed, { vercel: false, trustProxyHeaders: true })).toBe("10.9.9.9");
    expect(clientIpFromHeaders(headers({ "x-real-ip": "evil\nkey" }), { vercel: true, trustProxyHeaders: false })).toBe("unknown");
  });
});
