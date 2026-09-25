import type { PublicContext } from "../context";
import { generateToken, hashToken } from "./tokens";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a one-time reset link for `userId` (invalidating older unused links) and emit a
 * `password.reset` notification carrying the URL. Used by "Forgot password" and by admins.
 *
 * Returns the link so an admin can hand it over directly (e.g. when email isn't set up or
 * the address is wrong). Only ever show it to an admin: whoever has it can set the password.
 */
export async function issuePasswordReset(
  ctx: Pick<PublicContext, "db" | "notifier" | "now" | "config">,
  userId: string,
): Promise<{ resetUrl: string }> {
  const token = generateToken();
  await ctx.db.$transaction([
    ctx.db.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: ctx.now } }),
    ctx.db.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId, expiresAt: new Date(ctx.now.getTime() + PASSWORD_RESET_TTL_MS) },
    }),
  ]);
  const resetUrl = `${ctx.config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  ctx.notifier.notify({ type: "password.reset", userId, resetUrl });
  return { resetUrl };
}
