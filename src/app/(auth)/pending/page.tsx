import { Ban, Hourglass, LogOut, RefreshCw, UserX } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { describeRole } from "@/components/app/user-chip";
import { AuthHeader } from "@/components/auth/auth-header";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { logoutAction } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getTransport } from "@/server/email/transport";
import { getPendingNotice } from "@/server/services/auth";

export const metadata: Metadata = { title: "Account status" };

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "ACTIVE") redirect("/today");

  const requested = describeRole(user.role, user.subteam);
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  const notice = user.status === "PENDING" ? await getPendingNotice(prisma, getTransport() !== null) : null;

  return (
    <>
      {notice && (
        <>
          <AuthHeader icon={Hourglass} tone="amber" title="Waiting for approval" description={`Thanks for signing up, ${firstName}!`} />
          <AccountSummary requested={requested} email={user.email} />
          <p className="mt-4 text-sm leading-relaxed text-ink-600">
            {notice.adminEmailed ? "The team admin has been notified." : "The team admin will see your request in the portal."}{" "}
            {notice.approvalEmailed ? "You'll get an email when you're approved." : "Check back here to see if you've been approved."}
          </p>
          <div className="mt-6 space-y-3">
            <ButtonLink href="/pending" prefetch={false} size="lg" className="w-full">
              <RefreshCw className="size-4" aria-hidden />
              Check again
            </ButtonLink>
            <SignOut />
          </div>
        </>
      )}

      {user.status === "REJECTED" && (
        <>
          <AuthHeader icon={UserX} tone="red" title="Request not approved" />
          <AccountSummary requested={requested} email={user.email} />
          <p className="mt-4 text-sm leading-relaxed text-ink-600">
            Your request to join as {requested} wasn&apos;t approved. If you think this is a mistake, talk to the team admin.
          </p>
          <div className="mt-6">
            <SignOut />
          </div>
        </>
      )}

      {user.status === "DISABLED" && (
        <>
          <AuthHeader icon={Ban} tone="gray" title="Account disabled" />
          <p className="text-center text-sm leading-relaxed text-ink-600">
            This account has been disabled. Talk to the team admin if you need access again.
          </p>
          <div className="mt-6">
            <SignOut />
          </div>
        </>
      )}
    </>
  );
}

function AccountSummary({ requested, email }: { requested: string; email: string }) {
  return (
    <dl className="space-y-2 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm">
      <SummaryRow label="Requested">{requested}</SummaryRow>
      <SummaryRow label="Email">{email}</SummaryRow>
    </dl>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink-900">{children}</dd>
    </div>
  );
}

function SignOut() {
  return (
    <form action={logoutAction}>
      <SubmitButton variant="secondary" size="lg" className="w-full" pendingText="Signing out…">
        <LogOut className="size-4" aria-hidden />
        Sign out
      </SubmitButton>
    </form>
  );
}
