"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AccountStatus } from "@/generated/prisma/enums";
import type { ActionState } from "@/lib/action-state";
import { formDataToObject, runAction } from "@/server/action";
import { startSession } from "@/server/auth/session";
import { getPublicContext } from "@/server/context";
import {
  AUTH_MESSAGES,
  authenticate,
  clientIpFromHeaders,
  type RequestMeta,
  registerUser,
  requestPasswordReset,
  resetPassword,
  safeRedirectPath,
} from "@/server/services/auth";

/**
 * Client IP for rate limiting. Proxy headers are only trusted where the platform sets them: on Vercel,
 * or behind your own proxy that replaces X-Forwarded-For (TRUST_PROXY_HEADERS=true). Otherwise "unknown".
 */
async function requestMeta(): Promise<RequestMeta> {
  const ip = clientIpFromHeaders(await headers(), {
    vercel: Boolean(process.env.VERCEL),
    trustProxyHeaders: process.env.TRUST_PROXY_HEADERS === "true",
  });
  return { ip };
}

/** ACTIVE accounts go to `next` (if it's a safe same-site path) or Today; everyone else to /pending. */
function destination(status: AccountStatus, next: FormDataEntryValue | null): string {
  if (status !== "ACTIVE") return "/pending";
  return safeRedirectPath(next) ?? "/today";
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = getPublicContext();
      const { userId, status } = await registerUser(ctx, formDataToObject(formData), await requestMeta());
      await startSession(ctx.db, userId);
      revalidatePath("/", "layout");
      redirect(destination(status, formData.get("next")));
    },
    { formData },
  );
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = getPublicContext();
      const { userId, status } = await authenticate(ctx, formDataToObject(formData), await requestMeta());
      await startSession(ctx.db, userId);
      revalidatePath("/", "layout");
      redirect(destination(status, formData.get("next")));
    },
    { formData },
  );
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      await requestPasswordReset(getPublicContext(), formDataToObject(formData), await requestMeta());
    },
    { success: AUTH_MESSAGES.resetEmailSent, formData },
  );
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    async () => {
      const ctx = getPublicContext();
      const { userId, status } = await resetPassword(ctx, formDataToObject(formData));
      await startSession(ctx.db, userId);
      revalidatePath("/", "layout");
      redirect(destination(status, null));
    },
    { formData },
  );
}
