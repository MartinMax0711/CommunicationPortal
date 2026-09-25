"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { loginAction } from "@/app/(auth)/actions";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/constants";
import { Field, FieldError, Input, Label } from "../ui/field";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { authLinkClasses } from "./auth-header";
import { PasswordInput } from "./password-input";
import { useFocusFirstError } from "./use-focus-first-error";

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction] = useActionState(loginAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const errors = state?.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}

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
          defaultValue={state?.values?.email}
          invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className={cn(authLinkClasses, "-my-2.5 text-sm")}>
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={LIMITS.passwordMax}
          invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        <FieldError id="password-error">{errors.password}</FieldError>
      </div>

      <SubmitButton size="lg" className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
