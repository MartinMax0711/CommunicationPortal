"use client";

import { MonitorSmartphone } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** "Sign out of all other devices" (asks first) and reports how many were signed out. */
export function SignOutOthersForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton
        variant="secondary"
        pendingText="Signing out…"
        confirm="Sign out of every other phone and computer? You'll stay signed in here."
        className="w-full sm:w-auto"
      >
        <MonitorSmartphone className="size-4" aria-hidden />
        Sign out of all other devices
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
