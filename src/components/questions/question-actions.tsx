"use client";

import { CircleCheck, RotateCcw, Trash2, type LucideIcon } from "lucide-react";
import { useActionState } from "react";
import type { ButtonVariant } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** One-button form that shows its own error (e.g. "This question is already resolved."). */
function ActionButton({
  action,
  label,
  pendingText,
  icon: Icon,
  variant,
  confirm,
  className,
}: {
  action: ServerAction;
  label: string;
  pendingText: string;
  icon: LucideIcon;
  variant: ButtonVariant;
  confirm?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className={cn("flex flex-col gap-1", className)}>
      <SubmitButton variant={variant} pendingText={pendingText} confirm={confirm} className="w-full sm:w-auto">
        <Icon className="size-4" aria-hidden />
        {label}
      </SubmitButton>
      {state && !state.ok && state.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Resolve / Reopen / Delete buttons for a thread. Pass only the actions the viewer may use. */
export function QuestionActions({
  resolveAction,
  reopenAction,
  deleteAction,
}: {
  resolveAction?: ServerAction;
  reopenAction?: ServerAction;
  deleteAction?: ServerAction;
}) {
  if (!resolveAction && !reopenAction && !deleteAction) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
      {resolveAction && (
        <ActionButton
          action={resolveAction}
          label="Mark as resolved"
          pendingText="Resolving…"
          icon={CircleCheck}
          variant="secondary"
        />
      )}
      {reopenAction && (
        <ActionButton action={reopenAction} label="Reopen" pendingText="Reopening…" icon={RotateCcw} variant="secondary" />
      )}
      {deleteAction && (
        <ActionButton
          action={deleteAction}
          label="Delete question"
          pendingText="Deleting…"
          icon={Trash2}
          variant="ghost"
          confirm="Delete this question? This can't be undone."
          className="sm:ml-auto [&_button]:text-red-600 [&_button:hover]:bg-red-50"
        />
      )}
    </div>
  );
}
