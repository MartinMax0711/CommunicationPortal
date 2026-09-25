"use client";

import { useActionState, type ReactNode } from "react";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import type { ButtonVariant } from "../ui/button";
import { SubmitButton } from "../ui/submit-button";
import type { FormAction } from "./types";

/**
 * A one-button form (Reopen, Remove, Delete…) that posts hidden fields to a Server Action
 * and shows the error inline if it fails. The service re-checks every id it receives.
 */
export function ActionForm({
  action,
  fields,
  children,
  variant = "secondary",
  confirm,
  pendingText,
  className,
  "aria-label": ariaLabel,
}: {
  action: FormAction;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: ButtonVariant;
  confirm?: string;
  pendingText?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className={cn("inline-flex flex-col", className)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} confirm={confirm} pendingText={pendingText} aria-label={ariaLabel}>
        {children}
      </SubmitButton>
      {state && !state.ok && state.message && (
        <p role="alert" className="mt-1 max-w-64 text-xs text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
