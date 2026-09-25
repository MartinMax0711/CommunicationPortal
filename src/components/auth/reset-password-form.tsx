"use client";

import { useActionState, useRef } from "react";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { initialActionState } from "@/lib/action-state";
import { LIMITS } from "@/lib/constants";
import { Field } from "../ui/field";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { PasswordInput } from "./password-input";
import { useFocusFirstError } from "./use-focus-first-error";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = state?.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />

      <Field label="New password" htmlFor="password" error={errors.password} hint={`At least ${LIMITS.passwordMin} characters.`}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={LIMITS.passwordMin}
          maxLength={LIMITS.passwordMax}
          invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          maxLength={LIMITS.passwordMax}
          invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
        />
      </Field>

      <SubmitButton size="lg" className="w-full" pendingText="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
