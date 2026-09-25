"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";
import { sendTestEmailAction } from "@/app/(app)/admin/actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { TEST_EMAIL_MESSAGES } from "./messages";

export function TestEmailForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(sendTestEmailAction, initialActionState);
  const tone = !state ? null : !state.ok ? "error" : state.message === TEST_EMAIL_MESSAGES.SKIPPED ? "warning" : "success";

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SubmitButton className="w-full sm:w-auto" pendingText="Sending…">
          <Send className="size-4" aria-hidden />
          Send me a test email
        </SubmitButton>
        <p className="min-w-0 truncate text-sm text-ink-500">Goes to {email}</p>
      </div>
      {tone && state?.message && <Alert tone={tone}>{state.message}</Alert>}
    </form>
  );
}
