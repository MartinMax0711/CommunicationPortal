import { KeyRound, Link2Off } from "lucide-react";
import type { Metadata } from "next";
import { AuthHeader, AuthSwitch } from "@/components/auth/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/server/db";
import { getResetTokenStatus } from "@/server/services/auth";

// The one-time token is in the URL: never leak it to other sites via the Referer header.
export const metadata: Metadata = { title: "Reset password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token.trim() : "";
  const status = await getResetTokenStatus(prisma, value, new Date());

  if (status !== "valid") {
    const expired = status === "expired";
    return (
      <>
        <AuthHeader icon={Link2Off} tone="red" title="Link not working" />
        <Alert tone="error" title={expired ? "This reset link has expired" : "This reset link is invalid"}>
          {expired
            ? "Reset links only work for 1 hour. Request a new one and use it right away."
            : "It may have been used already, replaced by a newer link, or copied incompletely. Request a new one."}
        </Alert>
        <ButtonLink href="/forgot-password" size="lg" className="mt-4 w-full">
          Get a new link
        </ButtonLink>
        <AuthSwitch prompt="Remembered it?" href="/login">
          Back to sign in
        </AuthSwitch>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title="Choose a new password"
        description="You'll be signed in right away, and signed out everywhere else."
      />
      <ResetPasswordForm token={value} />
      <AuthSwitch prompt="Link not working?" href="/forgot-password">
        Get a new one
      </AuthSwitch>
    </>
  );
}
