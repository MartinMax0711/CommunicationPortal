"use client";

import { useActionState, useRef, useState } from "react";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { initialActionState } from "@/lib/action-state";
import { LIMITS } from "@/lib/constants";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { useFocusFirstError } from "./use-focus-first-error";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  // Lets people go back to the form after a successful send (e.g. they typed the wrong email).
  const [dismissedNonce, setDismissedNonce] = useState<number | undefined>(undefined);
  const errors = state?.fieldErrors ?? {};

  if (state?.ok && state.nonce !== dismissedNonce) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your email">
          {state.message}
        </Alert>
        <p className="text-sm leading-relaxed text-ink-500">
          Don&apos;t see it after a few minutes? Check your spam folder, or make sure you used the email you signed up with.
        </p>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setDismissedNonce(state.nonce)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state?.ok ? null : state} />
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={LIMITS.emailMax}
          defaultValue={state?.ok ? undefined : state?.values?.email}
          invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
