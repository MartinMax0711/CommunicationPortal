"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { LIMITS } from "@/lib/constants";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FIELDS = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password", hint: undefined },
  { name: "newPassword", label: "New password", autoComplete: "new-password", hint: `At least ${LIMITS.passwordMin} characters.` },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password", hint: undefined },
] as const;

/** Change password (current + new + confirm). Fields clear after every submit. */
export function PasswordForm({ action, email }: { action: FormAction; email: string }) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="space-y-4">
      {/* Lets password managers file the new password under the right account. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      {FIELDS.map((f) => {
        const error = state?.fieldErrors?.[f.name];
        const id = `settings-${f.name}`;
        return (
          <Field key={f.name} label={f.label} htmlFor={id} error={error} hint={f.hint}>
            <Input
              id={id}
              name={f.name}
              type="password"
              autoComplete={f.autoComplete}
              required
              minLength={f.name === "currentPassword" ? undefined : LIMITS.passwordMin}
              maxLength={LIMITS.passwordMax}
              invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </Field>
        );
      })}
      <FormMessage state={state} />
      <SubmitButton pendingText="Updating…" className="w-full sm:w-auto">
        Update password
      </SubmitButton>
    </form>
  );
}
